const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("Contract Integration Tests", function () {
    let LABSRegistry;
    let stateRecovery;
    let recoveryGovernance;
    let owner, admin, governor, guardian, auditor, issuer, recovery, user1, user2, user3, attacker;
    
    // Test constants
    const TEST_LABS = "LABS:ethereum:0x1234567890123456789012345678901234567890";
    const TEST_LABS_2 = "LABS:ethereum:0x9876543210987654321098765432109876543210";
    const TEST_PUBLIC_KEY = "0xABCDEF1234567890ABCDEF1234567890ABCDEF1234567890ABCDEF1234567890";
    const TEST_SERVICE_ENDPOINT = "https://LABS.example.com/endpoint";
    const TEST_CREDENTIAL_ID = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("test-credential"));

    beforeEach(async function () {
        [owner, admin, governor, guardian, auditor, issuer, recovery, user1, user2, user3, attacker] = await ethers.getSigners();
        
        // Deploy contracts in correct order
        const StateRecoveryFactory = await ethers.getContractFactory("StateRecovery");
        stateRecovery = await StateRecoveryFactory.deploy();
        await stateRecovery.deployed();
        
        const LABSRegistryFactory = await ethers.getContractFactory("EthereumLABSRegistry");
        LABSRegistry = await LABSRegistryFactory.deploy();
        await LABSRegistry.deployed();
        
        const RecoveryGovernanceFactory = await ethers.getContractFactory("RecoveryGovernance");
        recoveryGovernance = await RecoveryGovernanceFactory.deploy(stateRecovery.address);
        await recoveryGovernance.deployed();
        
        // Setup roles and permissions
        await setupRolesAndPermissions();
    });

    async function setupRolesAndPermissions() {
        // LABS Registry roles
        await LABSRegistry.grantRole(await LABSRegistry.ADMIN_ROLE(), admin.address);
        await LABSRegistry.grantRole(await LABSRegistry.ISSUER_ROLE(), issuer.address);
        await LABSRegistry.grantRole(await LABSRegistry.RECOVERY_ROLE(), recovery.address);
        
        // State Recovery roles
        await stateRecovery.grantRole(await stateRecovery.RECOVERY_ROLE(), recovery.address);
        await stateRecovery.grantRole(await stateRecovery.EMERGENCY_ROLE(), recovery.address);
        await stateRecovery.grantRole(await stateRecovery.GOVERNANCE_ROLE(), governor.address);
        
        // Recovery Governance roles
        await recoveryGovernance.grantRole(await recoveryGovernance.GOVERNOR_ROLE(), governor.address);
        await recoveryGovernance.grantRole(await recoveryGovernance.GUARDIAN_ROLE(), guardian.address);
        await recoveryGovernance.grantRole(await recoveryGovernance.AUDITOR_ROLE(), auditor.address);
        
        // Set up contract relationships
        await LABSRegistry.setStateRecoveryContract(stateRecovery.address);
        await stateRecovery.setTargetContracts(LABSRegistry.address, ethers.constants.AddressZero);
        await recoveryGovernance.connect(governor).authorizeContract(stateRecovery.address);
        
        // Grant recovery contract permissions
        await LABSRegistry.grantRole(await LABSRegistry.RECOVERY_ROLE(), stateRecovery.address);
        await stateRecovery.grantRole(await stateRecovery.RECOVERY_ROLE(), LABSRegistry.address);
    }

    describe("Complete LABS Lifecycle Integration", function () {
        it("Should handle complete LABS lifecycle with governance oversight", async function () {
            // 1. Bridge LABS to Ethereum
            await LABSRegistry.connect(admin).bridgeLABS(
                TEST_LABS,
                user1.address,
                TEST_PUBLIC_KEY,
                TEST_SERVICE_ENDPOINT
            );
            
            // Verify LABS was bridged
            let LABSDoc = await LABSRegistry.getLABSDocument(TEST_LABS);
            expect(LABSDoc.owner).to.equal(user1.address);
            expect(LABSDoc.publicKey).to.equal(TEST_PUBLIC_KEY);
            
            // 2. Add claims to LABS
            const claimTopic = 1;
            const claimScheme = 1;
            const claimSignature = ethers.utils.toUtf8Bytes("claim signature");
            const claimData = ethers.utils.toUtf8Bytes("claim data");
            const claimUri = "https://claim.example.com";
            
            await LABSRegistry.connect(user1).addClaim(claimTopic, claimScheme, issuer.address, claimSignature, claimData, claimUri);
            
            // 3. Bridge credential
            const expires = Math.floor(Date.now() / 1000) + 86400;
            const dataHash = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("credential data"));
            
            await LABSRegistry.connect(admin).bridgeCredential(
                TEST_CREDENTIAL_ID,
                "https://issuer.example.com",
                TEST_LABS,
                "VerificationCredential",
                expires,
                dataHash
            );
            
            // Verify credential was bridged
            const credential = await LABSRegistry.getCredential(TEST_CREDENTIAL_ID);
            expect(credential.issuer).to.equal("https://issuer.example.com");
            expect(credential.subject).to.equal(TEST_LABS);
            
            // 4. Simulate corruption and recovery through governance
            await LABSRegistry.connect(admin).enableRecoveryMode();
            
            const recoveryData = ethers.utils.defaultAbiCoder.encode(
                ["string", "address", "string", "string"],
                [TEST_LABS, user2.address, "0xNEWKEY1234567890ABCDEF1234567890ABCDEF1234567890ABCDEF1234567890", "https://new.endpoint.com"]
            );
            
            // 5. Governed recovery
            await recoveryGovernance.connect(governor).governedRecovery(
                0, // LABS_DOCUMENT
                recoveryData,
                "Recover LABS ownership",
                false
            );
            
            // Verify recovery was successful
            LABSDoc = await LABSRegistry.getLABSDocument(TEST_LABS);
            expect(LABSDoc.owner).to.equal(user2.address);
            expect(LABSDoc.publicKey).to.equal("0xNEWKEY1234567890ABCDEF1234567890ABCDEF1234567890ABCDEF1234567890");
            expect(LABSDoc.serviceEndpoint).to.equal("https://new.endpoint.com");
            
            // 6. Audit the recovery operation
            const history = await recoveryGovernance.getOperationHistory(0, 10);
            expect(history.length).to.be.greaterThan(0);
            
            const [timestamp, executor, emergency, reason, successful] = 
                await recoveryGovernance.connect(auditor).auditRecoveryOperation(history[0].proposalId);
            
            expect(executor).to.equal(governor.address);
            expect(emergency).to.be.false;
            expect(reason).to.equal("Recover LABS ownership");
            expect(successful).to.be.true;
        });

        it("Should handle emergency recovery scenario", async function () {
            // 1. Bridge LABS
            await LABSRegistry.connect(admin).bridgeLABS(TEST_LABS, user1.address, TEST_PUBLIC_KEY, TEST_SERVICE_ENDPOINT);
            
            // 2. Activate emergency mode
            await recoveryGovernance.connect(governor).activateEmergencyMode("Critical security vulnerability");
            
            // 3. Emergency recovery
            await LABSRegistry.connect(admin).enableRecoveryMode();
            
            const emergencyData = ethers.utils.defaultAbiCoder.encode(
                ["string", "address", "string", "string"],
                [TEST_LABS, user2.address, "0xEMERGENCYKEY", "https://emergency.endpoint.com"]
            );
            
            await recoveryGovernance.connect(governor).governedRecovery(
                0, // LABS_DOCUMENT
                emergencyData,
                "Emergency security recovery",
                true // emergency
            );
            
            // Verify emergency recovery
            const LABSDoc = await LABSRegistry.getLABSDocument(TEST_LABS);
            expect(LABSDoc.owner).to.equal(user2.address);
            expect(LABSDoc.publicKey).to.equal("0xEMERGENCYKEY");
            
            // 4. Verify emergency statistics
            const [total, successful, emergency, failed] = await recoveryGovernance.getRecoveryStatistics();
            expect(emergency).to.equal(1);
            expect(successful).to.equal(1);
            
            // 5. Deactivate emergency mode
            await recoveryGovernance.connect(governor).deactivateEmergencyMode();
            
            const config = await recoveryGovernance.config();
            expect(config.emergencyMode).to.be.false;
        });
    });

    describe("Cross-Contract State Consistency", function () {
        it("Should maintain state consistency across contracts", async function () {
            // 1. Create LABS
            await LABSRegistry.connect(admin).bridgeLABS(TEST_LABS, user1.address, TEST_PUBLIC_KEY, TEST_SERVICE_ENDPOINT);
            
            // 2. Add claims
            await LABSRegistry.connect(user1).addClaim(
                1, 1, issuer.address, 
                ethers.utils.toUtf8Bytes("sig1"), 
                ethers.utils.toUtf8Bytes("data1"), 
                "https://claim1.com"
            );
            
            await LABSRegistry.connect(user1).addClaim(
                2, 1, issuer.address, 
                ethers.utils.toUtf8Bytes("sig2"), 
                ethers.utils.toUtf8Bytes("data2"), 
                "https://claim2.com"
            );
            
            // 3. Verify state before recovery
            const LABSDocBefore = await LABSRegistry.getLABSDocument(TEST_LABS);
            const claimIds = await LABSRegistry.connect(user1).getClaimIdsByTopic(1);
            expect(claimIds.length).to.equal(1);
            
            // 4. Create state snapshot
            const merkleRoot = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("state snapshot"));
            const snapshotId = await stateRecovery.connect(recovery).createStateSnapshot(merkleRoot, "Pre-recovery snapshot");
            
            // 5. Perform recovery
            await LABSRegistry.connect(admin).enableRecoveryMode();
            
            const recoveryData = ethers.utils.defaultAbiCoder.encode(
                ["string", "address", "string", "string"],
                [TEST_LABS, user2.address, "0xRECOVEREDKEY", "https://recovered.endpoint.com"]
            );
            
            await recoveryGovernance.connect(governor).governedRecovery(0, recoveryData, "State consistency test", false);
            
            // 6. Verify state after recovery
            const LABSDocAfter = await LABSRegistry.getLABSDocument(TEST_LABS);
            expect(LABSDocAfter.owner).to.equal(user2.address);
            expect(LABSDocAfter.publicKey).to.equal("0xRECOVEREDKEY");
            
            // 7. Verify claims are still accessible (should be maintained)
            const claimIdsAfter = await LABSRegistry.connect(user2).getClaimIdsByTopic(1);
            expect(claimIdsAfter.length).to.equal(1);
        });

        it("Should handle concurrent operations safely", async function () {
            // 1. Bridge multiple LABSs
            await LABSRegistry.connect(admin).bridgeLABS(TEST_LABS, user1.address, TEST_PUBLIC_KEY, TEST_SERVICE_ENDPOINT);
            await LABSRegistry.connect(admin).bridgeLABS(TEST_LABS_2, user2.address, TEST_PUBLIC_KEY, TEST_SERVICE_ENDPOINT);
            
            // 2. Enable recovery mode
            await LABSRegistry.connect(admin).enableRecoveryMode();
            
            // 3. Create concurrent recovery proposals
            const recoveryData1 = ethers.utils.defaultAbiCoder.encode(
                ["string", "address", "string", "string"],
                [TEST_LABS, user3.address, "0xCONCURRENT1", "https://concurrent1.com"]
            );
            
            const recoveryData2 = ethers.utils.defaultAbiCoder.encode(
                ["string", "address", "string", "string"],
                [TEST_LABS_2, user3.address, "0xCONCURRENT2", "https://concurrent2.com"]
            );
            
            // 4. Execute recoveries through governance
            const tx1 = recoveryGovernance.connect(governor).governedRecovery(0, recoveryData1, "Concurrent recovery 1", false);
            const tx2 = recoveryGovernance.connect(governor).governedRecovery(0, recoveryData2, "Concurrent recovery 2", false);
            
            // 5. Wait for both to complete
            await Promise.all([tx1, tx2]);
            
            // 6. Verify both recoveries succeeded
            const LABSDoc1 = await LABSRegistry.getLABSDocument(TEST_LABS);
            const LABSDoc2 = await LABSRegistry.getLABSDocument(TEST_LABS_2);
            
            expect(LABSDoc1.owner).to.equal(user3.address);
            expect(LABSDoc2.owner).to.equal(user3.address);
            
            // 7. Verify operation history
            const history = await recoveryGovernance.getOperationHistory(0, 10);
            expect(history.length).to.be.greaterThanOrEqual(2);
        });
    });

    describe("Governance and Recovery Integration", function () {
        it("Should handle full governance workflow", async function () {
            // 1. Create LABS and enable scenarios
            await LABSRegistry.connect(admin).bridgeLABS(TEST_LABS, user1.address, TEST_PUBLIC_KEY, TEST_SERVICE_ENDPOINT);
            
            // 2. Create recovery proposal through state recovery
            await LABSRegistry.connect(admin).enableRecoveryMode();
            
            const proposalData = ethers.utils.defaultAbiCoder.encode(
                ["string", "address", "string", "string"],
                [TEST_LABS, user2.address, "0xGOVERNANCE", "https://governance.endpoint.com"]
            );
            
            const proposalId = await stateRecovery.connect(recovery).proposeRecovery(
                0, // LABS_DOCUMENT
                "Governance workflow test",
                proposalData
            );
            
            // 3. Get approval votes
            await stateRecovery.connect(recovery).voteOnRecovery(proposalId, true, "Approve 1");
            await stateRecovery.connect(recovery).voteOnRecovery(proposalId, true, "Approve 2");
            await stateRecovery.connect(recovery).voteOnRecovery(proposalId, true, "Approve 3");
            
            // 4. Wait for minimum delay
            await ethers.provider.send("evm_increaseTime", [2 * 60 * 60]); // 2 hours
            await ethers.provider.send("evm_mine");
            
            // 5. Execute recovery
            await stateRecovery.connect(recovery).executeRecovery(proposalId);
            
            // 6. Verify recovery through governance audit
            const history = await recoveryGovernance.getOperationHistory(0, 10);
            expect(history.length).to.be.greaterThan(0);
            
            // 7. Verify LABS was recovered
            const LABSDoc = await LABSRegistry.getLABSDocument(TEST_LABS);
            expect(LABSDoc.owner).to.equal(user2.address);
        });

        it("Should handle contract pausing during operations", async function () {
            // 1. Create LABS
            await LABSRegistry.connect(admin).bridgeLABS(TEST_LABS, user1.address, TEST_PUBLIC_KEY, TEST_SERVICE_ENDPOINT);
            
            // 2. Authorize and pause state recovery contract
            await recoveryGovernance.connect(governor).authorizeContract(stateRecovery.address);
            await recoveryGovernance.connect(guardian).pauseContract(stateRecovery.address, "Security audit");
            
            // 3. Attempt recovery through governance (should fail)
            await LABSRegistry.connect(admin).enableRecoveryMode();
            
            const recoveryData = ethers.utils.defaultAbiCoder.encode(
                ["string", "address", "string", "string"],
                [TEST_LABS, user2.address, "0xPAUSED", "https://paused.endpoint.com"]
            );
            
            await expect(
                recoveryGovernance.connect(governor).governedRecovery(0, recoveryData, "Paused recovery test", false)
            ).to.be.revertedWith("RecoveryGovernance: contract is paused");
            
            // 4. Unpause and retry
            await recoveryGovernance.connect(guardian).unpauseContract(stateRecovery.address);
            
            await recoveryGovernance.connect(governor).governedRecovery(0, recoveryData, "Unpaused recovery test", false);
            
            // 5. Verify recovery succeeded
            const LABSDoc = await LABSRegistry.getLABSDocument(TEST_LABS);
            expect(LABSDoc.owner).to.equal(user2.address);
        });
    });

    describe("Error Handling and Edge Cases", function () {
        it("Should handle failed recovery gracefully", async function () {
            // 1. Create LABS
            await LABSRegistry.connect(admin).bridgeLABS(TEST_LABS, user1.address, TEST_PUBLIC_KEY, TEST_SERVICE_ENDPOINT);
            
            // 2. Enable recovery mode
            await LABSRegistry.connect(admin).enableRecoveryMode();
            
            // 3. Attempt recovery with invalid data
            const invalidData = ethers.utils.defaultAbiCoder.encode(
                ["string", "address"], // Missing required parameters
                [TEST_LABS, user2.address]
            );
            
            // 4. This should fail but not break the system
            await expect(
                recoveryGovernance.connect(governor).governedRecovery(0, invalidData, "Invalid data test", false)
            ).to.be.reverted;
            
            // 5. Verify system is still functional
            const validData = ethers.utils.defaultAbiCoder.encode(
                ["string", "address", "string", "string"],
                [TEST_LABS, user2.address, "0xVALID", "https://valid.endpoint.com"]
            );
            
            await recoveryGovernance.connect(governor).governedRecovery(0, validData, "Valid recovery test", false);
            
            const LABSDoc = await LABSRegistry.getLABSDocument(TEST_LABS);
            expect(LABSDoc.owner).to.equal(user2.address);
        });

        it("Should handle role revocation scenarios", async function () {
            // 1. Create LABS and setup roles
            await LABSRegistry.connect(admin).bridgeLABS(TEST_LABS, user1.address, TEST_PUBLIC_KEY, TEST_SERVICE_ENDPOINT);
            
            // 2. Enable recovery mode
            await LABSRegistry.connect(admin).enableRecoveryMode();
            
            // 3. Perform recovery
            const recoveryData = ethers.utils.defaultAbiCoder.encode(
                ["string", "address", "string", "string"],
                [TEST_LABS, user2.address, "0xBEFOREREVOKE", "https://before.endpoint.com"]
            );
            
            await recoveryGovernance.connect(governor).governedRecovery(0, recoveryData, "Before revoke", false);
            
            // 4. Verify recovery worked
            let LABSDoc = await LABSRegistry.getLABSDocument(TEST_LABS);
            expect(LABSDoc.owner).to.equal(user2.address);
            
            // 5. Revoke recovery role from state recovery contract
            await LABSRegistry.connect(admin).revokeRole(await LABSRegistry.RECOVERY_ROLE(), stateRecovery.address);
            
            // 6. Attempt another recovery (should fail)
            const secondRecoveryData = ethers.utils.defaultAbiCoder.encode(
                ["string", "address", "string", "string"],
                [TEST_LABS, user3.address, "0xAFTERREVOKE", "https://after.endpoint.com"]
            );
            
            await expect(
                recoveryGovernance.connect(governor).governedRecovery(0, secondRecoveryData, "After revoke", false)
            ).to.be.reverted;
            
            // 7. Restore role and verify functionality
            await LABSRegistry.connect(admin).grantRole(await LABSRegistry.RECOVERY_ROLE(), stateRecovery.address);
            
            await recoveryGovernance.connect(governor).governedRecovery(0, secondRecoveryData, "Restored recovery", false);
            
            LABSDoc = await LABSRegistry.getLABSDocument(TEST_LABS);
            expect(LABSDoc.owner).to.equal(user3.address);
        });

        it("Should handle gas limit scenarios", async function () {
            // 1. Create multiple LABSs to test batch operations
            const LABSs = [];
            for (let i = 0; i < 5; i++) {
                const LABS = `LABS:ethereum:0x${i.toString().padStart(40, '0')}`;
                LABSs.push(LABS);
                await LABSRegistry.connect(admin).bridgeLABS(LABS, user1.address, TEST_PUBLIC_KEY, TEST_SERVICE_ENDPOINT);
            }
            
            // 2. Enable recovery mode
            await LABSRegistry.connect(admin).enableRecoveryMode();
            
            // 3. Perform multiple recoveries in sequence
            for (let i = 0; i < LABSs.length; i++) {
                const recoveryData = ethers.utils.defaultAbiCoder.encode(
                    ["string", "address", "string", "string"],
                    [LABSs[i], user2.address, `0xGASLIMIT${i}`, `https://gas${i}.endpoint.com`]
                );
                
                await recoveryGovernance.connect(governor).governedRecovery(0, recoveryData, `Gas test ${i}`, false);
            }
            
            // 4. Verify all recoveries succeeded
            for (const LABS of LABSs) {
                const LABSDoc = await LABSRegistry.getLABSDocument(LABS);
                expect(LABSDoc.owner).to.equal(user2.address);
            }
        });
    });

    describe("Performance and Scalability", function () {
        it("Should handle high volume operations", async function () {
            // 1. Create many LABSs
            const LABSCount = 10;
            const LABSs = [];
            
            for (let i = 0; i < LABSCount; i++) {
                const LABS = `LABS:ethereum:0x${i.toString().padStart(40, '0')}`;
                LABSs.push(LABS);
                await LABSRegistry.connect(admin).bridgeLABS(LABS, user1.address, TEST_PUBLIC_KEY, TEST_SERVICE_ENDPOINT);
            }
            
            // 2. Add claims to each LABS
            for (const LABS of LABSs) {
                await LABSRegistry.connect(user1).addClaim(
                    1, 1, issuer.address,
                    ethers.utils.toUtf8Bytes("batch signature"),
                    ethers.utils.toUtf8Bytes("batch data"),
                    "https://batch.claim.com"
                );
            }
            
            // 3. Enable recovery mode
            await LABSRegistry.connect(admin).enableRecoveryMode();
            
            // 4. Batch recovery through governance
            const recoveryPromises = [];
            for (let i = 0; i < LABSs.length; i++) {
                const recoveryData = ethers.utils.defaultAbiCoder.encode(
                    ["string", "address", "string", "string"],
                    [LABSs[i], user2.address, `0xBATCH${i}`, `https://batch${i}.endpoint.com`]
                );
                
                recoveryPromises.push(
                    recoveryGovernance.connect(governor).governedRecovery(0, recoveryData, `Batch recovery ${i}`, false)
                );
            }
            
            // 5. Wait for all recoveries to complete
            await Promise.all(recoveryPromises);
            
            // 6. Verify all recoveries succeeded
            for (const LABS of LABSs) {
                const LABSDoc = await LABSRegistry.getLABSDocument(LABS);
                expect(LABSDoc.owner).to.equal(user2.address);
            }
            
            // 7. Check operation statistics
            const [total, successful, emergency, failed] = await recoveryGovernance.getRecoveryStatistics();
            expect(total).to.equal(LABSCount);
            expect(successful).to.equal(LABSCount);
            expect(emergency).to.equal(0);
            expect(failed).to.equal(0);
        });
    });
});
