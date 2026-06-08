// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "forge-std/Test.sol";
import "../contracts/ethereum/EthereumLABSRegistry.sol";
import "../contracts/governance/LABSGovernanceToken.sol";
import "../contracts/governance/LABSGovernor.sol";
import "../contracts/RecoveryGovernance.sol";
import "../contracts/StateRecovery.sol";
import "../contracts/proxy/LABSProxy.sol";

/**
 * @title InputValidationTest
 * @dev Comprehensive test suite for input validation across all contracts
 */
contract InputValidationTest is Test {
    
    EthereumLABSRegistry public LABSRegistry;
    LABSGovernanceToken public governanceToken;
    LABSGovernor public governor;
    RecoveryGovernance public recoveryGov;
    StateRecovery public stateRecovery;
    LABSProxy public proxy;
    
    address public owner = address(0x1);
    address public admin = address(0x2);
    address public user = address(0x3);
    
    function setUp() public {
        // Deploy contracts
        vm.startPrank(owner);
        
        LABSRegistry = new EthereumLABSRegistry();
        governanceToken = new LABSGovernanceToken();
        
        // Deploy Timelock for Governor (simplified)
        address timelock = address(0x123);
        
        governor = new LABSGovernor(
            governanceToken,
            TimelockController(payable(timelock))
        );
        
        stateRecovery = new StateRecovery();
        recoveryGov = new RecoveryGovernance(address(stateRecovery));
        proxy = new LABSProxy();
        
        // Setup roles
        LABSRegistry.grantRole(LABSRegistry.ADMIN_ROLE(), admin);
        stateRecovery.grantRole(stateRecovery.DEFAULT_ADMIN_ROLE(), admin);
        
        vm.stopPrank();
    }
    
    // ========== EthereumLABSRegistry Tests ==========
    
    function testGrantRoleZeroAddress() public {
        vm.startPrank(admin);
        vm.expectRevert("Account cannot be zero address");
        LABSRegistry.grantRole(bytes32(0x1), address(0));
        vm.stopPrank();
    }
    
    function testGrantRoleToSelf() public {
        vm.startPrank(admin);
        vm.expectRevert("Cannot grant role to self");
        LABSRegistry.grantRole(bytes32(0x1), admin);
        vm.stopPrank();
    }
    
    function testBridgeLABSEmpty() public {
        vm.startPrank(admin);
        vm.expectRevert("LABS cannot be empty");
        LABSRegistry.bridgeLABS("", user, "publicKey", "endpoint");
        vm.stopPrank();
    }
    
    function testBridgeLABSTooLong() public {
        vm.startPrank(admin);
        string memory longLABS = new string(257);
        vm.expectRevert("LABS too long");
        LABSRegistry.bridgeLABS(longLABS, user, "publicKey", "endpoint");
        vm.stopPrank();
    }
    
    function testBridgeLABSZeroOwner() public {
        vm.startPrank(admin);
        vm.expectRevert("Owner cannot be zero address");
        LABSRegistry.bridgeLABS("LABS:test:123", address(0), "publicKey", "endpoint");
        vm.stopPrank();
    }
    
    function testBridgeLABSEmptyPublicKey() public {
        vm.startPrank(admin);
        vm.expectRevert("Public key cannot be empty");
        LABSRegistry.bridgeLABS("LABS:test:123", user, "", "endpoint");
        vm.stopPrank();
    }
    
    function testBridgeCredentialZeroId() public {
        vm.startPrank(admin);
        vm.expectRevert("Credential ID cannot be zero");
        LABSRegistry.bridgeCredential(bytes32(0), "issuer", "subject", "type", block.timestamp + 1000, bytes32(0x1));
        vm.stopPrank();
    }
    
    function testBridgeCredentialEmptyIssuer() public {
        vm.startPrank(admin);
        vm.expectRevert("Issuer cannot be empty");
        LABSRegistry.bridgeCredential(bytes32(0x1), "", "subject", "type", block.timestamp + 1000, bytes32(0x1));
        vm.stopPrank();
    }
    
    function testBridgeCredentialPastExpiration() public {
        vm.startPrank(admin);
        vm.expectRevert("Expiration must be in the future");
        LABSRegistry.bridgeCredential(bytes32(0x1), "issuer", "subject", "type", block.timestamp - 1000, bytes32(0x1));
        vm.stopPrank();
    }
    
    function testSetDataZeroKey() public {
        vm.startPrank(user);
        // First give user a LABS
        vm.startPrank(admin);
        LABSRegistry.bridgeLABS("LABS:test:123", user, "publicKey", "endpoint");
        vm.stopPrank();
        
        vm.startPrank(user);
        vm.expectRevert("Key cannot be zero");
        LABSRegistry.setData(bytes32(0), "value");
        vm.stopPrank();
    }
    
    function testExecuteZeroTarget() public {
        vm.startPrank(user);
        // First give user a LABS
        vm.startPrank(admin);
        LABSRegistry.bridgeLABS("LABS:test:123", user, "publicKey", "endpoint");
        vm.stopPrank();
        
        vm.startPrank(user);
        vm.expectRevert("Target cannot be zero address");
        LABSRegistry.execute(1, address(0), 0, "data");
        vm.stopPrank();
    }
    
    function testAddClaimZeroIssuer() public {
        vm.startPrank(user);
        // First give user a LABS
        vm.startPrank(admin);
        LABSRegistry.bridgeLABS("LABS:test:123", user, "publicKey", "endpoint");
        vm.stopPrank();
        
        vm.startPrank(user);
        vm.expectRevert("Issuer cannot be zero address");
        LABSRegistry.addClaim(1, 1, address(0), "signature", "data", "uri");
        vm.stopPrank();
    }
    
    // ========== LABSGovernanceToken Tests ==========
    
    function testMintToZeroAddress() public {
        vm.startPrank(owner);
        vm.expectRevert("Cannot mint to zero address");
        governanceToken.mint(address(0), 1000);
        vm.stopPrank();
    }
    
    function testMintZeroAmount() public {
        vm.startPrank(owner);
        vm.expectRevert("Amount must be greater than zero");
        governanceToken.mint(user, 0);
        vm.stopPrank();
    }
    
    function testMintExceedsLimit() public {
        vm.startPrank(owner);
        vm.expectRevert("Amount exceeds single mint limit");
        governanceToken.mint(user, 1000001 * 10**18);
        vm.stopPrank();
    }
    
    function testBurnFromZeroAddress() public {
        vm.startPrank(owner);
        vm.expectRevert("Cannot burn from zero address");
        governanceToken.burn(address(0), 1000);
        vm.stopPrank();
    }
    
    function testAddMinterZeroAddress() public {
        vm.startPrank(owner);
        vm.expectRevert("Minter cannot be zero address");
        governanceToken.addMinter(address(0));
        vm.stopPrank();
    }
    
    function testAddMinterToSelf() public {
        vm.startPrank(owner);
        vm.expectRevert("Cannot grant minter role to self");
        governanceToken.addMinter(owner);
        vm.stopPrank();
    }
    
    // ========== LABSGovernor Tests ==========
    
    function testProposeContractUpgradeZeroProxy() public {
        vm.expectRevert("Proxy cannot be zero address");
        governor.proposeContractUpgrade(address(0), address(0x1), "description");
    }
    
    function testProposeContractUpgradeZeroImplementation() public {
        vm.expectRevert("New implementation cannot be zero address");
        governor.proposeContractUpgrade(address(0x1), address(0), "description");
    }
    
    function testProposeContractUpgradeSameAddress() public {
        vm.expectRevert("Proxy and implementation cannot be the same");
        governor.proposeContractUpgrade(address(0x1), address(0x1), "description");
    }
    
    function testProposeContractUpgradeEmptyDescription() public {
        vm.expectRevert("Description cannot be empty");
        governor.proposeContractUpgrade(address(0x1), address(0x2), "");
    }
    
    function testProposeParameterChangeZeroTarget() public {
        vm.expectRevert("Target cannot be zero address");
        governor.proposeParameterChange(address(0), "data", "description");
    }
    
    function testProposeParameterChangeEmptyData() public {
        vm.expectRevert("Data cannot be empty");
        governor.proposeParameterChange(address(0x1), "", "description");
    }
    
    // ========== RecoveryGovernance Tests ==========
    
    function testUpdateGovernanceConfigInvalidDelay() public {
        vm.startPrank(admin);
        vm.expectRevert("Minimum proposal delay too short");
        recoveryGov.updateGovernanceConfig(30, 7 days, 24 hours, 50);
        vm.stopPrank();
    }
    
    function testUpdateGovernanceConfigInvalidQuorum() public {
        vm.startPrank(admin);
        vm.expectRevert("Quorum percentage too low");
        recoveryGov.updateGovernanceConfig(1 hours, 7 days, 24 hours, 0);
        vm.stopPrank();
    }
    
    function testAuthorizeContractZeroAddress() public {
        vm.startPrank(admin);
        vm.expectRevert("Contract cannot be zero address");
        recoveryGov.authorizeContract(address(0));
        vm.stopPrank();
    }
    
    function testPauseContractZeroAddress() public {
        vm.startPrank(admin);
        vm.expectRevert("Contract cannot be zero address");
        recoveryGov.pauseContract(address(0), "reason");
        vm.stopPrank();
    }
    
    function testActivateEmergencyModeEmptyReason() public {
        vm.startPrank(admin);
        vm.expectRevert("Reason cannot be empty");
        recoveryGov.activateEmergencyMode("");
        vm.stopPrank();
    }
    
    // ========== StateRecovery Tests ==========
    
    function testSetTargetContractsZeroAddress() public {
        vm.startPrank(admin);
        vm.expectRevert("Ethereum LABS registry cannot be zero address");
        stateRecovery.setTargetContracts(address(0), address(0x1));
        vm.stopPrank();
    }
    
    function testCreateStateSnapshotZeroMerkleRoot() public {
        vm.startPrank(admin);
        vm.expectRevert("Merkle root cannot be zero");
        stateRecovery.createStateSnapshot(bytes32(0), "description");
        vm.stopPrank();
    }
    
    function testProposeRecoveryInvalidType() public {
        vm.startPrank(admin);
        vm.expectRevert("Invalid recovery type");
        stateRecovery.proposeRecovery(StateRecovery.RecoveryType(5), "description", "data");
        vm.stopPrank();
    }
    
    function testEmergencyRecoveryEmptyReason() public {
        vm.startPrank(admin);
        vm.expectRevert("StateRecovery: reason cannot be empty");
        stateRecovery.emergencyRecovery(StateRecovery.RecoveryType.LABS_DOCUMENT, "data", "");
        vm.stopPrank();
    }
    
    function testSetRequiredApprovalsInvalidType() public {
        vm.startPrank(admin);
        vm.expectRevert("Invalid recovery type");
        stateRecovery.setRequiredApprovals(StateRecovery.RecoveryType(5), 5);
        vm.stopPrank();
    }
    
    // ========== LABSProxy Tests ==========
    
    function testInitializeZeroOwner() public {
        vm.expectRevert("Initial owner cannot be zero address");
        proxy.initialize(address(0));
    }
    
    function testInitializeContractOwner() public {
        vm.expectRevert("Initial owner cannot be a contract");
        proxy.initialize(address(LABSRegistry));
    }
    
    // ========== Gas Optimization Tests ==========
    
    function testValidationGasCosts() public {
        vm.startPrank(admin);
        
        uint256 gasBefore = gasleft();
        LABSRegistry.bridgeLABS("LABS:test:123", user, "publicKey123", "endpoint123");
        uint256 gasUsed = gasBefore - gasleft();
        
        console.log("Gas used for bridgeLABS with validation:", gasUsed);
        
        // Test that validation doesn't consume excessive gas
        assertTrue(gasUsed < 200000, "bridgeLABS validation uses too much gas");
        
        vm.stopPrank();
    }
    
    // ========== Edge Case Tests ==========
    
    function testBoundaryConditions() public {
        vm.startPrank(admin);
        
        // Test maximum length strings
        string memory maxLABS = new string(256);
        string memory maxPublicKey = new string(2048);
        string memory maxEndpoint = new string(512);
        
        // These should pass
        LABSRegistry.bridgeLABS(maxLABS, user, maxPublicKey, maxEndpoint);
        
        // Test boundary values for amounts
        governanceToken.mint(user, 1); // Minimum amount
        governanceToken.mint(user, 1000000 * 10**18); // Maximum single mint
        
        vm.stopPrank();
    }
    
    function testRevertMessages() public {
        vm.startPrank(admin);
        
        // Test that revert messages are descriptive
        try LABSRegistry.bridgeLABS("", user, "publicKey", "endpoint") {
            assertTrue(false, "Should have reverted");
        } catch Error(string memory reason) {
            assertEq(reason, "LABS cannot be empty");
        }
        
        try governanceToken.mint(address(0), 1000) {
            assertTrue(false, "Should have reverted");
        } catch Error(string memory reason) {
            assertEq(reason, "Cannot mint to zero address");
        }
        
        vm.stopPrank();
    }
}
