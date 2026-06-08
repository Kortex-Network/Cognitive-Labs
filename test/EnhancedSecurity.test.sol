// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "forge-std/Test.sol";
import "../contracts/optimized/EnhancedLABSRegistry.sol";
import "../contracts/governance/EnhancedLABSGovernanceToken.sol";
import "../contracts/governance/EnhancedLABSGovernor.sol";
import "@openzeppelin/contracts/governance/TimelockController.sol";

/**
 * @title EnhancedSecurityTest
 * @dev Comprehensive test suite demonstrating all security improvements
 * Tests for issues #141-144:
 * #141 - Contract Event Logging
 * #142 - Pausable Contract Pattern  
 * #143 - Contract Reentrancy Protection
 * #144 - Improved Contract Error Handling
 */
contract EnhancedSecurityTest is Test {
    
    // ===== CONTRACT INSTANCES =====
    EnhancedLABSRegistry public LABSRegistry;
    EnhancedLABSGovernanceToken public governanceToken;
    EnhancedLABSGovernor public governor;
    TimelockController public timelock;
    
    // ===== TEST ADDRESSES =====
    address public owner = address(0x1);
    address public admin = address(0x2);
    address public user1 = address(0x3);
    address public user2 = address(0x4);
    address public attacker = address(0x5);
    address public pauser1 = address(0x6);
    address public pauser2 = address(0x7);
    address public pauser3 = address(0x8);
    
    // ===== TEST CONSTANTS =====
    string public constant LABS = "LABS:stellar:1234567890";
    string public constant PUBLIC_KEY = "public_key_123";
    string public constant SERVICE_ENDPOINT = "https://api.example.com";
    bytes32 public constant CREDENTIAL_ID = bytes32(uint256(1));
    string public constant ISSUER = "LABS:stellar:issuer";
    string public constant SUBJECT = "LABS:stellar:subject";
    string public constant CREDENTIAL_TYPE = "VerifiableCredential";
    
    // ===== EVENTS FOR VERIFICATION =====
    event LABSBridged(
        string indexed LABS,
        address indexed owner,
        string publicKey,
        string serviceEndpoint,
        uint256 timestamp,
        address indexed bridgeOperator
    );
    
    event ContractPaused(
        address indexed pauser,
        uint256 timestamp,
        string reason
    );
    
    event ContractUnpaused(
        address indexed unpauser,
        uint256 timestamp,
        string reason
    );
    
    event TokensMinted(
        address indexed to,
        address indexed minter,
        uint256 amount,
        uint256 totalSupply,
        uint256 timestamp
    );
    
    event ExecutionFailed(
        string indexed LABS,
        address indexed owner,
        address indexed target,
        uint256 value,
        bytes data,
        string reason,
        uint256 timestamp
    );
    
    function setUp() public {
        // Deploy contracts
        vm.startPrank(owner);
        
        governanceToken = new EnhancedLABSGovernanceToken();
        LABSRegistry = new EnhancedLABSRegistry();
        
        // Setup timelock
        address[] memory proposers = new address[](1);
        proposers[0] = address(governor);
        address[] memory executors = new address[](1);
        executors[0] = address(governor);
        
        timelock = new TimelockController(
            1 days, // delay
            proposers,
            executors,
            owner
        );
        
        // Deploy governor
        governor = new EnhancedLABSGovernor(
            governanceToken,
            timelock
        );
        
        // Setup roles
        LABSRegistry.grantRole(LABSRegistry.ADMIN_ROLE(), admin);
        LABSRegistry.addPauser(pauser1);
        LABSRegistry.addPauser(pauser2);
        LABSRegistry.addPauser(pauser3);
        
        governanceToken.addMinter(admin);
        governanceToken.addPauser(pauser1);
        governanceToken.addPauser(pauser2);
        
        governor.grantEmergencyRole(admin);
        governor.addPauser(pauser1);
        governor.addPauser(pauser2);
        governor.addPauser(pauser3);
        
        // Transfer some tokens to users for voting
        governanceToken.transfer(user1, 1000000 * 10**18);
        governanceToken.transfer(user2, 1000000 * 10**18);
        
        vm.stopPrank();
    }
    
    // ===== TEST #144: IMPROVED ERROR HANDLING =====
    
    /**
     * @dev Test custom error types provide detailed debugging information
     */
    function test_CustomErrorHandling() public {
        vm.startPrank(admin);
        
        // Test LABSAlreadyExists error with detailed info
        LABSRegistry.bridgeLABS(LABS, user1, PUBLIC_KEY, SERVICE_ENDPOINT);
        
        vm.expectRevert(
            abi.encodeWithSelector(
                EnhancedLABSRegistry.LABSAlreadyExists.selector,
                LABS,
                user1
            )
        );
        LABSRegistry.bridgeLABS(LABS, user2, PUBLIC_KEY, SERVICE_ENDPOINT);
        
        // Test UnauthorizedLABSOperation error
        vm.stopPrank();
        vm.startPrank(user2);
        
        vm.expectRevert(
            abi.encodeWithSelector(
                EnhancedLABSRegistry.UnauthorizedLABSOperation.selector,
                user2,
                LABS,
                user1
            )
        );
        LABSRegistry.updateLABS(LABS, "new_key", SERVICE_ENDPOINT);
        
        // Test InvalidAddress error
        vm.startPrank(admin);
        
        vm.expectRevert(
            abi.encodeWithSelector(
                EnhancedLABSRegistry.ZeroAddress.selector,
                "address"
            )
        );
        LABSRegistry.bridgeLABS(LABS, address(0), PUBLIC_KEY, SERVICE_ENDPOINT);
        
        // Test StringTooLong error
        string memory longString = new string(300);
        for (uint i = 0; i < 300; i++) {
            longString = string(abi.encodePacked(longString, "a"));
        }
        
        vm.expectRevert(
            abi.encodeWithSelector(
                EnhancedLABSRegistry.StringTooLong.selector,
                "LABS",
                300,
                256
            )
        );
        LABSRegistry.bridgeLABS(longString, user1, PUBLIC_KEY, SERVICE_ENDPOINT);
        
        vm.stopPrank();
    }
    
    /**
     * @dev Test governance token error handling
     */
    function test_GovernanceTokenErrorHandling() public {
        vm.startPrank(admin);
        
        // Test ExceedsMintLimit error
        uint256 largeAmount = 2000000 * 10**18; // 2 million tokens
        
        vm.expectRevert(
            abi.encodeWithSelector(
                EnhancedLABSGovernanceToken.ExceedsMintLimit.selector,
                largeAmount,
                1000000 * 10**18
            )
        );
        governanceToken.mint(user1, largeAmount);
        
        // Test InsufficientBalance error
        vm.stopPrank();
        vm.startPrank(user1);
        
        vm.expectRevert(
            abi.encodeWithSelector(
                EnhancedLABSGovernanceToken.InsufficientBalance.selector,
                user1,
                2000000 * 10**18,
                1000000 * 10**18
            )
        );
        governanceToken.transfer(user2, 2000000 * 10**18);
        
        vm.stopPrank();
    }
    
    // ===== TEST #143: REENTRANCY PROTECTION =====
    
    /**
     * @dev Test reentrancy protection on execute function
     */
    function test_ReentrancyProtection() public {
        // Deploy malicious contract that attempts reentrancy
        vm.startPrank(admin);
        
        // First create a LABS for user1
        LABSRegistry.bridgeLABS(LABS, user1, PUBLIC_KEY, SERVICE_ENDPOINT);
        
        // Deploy malicious contract
        MaliciousContract malicious = new MaliciousContract(address(LABSRegistry));
        
        // Give malicious contract some ETH to attempt reentrancy
        vm.deal(address(malicious), 1 ether);
        
        // Attempt reentrancy attack - should fail
        vm.expectRevert(
            abi.encodeWithSelector(
                EnhancedLABSRegistry.ReentrantCall.selector
            )
        );
        malicious.attemptReentrancy{value: 0.1 ether}();
        
        vm.stopPrank();
    }
    
    /**
     * @dev Test reentrancy protection on token operations
     */
    function test_TokenReentrancyProtection() public {
        vm.startPrank(admin);
        
        // Deploy malicious token contract
        MaliciousTokenContract maliciousToken = new MaliciousTokenContract(address(governanceToken));
        
        // Attempt reentrancy during mint
        vm.expectRevert(
            abi.encodeWithSelector(
                EnhancedLABSGovernanceToken.ReentrantCall.selector
            )
        );
        maliciousToken.attemptReentrancyMint();
        
        vm.stopPrank();
    }
    
    // ===== TEST #142: PAUSABLE CONTRACT PATTERN =====
    
    /**
     * @dev Test multi-sig pause functionality
     */
    function test_MultiSigPause() public {
        // Initiate pause
        vm.startPrank(pauser1);
        LABSRegistry.initiatePause("Security concern detected");
        
        // Verify pause is not yet active (needs more signatures)
        assertTrue(!LABSRegistry.paused());
        
        // Add second signature
        vm.stopPrank();
        vm.startPrank(pauser2);
        LABSRegistry.signPause();
        
        // Add third signature - should activate pause
        vm.stopPrank();
        vm.startPrank(pauser3);
        
        // Fast forward past delay
        vm.warp(block.timestamp + 25 hours);
        
        vm.expectEmit(true, true, true, true);
        emit ContractPaused(pauser3, block.timestamp, "Multi-sig pause activated");
        
        LABSRegistry.signPause();
        
        // Verify contract is paused
        assertTrue(LABSRegistry.paused());
        
        // Test operations are blocked when paused
        vm.stopPrank();
        vm.startPrank(admin);
        
        vm.expectRevert(
            abi.encodeWithSelector(
                EnhancedLABSRegistry.ContractPaused.selector
            )
        );
        LABSRegistry.bridgeLABS("LABS:stellar:new", user1, PUBLIC_KEY, SERVICE_ENDPOINT);
        
        vm.stopPrank();
    }
    
    /**
     * @dev Test emergency pause by admin
     */
    function test_EmergencyPause() public {
        vm.startPrank(admin);
        
        vm.expectEmit(true, true, true, true);
        emit ContractPaused(admin, block.timestamp, "Critical vulnerability detected");
        
        LABSRegistry.emergencyPause("Critical vulnerability detected");
        
        assertTrue(LABSRegistry.paused());
        
        vm.stopPrank();
    }
    
    /**
     * @dev Test unpause functionality
     */
    function test_Unpause() public {
        // First pause the contract
        vm.startPrank(admin);
        LABSRegistry.emergencyPause("Test pause");
        assertTrue(LABSRegistry.paused());
        
        // Then unpause
        vm.expectEmit(true, true, true, true);
        emit ContractUnpaused(admin, block.timestamp, "Issue resolved");
        
        LABSRegistry.unpause("Issue resolved");
        
        // Verify operations work again
        LABSRegistry.bridgeLABS("LABS:stellar:new", user1, PUBLIC_KEY, SERVICE_ENDPOINT);
        
        vm.stopPrank();
    }
    
    /**
     * @dev Test governance pause functionality
     */
    function test_GovernancePause() public {
        // Test governor pause
        vm.startPrank(pauser1);
        governor.initiatePause("Governance security concern");
        
        // Add signatures and wait for delay
        vm.stopPrank();
        vm.startPrank(pauser2);
        governor.signPause();
        
        vm.stopPrank();
        vm.startPrank(pauser3);
        vm.warp(block.timestamp + 25 hours);
        
        governor.signPause();
        
        assertTrue(governor.paused());
        
        // Test governance operations are blocked
        vm.stopPrank();
        vm.startPrank(user1);
        
        vm.expectRevert(
            abi.encodeWithSelector(
                EnhancedLABSGovernor.ContractPaused.selector
            )
        );
        governor.castVote(1, 1); // Should fail when paused
        
        vm.stopPrank();
    }
    
    // ===== TEST #141: COMPREHENSIVE EVENT LOGGING =====
    
    /**
     * @dev Test comprehensive LABS events with indexed parameters
     */
    function test_LABSEventLogging() public {
        vm.startPrank(admin);
        
        // Test LABSBridged event with all parameters
        vm.expectEmit(true, true, false, true, false, true);
        emit LABSBridged(
            LABS,
            user1,
            PUBLIC_KEY,
            SERVICE_ENDPOINT,
            block.timestamp,
            admin
        );
        
        LABSRegistry.bridgeLABS(LABS, user1, PUBLIC_KEY, SERVICE_ENDPOINT);
        
        // Test LABSUpdated event
        vm.expectEmit(true, true, true, true, false, true);
        emit EnhancedLABSRegistry.LABSUpdated(
            LABS,
            user1,
            block.timestamp,
            block.timestamp + 1,
            "publicKey",
            user1
        );
        
        vm.stopPrank();
        vm.startPrank(user1);
        
        LABSRegistry.updateLABS(LABS, "updated_public_key", SERVICE_ENDPOINT);
        
        // Test LABSOwnershipTransferred event
        vm.expectEmit(true, true, true, true);
        emit EnhancedLABSRegistry.LABSOwnershipTransferred(
            LABS,
            user1,
            user2,
            block.timestamp
        );
        
        LABSRegistry.transferLABSOwnership(LABS, user2);
        
        vm.stopPrank();
    }
    
    /**
     * @dev Test credential events
     */
    function test_CredentialEventLogging() public {
        vm.startPrank(admin);
        
        // Test CredentialBridged event
        vm.expectEmit(true, true, true, false, false, false, true);
        emit EnhancedLABSRegistry.CredentialBridged(
            CREDENTIAL_ID,
            ISSUER,
            SUBJECT,
            CREDENTIAL_TYPE,
            block.timestamp + 30 days,
            bytes32(0x123),
            block.timestamp
        );
        
        LABSRegistry.bridgeCredential(
            CREDENTIAL_ID,
            ISSUER,
            SUBJECT,
            CREDENTIAL_TYPE,
            block.timestamp + 30 days,
            bytes32(0x123)
        );
        
        // Test CredentialRevoked event
        vm.expectEmit(true, true, true, true);
        emit EnhancedLABSRegistry.CredentialRevoked(
            CREDENTIAL_ID,
            ISSUER,
            block.timestamp,
            admin
        );
        
        LABSRegistry.revokeCredential(CREDENTIAL_ID);
        
        vm.stopPrank();
    }
    
    /**
     * @dev Test token events
     */
    function test_TokenEventLogging() public {
        vm.startPrank(admin);
        
        uint256 mintAmount = 100000 * 10**18;
        
        // Test TokensMinted event
        vm.expectEmit(true, true, true, true, true);
        emit TokensMinted(
            user1,
            admin,
            mintAmount,
            governanceToken.totalSupply() + mintAmount,
            block.timestamp
        );
        
        governanceToken.mint(user1, mintAmount);
        
        // Test TransferEnhanced event
        vm.expectEmit(true, true, true, true, false, true);
        emit EnhancedLABSGovernanceToken.TransferEnhanced(
            user1,
            user2,
            user1,
            50000 * 10**18,
            "",
            block.timestamp
        );
        
        vm.stopPrank();
        vm.startPrank(user1);
        
        governanceToken.transfer(user2, 50000 * 10**18);
        
        vm.stopPrank();
    }
    
    /**
     * @dev Test execution events
     */
    function test_ExecutionEventLogging() public {
        vm.startPrank(admin);
        
        // Create LABS first
        LABSRegistry.bridgeLABS(LABS, user1, PUBLIC_KEY, SERVICE_ENDPOINT);
        
        // Test ExecutionFailed event
        vm.stopPrank();
        vm.startPrank(user1);
        
        vm.expectEmit(true, true, true, true, true, true, true);
        emit ExecutionFailed(
            LABS,
            user1,
            address(0xdead),
            0,
            abi.encodeWithSignature("nonExistentFunction()"),
            "Transaction reverted silently",
            block.timestamp
        );
        
        // This should fail and emit ExecutionFailed
        LABSRegistry.execute(
            1,
            address(0xdead), // Non-existent contract
            0,
            abi.encodeWithSignature("nonExistentFunction()")
        );
        
        vm.stopPrank();
    }
    
    // ===== INTEGRATION TESTS =====
    
    /**
     * @dev Test complete security workflow
     */
    function test_CompleteSecurityWorkflow() public {
        // 1. Normal operations work
        vm.startPrank(admin);
        LABSRegistry.bridgeLABS(LABS, user1, PUBLIC_KEY, SERVICE_ENDPOINT);
        
        // 2. Events are properly emitted
        vm.expectEmit(true, true, true, true);
        emit EnhancedLABSRegistry.LABSOwnershipTransferred(
            LABS,
            user1,
            user2,
            block.timestamp
        );
        
        vm.stopPrank();
        vm.startPrank(user1);
        LABSRegistry.transferLABSOwnership(LABS, user2);
        
        // 3. Multi-sig pause works
        vm.startPrank(pauser1);
        LABSRegistry.initiatePause("Security audit");
        
        vm.stopPrank();
        vm.startPrank(pauser2);
        LABSRegistry.signPause();
        
        vm.stopPrank();
        vm.startPrank(pauser3);
        vm.warp(block.timestamp + 25 hours);
        LABSRegistry.signPause();
        
        // 4. Operations are blocked when paused
        assertTrue(LABSRegistry.paused());
        
        vm.stopPrank();
        vm.startPrank(admin);
        vm.expectRevert(EnhancedLABSRegistry.ContractPaused.selector);
        LABSRegistry.bridgeLABS("LABS:stellar:new", user1, PUBLIC_KEY, SERVICE_ENDPOINT);
        
        // 5. Unpause restores functionality
        LABSRegistry.unpause("Audit complete");
        assertFalse(LABSRegistry.paused());
        
        // 6. Operations work again
        LABSRegistry.bridgeLABS("LABS:stellar:new", user1, PUBLIC_KEY, SERVICE_ENDPOINT);
        
        vm.stopPrank();
    }
    
    /**
     * @dev Test error handling provides debugging info
     */
    function test_DebuggingInformation() public {
        vm.startPrank(admin);
        
        // Create initial LABS
        LABSRegistry.bridgeLABS(LABS, user1, PUBLIC_KEY, SERVICE_ENDPOINT);
        
        // Try to create duplicate - error includes LABS and current owner
        vm.expectRevert(
            abi.encodeWithSelector(
                EnhancedLABSRegistry.LABSAlreadyExists.selector,
                LABS,
                user1
            )
        );
        LABSRegistry.bridgeLABS(LABS, user2, PUBLIC_KEY, SERVICE_ENDPOINT);
        
        // Try unauthorized operation - error includes caller, LABS, and owner
        vm.stopPrank();
        vm.startPrank(user2);
        
        vm.expectRevert(
            abi.encodeWithSelector(
                EnhancedLABSRegistry.UnauthorizedLABSOperation.selector,
                user2,
                LABS,
                user1
            )
        );
        LABSRegistry.updateLABS(LABS, "new_key", SERVICE_ENDPOINT);
        
        vm.stopPrank();
    }
}

/**
 * @title MaliciousContract
 * @dev Contract to test reentrancy protection
 */
contract MaliciousContract {
    EnhancedLABSRegistry public target;
    uint256 public attackCount;
    
    constructor(address _target) {
        target = EnhancedLABSRegistry(_target);
    }
    
    function attemptReentrancy() external payable {
        attackCount++;
        // Attempt to call back into the contract
        target.execute(
            1,
            address(this),
            0,
            abi.encodeWithSignature("callback()")
        );
    }
    
    function callback() external {
        if (attackCount < 3) {
            // Try reentrancy again
            target.execute(
                1,
                address(this),
                0,
                abi.encodeWithSignature("callback()")
            );
        }
    }
    
    receive() external payable {}
}

/**
 * @title MaliciousTokenContract
 * @dev Contract to test token reentrancy protection
 */
contract MaliciousTokenContract {
    EnhancedLABSGovernanceToken public target;
    uint256 public attackCount;
    
    constructor(address _target) {
        target = EnhancedLABSGovernanceToken(_target);
    }
    
    function attemptReentrancyMint() external {
        attackCount++;
        target.mint(address(this), 100 * 10**18);
    }
    
    receive() external payable {
        if (attackCount < 3) {
            target.mint(address(this), 100 * 10**18);
        }
    }
}
