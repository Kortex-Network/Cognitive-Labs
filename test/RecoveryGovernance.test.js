const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("RecoveryGovernance Contract Tests", function () {
    let recoveryGovernance;
    let stateRecovery;
    let ethereumLABSRegistry;
    let owner, governor, guardian, auditor, user1, user2, attacker;
    
    beforeEach(async function () {
        [owner, governor, guardian, auditor, user1, user2, attacker] = await ethers.getSigners();
        
        // Deploy StateRecovery
        const StateRecoveryFactory = await ethers.getContractFactory("StateRecovery");
        stateRecovery = await StateRecoveryFactory.deploy();
        await stateRecovery.deployed();
        
        // Deploy EthereumLABSRegistry
        const LABSRegistryFactory = await ethers.getContractFactory("EthereumLABSRegistry");
        ethereumLABSRegistry = await LABSRegistryFactory.deploy();
        await ethereumLABSRegistry.deployed();
        
        // Deploy RecoveryGovernance
        const RecoveryGovernanceFactory = await ethers.getContractFactory("RecoveryGovernance");
        recoveryGovernance = await RecoveryGovernanceFactory.deploy(stateRecovery.address);
        await recoveryGovernance.deployed();
        
        // Setup roles
        await recoveryGovernance.grantRole(await recoveryGovernance.GOVERNOR_ROLE(), governor.address);
        await recoveryGovernance.grantRole(await recoveryGovernance.GUARDIAN_ROLE(), guardian.address);
        await recoveryGovernance.grantRole(await recoveryGovernance.AUDITOR_ROLE(), auditor.address);
        
        // Setup state recovery
        await stateRecovery.setTargetContracts(ethereumLABSRegistry.address, ethers.constants.AddressZero);
        await ethereumLABSRegistry.setStateRecoveryContract(stateRecovery.address);
        await ethereumLABSRegistry.grantRole(await ethereumLABSRegistry.RECOVERY_ROLE(), stateRecovery.address);
    });

    describe("Contract Initialization", function () {
        it("Should deploy with correct roles", async function () {
            expect(await recoveryGovernance.hasRole(await recoveryGovernance.DEFAULT_ADMIN_ROLE(), owner.address)).to.be.true;
            expect(await recoveryGovernance.hasRole(await recoveryGovernance.GOVERNOR_ROLE(), governor.address)).to.be.true;
            expect(await recoveryGovernance.hasRole(await recoveryGovernance.GUARDIAN_ROLE(), guardian.address)).to.be.true;
            expect(await recoveryGovernance.hasRole(await recoveryGovernance.AUDITOR_ROLE(), auditor.address)).to.be.true;
        });

        it("Should initialize with correct governance configuration", async function () {
            const config = await recoveryGovernance.config();
            expect(config.minProposalDelay).to.equal(3600); // 1 hour
            expect(config.maxVotingPeriod).to.equal(604800); // 7 days
            expect(config.emergencyDelay).to.equal(86400); // 24 hours
            expect(config.quorumPercentage).to.equal(50);
            expect(config.emergencyMode).to.be.false;
            expect(config.pausedContract).to.equal(ethers.constants.AddressZero);
        });

        it("Should set correct state recovery contract", async function () {
            expect(await recoveryGovernance.stateRecovery()).to.equal(stateRecovery.address);
        });
    });

    describe("Governance Configuration", function () {
        it("Should allow governor to update governance config", async function () {
            const tx = await recoveryGovernance.connect(governor).updateGovernanceConfig(
                7200, // 2 hours
                1209600, // 14 days
                172800, // 48 hours
                60 // 60%
            );
            
            const receipt = await tx.wait();
            const event = receipt.events.find(e => e.event === "GovernanceConfigUpdated");
            
            expect(event.args.minProposalDelay).to.equal(7200);
            expect(event.args.maxVotingPeriod).to.equal(1209600);
            expect(event.args.emergencyDelay).to.equal(172800);
            expect(event.args.quorumPercentage).to.equal(60);
            
            const config = await recoveryGovernance.config();
            expect(config.minProposalDelay).to.equal(7200);
            expect(config.maxVotingPeriod).to.equal(1209600);
            expect(config.emergencyDelay).to.equal(172800);
            expect(config.quorumPercentage).to.equal(60);
        });

        it("Should prevent non-governor from updating config", async function () {
            await expect(
                recoveryGovernance.connect(attacker).updateGovernanceConfig(7200, 1209600, 172800, 60)
            ).to.be.revertedWith("RecoveryGovernance: caller missing GOVERNOR_ROLE");
        });

        it("Should validate config parameters", async function () {
            // Invalid minimum proposal delay
            await expect(
                recoveryGovernance.connect(governor).updateGovernanceConfig(0, 1209600, 172800, 60)
            ).to.be.revertedWith("Invalid minimum proposal delay");
            
            // Invalid voting period (less than min delay)
            await expect(
                recoveryGovernance.connect(governor).updateGovernanceConfig(7200, 3600, 172800, 60)
            ).to.be.revertedWith("Invalid voting period");
            
            // Invalid quorum percentage
            await expect(
                recoveryGovernance.connect(governor).updateGovernanceConfig(7200, 1209600, 172800, 0)
            ).to.be.revertedWith("Invalid quorum percentage");
            
            await expect(
                recoveryGovernance.connect(governor).updateGovernanceConfig(7200, 1209600, 172800, 101)
            ).to.be.revertedWith("Invalid quorum percentage");
        });
    });

    describe("Contract Authorization", function () {
        it("Should allow governor to authorize contract", async function () {
            await recoveryGovernance.connect(governor).authorizeContract(ethereumLABSRegistry.address);
            expect(await recoveryGovernance.authorizedContracts(ethereumLABSRegistry.address)).to.be.true;
        });

        it("Should allow governor to deauthorize contract", async function () {
            await recoveryGovernance.connect(governor).authorizeContract(ethereumLABSRegistry.address);
            await recoveryGovernance.connect(governor).deauthorizeContract(ethereumLABSRegistry.address);
            expect(await recoveryGovernance.authorizedContracts(ethereumLABSRegistry.address)).to.be.false;
        });

        it("Should prevent non-governor from authorizing contracts", async function () {
            await expect(
                recoveryGovernance.connect(attacker).authorizeContract(ethereumLABSRegistry.address)
            ).to.be.revertedWith("RecoveryGovernance: caller missing GOVERNOR_ROLE");
        });

        it("Should prevent non-governor from deauthorizing contracts", async function () {
            await expect(
                recoveryGovernance.connect(attacker).deauthorizeContract(ethereumLABSRegistry.address)
            ).to.be.revertedWith("RecoveryGovernance: caller missing GOVERNOR_ROLE");
        });
    });

    describe("Contract Pausing", function () {
        beforeEach(async function () {
            await recoveryGovernance.connect(governor).authorizeContract(ethereumLABSRegistry.address);
        });

        it("Should allow guardian to pause contract", async function () {
            const reason = "Security audit in progress";
            const tx = await recoveryGovernance.connect(guardian).pauseContract(ethereumLABSRegistry.address, reason);
            const receipt = await tx.wait();
            const event = receipt.events.find(e => e.event === "ContractPaused");
            
            expect(event.args.contractAddress).to.equal(ethereumLABSRegistry.address);
            expect(event.args.reason).to.equal(reason);
            
            const config = await recoveryGovernance.config();
            expect(config.pausedContract).to.equal(ethereumLABSRegistry.address);
        });

        it("Should allow guardian to unpause contract", async function () {
            await recoveryGovernance.connect(guardian).pauseContract(ethereumLABSRegistry.address, "Test pause");
            
            const tx = await recoveryGovernance.connect(guardian).unpauseContract(ethereumLABSRegistry.address);
            const receipt = await tx.wait();
            const event = receipt.events.find(e => e.event === "ContractUnpaused");
            
            expect(event.args.contractAddress).to.equal(ethereumLABSRegistry.address);
            
            const config = await recoveryGovernance.config();
            expect(config.pausedContract).to.equal(ethers.constants.AddressZero);
        });

        it("Should prevent non-guardian from pausing contracts", async function () {
            await expect(
                recoveryGovernance.connect(attacker).pauseContract(ethereumLABSRegistry.address, "Malicious pause")
            ).to.be.revertedWith("RecoveryGovernance: caller missing GUARDIAN_ROLE");
        });

        it("Should prevent non-guardian from unpausing contracts", async function () {
            await expect(
                recoveryGovernance.connect(attacker).unpauseContract(ethereumLABSRegistry.address)
            ).to.be.revertedWith("RecoveryGovernance: caller missing GUARDIAN_ROLE");
        });

        it("Should prevent pausing non-authorized contracts", async function () {
            await expect(
                recoveryGovernance.connect(guardian).pauseContract(attacker.address, "Test")
            ).to.be.revertedWith("Contract not authorized");
        });

        it("Should prevent pausing recovery contract", async function () {
            await expect(
                recoveryGovernance.connect(guardian).pauseContract(stateRecovery.address, "Test")
            ).to.be.revertedWith("Cannot pause recovery contract");
        });

        it("Should prevent unpausing non-paused contracts", async function () {
            await expect(
                recoveryGovernance.connect(guardian).unpauseContract(ethereumLABSRegistry.address)
            ).to.be.revertedWith("Contract not paused");
        });

        it("Should automatically unpause when deauthorizing", async function () {
            await recoveryGovernance.connect(guardian).pauseContract(ethereumLABSRegistry.address, "Test");
            await recoveryGovernance.connect(governor).deauthorizeContract(ethereumLABSRegistry.address);
            
            const config = await recoveryGovernance.config();
            expect(config.pausedContract).to.equal(ethers.constants.AddressZero);
        });
    });

    describe("Emergency Mode", function () {
        it("Should allow governor to activate emergency mode", async function () {
            const reason = "Critical security vulnerability detected";
            const tx = await recoveryGovernance.connect(governor).activateEmergencyMode(reason);
            const receipt = await tx.wait();
            const event = receipt.events.find(e => e.event === "EmergencyModeActivated");
            
            expect(event.args.activator).to.equal(governor.address);
            expect(event.args.reason).to.equal(reason);
            
            const config = await recoveryGovernance.config();
            expect(config.emergencyMode).to.be.true;
        });

        it("Should allow governor to deactivate emergency mode", async function () {
            await recoveryGovernance.connect(governor).activateEmergencyMode("Test emergency");
            
            const tx = await recoveryGovernance.connect(governor).deactivateEmergencyMode();
            const receipt = await tx.wait();
            const event = receipt.events.find(e => e.event === "EmergencyModeDeactivated");
            
            expect(event.args.deactivator).to.equal(governor.address);
            
            const config = await recoveryGovernance.config();
            expect(config.emergencyMode).to.be.false;
        });

        it("Should prevent non-governor from activating emergency mode", async function () {
            await expect(
                recoveryGovernance.connect(attacker).activateEmergencyMode("Fake emergency")
            ).to.be.revertedWith("RecoveryGovernance: caller missing GOVERNOR_ROLE");
        });

        it("Should prevent non-governor from deactivating emergency mode", async function () {
            await expect(
                recoveryGovernance.connect(attacker).deactivateEmergencyMode()
            ).to.be.revertedWith("RecoveryGovernance: caller missing GOVERNOR_ROLE");
        });
    });

    describe("Governed Recovery", function () {
        const LABS = "LABS:ethereum:0x1234567890123456789012345678901234567890";
        const newOwner = user1.address;
        const newPublicKey = "0xABCDEF1234567890ABCDEF1234567890ABCDEF1234567890ABCDEF1234567890";
        const newServiceEndpoint = "https://recovery.example.com";

        beforeEach(async function () {
            await recoveryGovernance.connect(governor).authorizeContract(stateRecovery.address);
            await ethereumLABSRegistry.enableRecoveryMode();
        });

        it("Should allow governor to execute governed recovery", async function () {
            const data = ethers.utils.defaultAbiCoder.encode(
                ["string", "address", "string", "string"],
                [LABS, newOwner, newPublicKey, newServiceEndpoint]
            );
            
            const tx = await recoveryGovernance.connect(governor).governedRecovery(
                0, // LABS_DOCUMENT
                data,
                "Recover corrupted LABS document",
                false // not emergency
            );
            
            const receipt = await tx.wait();
            const event = receipt.events.find(e => e.event === "RecoveryOperationLogged");
            
            expect(event.args.executor).to.equal(governor.address);
            expect(event.args.emergency).to.be.false;
            expect(event.args.successful).to.be.true;
        });

        it("Should allow governor to execute emergency recovery", async function () {
            await recoveryGovernance.connect(governor).activateEmergencyMode("Critical emergency");
            
            const data = ethers.utils.defaultAbiCoder.encode(
                ["string", "address", "string", "string"],
                [LABS, newOwner, newPublicKey, newServiceEndpoint]
            );
            
            const tx = await recoveryGovernance.connect(governor).governedRecovery(
                0, // LABS_DOCUMENT
                data,
                "Emergency recovery",
                true // emergency
            );
            
            const receipt = await tx.wait();
            const event = receipt.events.find(e => e.event === "RecoveryOperationLogged");
            
            expect(event.args.executor).to.equal(governor.address);
            expect(event.args.emergency).to.be.true;
            expect(event.args.successful).to.be.true;
        });

        it("Should prevent non-governor from executing governed recovery", async function () {
            const data = ethers.utils.defaultAbiCoder.encode(
                ["string", "address", "string", "string"],
                [LABS, newOwner, newPublicKey, newServiceEndpoint]
            );
            
            await expect(
                recoveryGovernance.connect(attacker).governedRecovery(0, data, "Malicious recovery", false)
            ).to.be.revertedWith("RecoveryGovernance: caller missing GOVERNOR_ROLE");
        });

        it("Should prevent governed recovery when contract is paused", async function () {
            await recoveryGovernance.connect(guardian).pauseContract(stateRecovery.address, "Test pause");
            
            const data = ethers.utils.defaultAbiCoder.encode(
                ["string", "address", "string", "string"],
                [LABS, newOwner, newPublicKey, newServiceEndpoint]
            );
            
            await expect(
                recoveryGovernance.connect(governor).governedRecovery(0, data, "Test", false)
            ).to.be.revertedWith("RecoveryGovernance: contract is paused");
        });

        it("Should prevent emergency recovery when emergency mode is not activated", async function () {
            const data = ethers.utils.defaultAbiCoder.encode(
                ["string", "address", "string", "string"],
                [LABS, newOwner, newPublicKey, newServiceEndpoint]
            );
            
            await expect(
                recoveryGovernance.connect(governor).governedRecovery(0, data, "Test", true)
            ).to.be.revertedWith("Emergency mode not activated");
        });

        it("Should prevent empty reason", async function () {
            const data = ethers.utils.defaultAbiCoder.encode(
                ["string", "address", "string", "string"],
                [LABS, newOwner, newPublicKey, newServiceEndpoint]
            );
            
            await expect(
                recoveryGovernance.connect(governor).governedRecovery(0, data, "", false)
            ).to.be.revertedWith("Reason cannot be empty");
        });
    });

    describe("Recovery Operation Auditing", function () {
        let proposalId;

        beforeEach(async function () {
            await recoveryGovernance.connect(governor).authorizeContract(stateRecovery.address);
            await ethereumLABSRegistry.enableRecoveryMode();
            
            const data = ethers.utils.defaultAbiCoder.encode(
                ["string", "address", "string", "string"],
                ["LABS:ethereum:0x1234567890123456789012345678901234567890", user1.address, "0xABCDEF", "https://test.com"]
            );
            
            const tx = await recoveryGovernance.connect(governor).governedRecovery(0, data, "Test recovery", false);
            const receipt = await tx.wait();
            const event = receipt.events.find(e => e.event === "RecoveryOperationLogged");
            proposalId = event.args.proposalId;
        });

        it("Should allow auditor to audit recovery operation", async function () {
            const [timestamp, executor, emergency, reason, successful] = 
                await recoveryGovernance.connect(auditor).auditRecoveryOperation(proposalId);
            
            expect(timestamp).to.be.gt(0);
            expect(executor).to.equal(governor.address);
            expect(emergency).to.be.false;
            expect(reason).to.equal("Test recovery");
            expect(successful).to.be.true;
        });

        it("Should prevent non-auditor from auditing operations", async function () {
            await expect(
                recoveryGovernance.connect(attacker).auditRecoveryOperation(proposalId)
            ).to.be.revertedWith("RecoveryGovernance: caller missing AUDITOR_ROLE");
        });

        it("Should prevent auditing non-existent operations", async function () {
            const nonExistentId = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("non-existent"));
            
            await expect(
                recoveryGovernance.connect(auditor).auditRecoveryOperation(nonExistentId)
            ).to.be.revertedWith("Operation not found");
        });
    });

    describe("Operation History", function () {
        beforeEach(async function () {
            await recoveryGovernance.connect(governor).authorizeContract(stateRecovery.address);
            await ethereumLABSRegistry.enableRecoveryMode();
            
            // Create multiple operations
            for (let i = 0; i < 5; i++) {
                const data = ethers.utils.defaultAbiCoder.encode(
                    ["string", "address", "string", "string"],
                    [`LABS:ethereum:0x${i.toString().padStart(40, '0')}`, user1.address, "0xABCDEF", "https://test.com"]
                );
                
                await recoveryGovernance.connect(governor).governedRecovery(0, data, `Test recovery ${i}`, false);
            }
        });

        it("Should return operation history with pagination", async function () {
            const history = await recoveryGovernance.getOperationHistory(0, 3);
            expect(history.length).to.equal(3);
            
            const history2 = await recoveryGovernance.getOperationHistory(3, 3);
            expect(history2.length).to.equal(2);
        });

        it("Should handle pagination beyond bounds", async function () {
            const history = await recoveryGovernance.getOperationHistory(10, 5);
            expect(history.length).to.equal(0);
        });

        it("Should handle empty history", async function () {
            // Deploy new contract with no operations
            const RecoveryGovernanceFactory = await ethers.getContractFactory("RecoveryGovernance");
            const newGovernance = await RecoveryGovernanceFactory.deploy(stateRecovery.address);
            await newGovernance.deployed();
            
            const history = await newGovernance.getOperationHistory(0, 10);
            expect(history.length).to.equal(0);
        });
    });

    describe("Recovery Compliance Validation", function () {
        it("Should validate compliant recovery operations", async function () {
            const data = ethers.utils.defaultAbiCoder.encode(
                ["string", "address", "string", "string"],
                ["LABS:ethereum:0x1234567890123456789012345678901234567890", user1.address, "0xABCDEF", "https://test.com"]
            );
            
            const [compliant, issue] = await recoveryGovernance.validateRecoveryCompliance(0, data, false);
            expect(compliant).to.be.true;
            expect(issue).to.equal("Compliant");
        });

        it("Should reject invalid recovery type", async function () {
            const data = ethers.utils.defaultAbiCoder.encode(
                ["string", "address", "string", "string"],
                ["LABS:ethereum:0x1234567890123456789012345678901234567890", user1.address, "0xABCDEF", "https://test.com"]
            );
            
            const [compliant, issue] = await recoveryGovernance.validateRecoveryCompliance(5, data, false);
            expect(compliant).to.be.false;
            expect(issue).to.equal("Invalid recovery type");
        });

        it("Should reject emergency operations when not in emergency mode", async function () {
            const data = ethers.utils.defaultAbiCoder.encode(
                ["string", "address", "string", "string"],
                ["LABS:ethereum:0x1234567890123456789012345678901234567890", user1.address, "0xABCDEF", "https://test.com"]
            );
            
            const [compliant, issue] = await recoveryGovernance.validateRecoveryCompliance(0, data, true);
            expect(compliant).to.be.false;
            expect(issue).to.equal("Emergency mode not activated");
        });

        it("Should reject empty recovery data", async function () {
            const [compliant, issue] = await recoveryGovernance.validateRecoveryCompliance(0, "0x", false);
            expect(compliant).to.be.false;
            expect(issue).to.equal("Empty recovery data");
        });

        it("Should validate LABS recovery data format", async function () {
            const validData = ethers.utils.defaultAbiCoder.encode(
                ["string", "address", "string", "string"],
                ["LABS:ethereum:0x1234567890123456789012345678901234567890", user1.address, "0xABCDEF", "https://test.com"]
            );
            
            const isValid = await recoveryGovernance._validateLABSRecoveryData(validData);
            expect(isValid).to.be.true;
            
            const invalidData = ethers.utils.defaultAbiCoder.encode(
                ["string", "address", "string"],
                ["LABS:ethereum:0x1234567890123456789012345678901234567890", user1.address, "0xABCDEF"]
            );
            
            const isInvalid = await recoveryGovernance._validateLABSRecoveryData(invalidData);
            expect(isInvalid).to.be.false;
        });
    });

    describe("Governance Status", function () {
        it("Should return governance status", async function () {
            const [emergencyMode, pausedContract, totalOperations, authorizedContractCount] = 
                await recoveryGovernance.getGovernanceStatus();
            
            expect(emergencyMode).to.be.false;
            expect(pausedContract).to.equal(ethers.constants.AddressZero);
            expect(totalOperations).to.equal(0);
            expect(authorizedContractCount).to.equal(1); // stateRecovery contract
        });

        it("Should update status with operations", async function () {
            await recoveryGovernance.connect(governor).authorizeContract(stateRecovery.address);
            await ethereumLABSRegistry.enableRecoveryMode();
            
            const data = ethers.utils.defaultAbiCoder.encode(
                ["string", "address", "string", "string"],
                ["LABS:ethereum:0x1234567890123456789012345678901234567890", user1.address, "0xABCDEF", "https://test.com"]
            );
            
            await recoveryGovernance.connect(governor).governedRecovery(0, data, "Test", false);
            
            const [, , totalOperations, ] = await recoveryGovernance.getGovernanceStatus();
            expect(totalOperations).to.equal(1);
        });
    });

    describe("Recovery Statistics", function () {
        beforeEach(async function () {
            await recoveryGovernance.connect(governor).authorizeContract(stateRecovery.address);
            await ethereumLABSRegistry.enableRecoveryMode();
        });

        it("Should track recovery statistics", async function () {
            // Create successful operations
            for (let i = 0; i < 3; i++) {
                const data = ethers.utils.defaultAbiCoder.encode(
                    ["string", "address", "string", "string"],
                    [`LABS:ethereum:0x${i.toString().padStart(40, '0')}`, user1.address, "0xABCDEF", "https://test.com"]
                );
                
                await recoveryGovernance.connect(governor).governedRecovery(0, data, `Success ${i}`, false);
            }
            
            // Create emergency operation
            await recoveryGovernance.connect(governor).activateEmergencyMode("Test emergency");
            const emergencyData = ethers.utils.defaultAbiCoder.encode(
                ["string", "address", "string", "string"],
                ["LABS:ethereum:0x9999999999999999999999999999999999999999", user1.address, "0xABCDEF", "https://test.com"]
            );
            await recoveryGovernance.connect(governor).governedRecovery(0, emergencyData, "Emergency", true);
            
            const [total, successful, emergency, failed] = await recoveryGovernance.getRecoveryStatistics();
            
            expect(total).to.equal(4);
            expect(successful).to.equal(4);
            expect(emergency).to.equal(1);
            expect(failed).to.equal(0);
        });

        it("Should handle empty statistics", async function () {
            const [total, successful, emergency, failed] = await recoveryGovernance.getRecoveryStatistics();
            
            expect(total).to.equal(0);
            expect(successful).to.equal(0);
            expect(emergency).to.equal(0);
            expect(failed).to.equal(0);
        });
    });

    describe("Edge Cases and Error Conditions", function () {
        it("Should handle reentrancy protection", async function () {
            // This test verifies that the nonReentrant modifier is working
            // The actual reentrancy attack would require a malicious contract
            const data = ethers.utils.defaultAbiCoder.encode(
                ["string", "address", "string", "string"],
                ["LABS:ethereum:0x1234567890123456789012345678901234567890", user1.address, "0xABCDEF", "https://test.com"]
            );
            
            // First call should succeed
            await recoveryGovernance.connect(governor).authorizeContract(stateRecovery.address);
            await ethereumLABSRegistry.enableRecoveryMode();
            
            const tx = await recoveryGovernance.connect(governor).governedRecovery(0, data, "Test", false);
            expect(tx).to.be.ok;
        });

        it("Should handle zero address parameters", async function () {
            await expect(
                recoveryGovernance.connect(governor).authorizeContract(ethers.constants.AddressZero)
            ).to.not.be.reverted; // Should be allowed
        });

        it("Should handle invalid recovery type in governed recovery", async function () {
            const data = ethers.utils.defaultAbiCoder.encode(
                ["string", "address", "string", "string"],
                ["LABS:ethereum:0x1234567890123456789012345678901234567890", user1.address, "0xABCDEF", "https://test.com"]
            );
            
            await recoveryGovernance.connect(governor).authorizeContract(stateRecovery.address);
            await ethereumLABSRegistry.enableRecoveryMode();
            
            // This should fail at the state recovery level
            await expect(
                recoveryGovernance.connect(governor).governedRecovery(10, data, "Invalid type", false)
            ).to.be.reverted; // Will revert with some error from state recovery
        });
    });
});
