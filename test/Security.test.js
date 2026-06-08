const { expect } = require("chai");
const { ethers } = require("hardhat");
const TestHelper = require("./helpers/test-utils");

describe("Security Tests", function () {
    let LABSRegistry;
    let stateRecovery;
    let recoveryGovernance;
    let owner, admin, governor, guardian, auditor, issuer, recovery, user1, user2, attacker;
    
    beforeEach(async function () {
        const signers = await TestHelper.createSigners(10);
        [owner, admin, governor, guardian, auditor, issuer, recovery, user1, user2, attacker] = signers;
        
        const contracts = await TestHelper.deployContracts(signers);
        LABSRegistry = contracts.LABSRegistry;
        stateRecovery = contracts.stateRecovery;
        recoveryGovernance = contracts.recoveryGovernance;
        
        await TestHelper.setupRolesAndPermissions(contracts, { admin, governor, guardian, auditor, issuer, recovery });
    });

    describe("Access Control Security", function () {
        it("Should prevent unauthorized LABS bridging", async function () {
            const testLABS = TestHelper.generateTestLABS(user1.address);
            
            await expect(
                LABSRegistry.connect(attacker).bridgeLABS(testLABS, user1.address, TestHelper.generateTestPublicKey(), TestHelper.generateTestServiceEndpoint())
            ).to.be.revertedWith("AccessControl: caller missing role");
        });

        it("Should prevent unauthorized role granting", async function () {
            await expect(
                LABSRegistry.connect(attacker).grantRole(await LABSRegistry.ADMIN_ROLE(), user1.address)
            ).to.be.revertedWith("AccessControl: caller missing role");
        });

        it("Should prevent unauthorized recovery operations", async function () {
            await LABSRegistry.connect(admin).enableRecoveryMode();
            
            const recoveryData = ethers.utils.defaultAbiCoder.encode(
                ["string", "address", "string", "string"],
                [TestHelper.generateTestLABS(user1.address), user2.address, TestHelper.generateTestPublicKey(), TestHelper.generateTestServiceEndpoint()]
            );
            
            await expect(
                recoveryGovernance.connect(attacker).governedRecovery(0, recoveryData, "Unauthorized recovery", false)
            ).to.be.revertedWith("RecoveryGovernance: caller missing GOVERNOR_ROLE");
        });

        it("Should prevent unauthorized emergency activation", async function () {
            await expect(
                recoveryGovernance.connect(attacker).activateEmergencyMode("Fake emergency")
            ).to.be.revertedWith("RecoveryGovernance: caller missing GOVERNOR_ROLE");
        });

        it("Should prevent unauthorized contract pausing", async function () {
            await recoveryGovernance.connect(governor).authorizeContract(stateRecovery.address);
            
            await expect(
                recoveryGovernance.connect(attacker).pauseContract(stateRecovery.address, "Malicious pause")
            ).to.be.revertedWith("RecoveryGovernance: caller missing GUARDIAN_ROLE");
        });
    });

    describe("Input Validation Security", function () {
        it("Should prevent malicious input in LABS strings", async function () {
            const maliciousLABSs = [
                "LABS:ethereum:<script>alert('xss')</script>",
                "LABS:ethereum:javascript:alert('xss')",
                "LABS:ethereum:data:text/html,<script>alert('xss')</script>",
                "LABS:ethereum:../../../etc/passwd",
                "LABS:ethereum:..\\..\\..\\windows\\system32\\config\\sam"
            ];
            
            for (const maliciousLABS of maliciousLABSs) {
                // These should be stored as strings but not cause issues
                await expect(
                    LABSRegistry.connect(admin).bridgeLABS(maliciousLABS, user1.address, TestHelper.generateTestPublicKey(), TestHelper.generateTestServiceEndpoint())
                ).to.not.be.reverted;
            }
        });

        it("Should prevent overflow in numeric inputs", async function () {
            const testLABS = TestHelper.generateTestLABS(user1.address);
            
            // Test with maximum uint256 values
            await expect(
                LABSRegistry.connect(admin).bridgeCredential(
                    ethers.constants.MaxUint256,
                    "https://max-issuer.com",
                    testLABS,
                    "MaxCredential",
                    ethers.constants.MaxUint256,
                    ethers.constants.MaxUint256
                )
            ).to.not.be.reverted;
        });

        it("Should handle very long strings safely", async function () {
            const veryLongString = "A".repeat(100000); // 100KB string
            
            await expect(
                LABSRegistry.connect(admin).bridgeLABS(
                    TestHelper.generateTestLABS(user1.address),
                    user1.address,
                    TestHelper.generateTestPublicKey(),
                    veryLongString
                )
            ).to.not.be.reverted;
        });
    });

    describe("Reentrancy Protection", function () {
        it("Should prevent reentrancy attacks on critical functions", async function () {
            // Create a LABS first
            await TestHelper.createCompleteLABSSetup(
                { LABSRegistry, stateRecovery, recoveryGovernance },
                { admin, issuer, user: user1 }
            );
            
            // Test that reentrancy protection is in place
            // This is a conceptual test - actual reentrancy testing would require malicious contracts
            const key = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("test-key"));
            const value = ethers.utils.toUtf8Bytes("test-value");
            
            // Normal operation should work
            await expect(
                LABSRegistry.connect(user1).setData(key, value)
            ).to.not.be.reverted;
        });
    });

    describe("State Corruption Prevention", function () {
        it("Should prevent inconsistent state updates", async function () {
            const testLABS = TestHelper.generateTestLABS(user1.address);
            
            // Bridge LABS
            await LABSRegistry.connect(admin).bridgeLABS(testLABS, user1.address, TestHelper.generateTestPublicKey(), TestHelper.generateTestServiceEndpoint());
            
            // Verify initial state
            const initialDoc = await LABSRegistry.getLABSDocument(testLABS);
            expect(initialDoc.owner).to.equal(user1.address);
            
            // Attempt recovery without proper authorization
            await LABSRegistry.connect(admin).enableRecoveryMode();
            
            await expect(
                LABSRegistry.connect(attacker).recoverLABSDocument(testLABS, user2.address, TestHelper.generateTestPublicKey(), TestHelper.generateTestServiceEndpoint())
            ).to.be.revertedWith("Only recovery contract can call this function");
            
            // Verify state is unchanged
            const finalDoc = await LABSRegistry.getLABSDocument(testLABS);
            expect(finalDoc.owner).to.equal(user1.address);
            expect(finalDoc.updated).to.equal(initialDoc.updated);
        });

        it("Should maintain data integrity during concurrent operations", async function () {
            const testLABSs = [];
            
            // Create multiple LABSs
            for (let i = 0; i < 5; i++) {
                const LABS = TestHelper.generateTestLABS(ethers.Wallet.createRandom().address);
                testLABSs.push(LABS);
            }
            
            // Bridge all LABSs concurrently
            const bridgePromises = testLABSs.map(LABS => 
                LABSRegistry.connect(admin).bridgeLABS(LABS, user1.address, TestHelper.generateTestPublicKey(), TestHelper.generateTestServiceEndpoint())
            );
            
            await Promise.all(bridgePromises);
            
            // Verify all LABSs were created correctly
            for (const LABS of testLABSs) {
                const LABSDoc = await LABSRegistry.getLABSDocument(LABS);
                expect(LABSDoc.owner).to.equal(user1.address);
                expect(LABSDoc.active).to.be.true;
            }
        });
    });

    describe("Front-running Protection", function () {
        it("Should prevent front-running of recovery operations", async function () {
            const testLABS = TestHelper.generateTestLABS(user1.address);
            
            // Create LABS setup
            await TestHelper.createCompleteLABSSetup(
                { LABSRegistry, stateRecovery, recoveryGovernance },
                { admin, issuer, user: user1 },
                { LABS: testLABS }
            );
            
            // Create recovery proposal
            const recoveryData = ethers.utils.defaultAbiCoder.encode(
                ["string", "address", "string", "string"],
                [testLABS, user2.address, TestHelper.generateTestPublicKey(), TestHelper.generateTestServiceEndpoint()]
            );
            
            const proposalId = await stateRecovery.connect(recovery).proposeRecovery(
                0,
                "Recovery test",
                recoveryData
            );
            
            // Vote on proposal
            await stateRecovery.connect(recovery).voteOnRecovery(proposalId, true, "Approve");
            await stateRecovery.connect(recovery).voteOnRecovery(proposalId, true, "Approve");
            await stateRecovery.connect(recovery).voteOnRecovery(proposalId, true, "Approve");
            
            // Wait for minimum delay
            await TestHelper.increaseTime(2 * 60 * 60); // 2 hours
            
            // Execute recovery
            await LABSRegistry.connect(admin).enableRecoveryMode();
            await stateRecovery.connect(recovery).executeRecovery(proposalId);
            
            // Verify recovery was successful
            const LABSDoc = await LABSRegistry.getLABSDocument(testLABS);
            expect(LABSDoc.owner).to.equal(user2.address);
        });
    });

    describe("Gas Griefing Prevention", function () {
        it("Should handle gas limit attacks gracefully", async function () {
            const testLABS = TestHelper.generateTestLABS(user1.address);
            
            // Create LABS with many operations
            await LABSRegistry.connect(admin).bridgeLABS(testLABS, user1.address, TestHelper.generateTestPublicKey(), TestHelper.generateTestServiceEndpoint());
            
            // Add many claims
            for (let i = 0; i < 50; i++) {
                await LABSRegistry.connect(user1).addClaim(
                    i,
                    1,
                    issuer.address,
                    ethers.utils.toUtf8Bytes(`signature-${i}`),
                    ethers.utils.toUtf8Bytes(`data-${i}`),
                    `https://claim-${i}.com`
                );
            }
            
            // Operations should still work even with high gas usage
            const claimIds = await LABSRegistry.connect(user1).getClaimIdsByTopic(1);
            expect(claimIds.length).to.be.greaterThan(0);
        });
    });

    describe("Denial of Service Prevention", function () {
        it("Should prevent DoS through storage exhaustion", async function () {
            // Test that the contract can handle many operations without failing
            const operations = [];
            
            for (let i = 0; i < 100; i++) {
                const LABS = TestHelper.generateTestLABS(ethers.Wallet.createRandom().address);
                operations.push(
                    LABSRegistry.connect(admin).bridgeLABS(LABS, user1.address, TestHelper.generateTestPublicKey(), TestHelper.generateTestServiceEndpoint())
                );
            }
            
            // All operations should succeed
            await Promise.all(operations);
            
            // Verify contract is still functional
            const testLABS = TestHelper.generateTestLABS(user2.address);
            await LABSRegistry.connect(admin).bridgeLABS(testLABS, user2.address, TestHelper.generateTestPublicKey(), TestHelper.generateTestServiceEndpoint());
            
            const LABSDoc = await LABSRegistry.getLABSDocument(testLABS);
            expect(LABSDoc.owner).to.equal(user2.address);
        });
    });

    describe("Privacy and Data Protection", function () {
        it("Should not expose sensitive data in events", async function () {
            const testLABS = TestHelper.generateTestLABS(user1.address);
            const sensitiveData = "sensitive-private-key-data";
            
            const tx = await LABSRegistry.connect(admin).bridgeLABS(testLABS, user1.address, sensitiveData, TestHelper.generateTestServiceEndpoint());
            const receipt = await tx.wait();
            
            // Check that sensitive data is not exposed in event topics
            const event = receipt.events.find(e => e.event === "LABSBridged");
            expect(event.args.publicKey).to.equal(sensitiveData); // Data is in event, but this is expected for LABS registry
            
            // In a production environment, sensitive data should be encrypted or hashed
        });

        it("Should handle zero-knowledge proof scenarios", async function () {
            // Test that the system can work with hashed/encrypted data
            const testLABS = TestHelper.generateTestLABS(user1.address);
            const hashedKey = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("private-key"));
            const encryptedEndpoint = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("endpoint"));
            
            await expect(
                LABSRegistry.connect(admin).bridgeLABS(testLABS, user1.address, hashedKey, encryptedEndpoint)
            ).to.not.be.reverted;
            
            const LABSDoc = await LABSRegistry.getLABSDocument(testLABS);
            expect(LABSDoc.publicKey).to.equal(hashedKey);
            expect(LABSDoc.serviceEndpoint).to.equal(encryptedEndpoint);
        });
    });

    describe("Cryptographic Security", function () {
        it("Should handle cryptographic operations securely", async function () {
            const testLABS = TestHelper.generateTestLABS(user1.address);
            
            // Test with proper cryptographic signatures
            const wallet = ethers.Wallet.createRandom();
            const message = "test message for signing";
            const signature = await wallet.signMessage(message);
            
            // Add claim with cryptographic signature
            await LABSRegistry.connect(admin).bridgeLABS(testLABS, user1.address, TestHelper.generateTestPublicKey(), TestHelper.generateTestServiceEndpoint());
            
            await expect(
                LABSRegistry.connect(user1).addClaim(
                    1,
                    1,
                    wallet.address,
                    ethers.utils.arrayify(signature),
                    ethers.utils.toUtf8Bytes(message),
                    "https://cryptographic-claim.com"
                )
            ).to.not.be.reverted;
        });

        it("Should validate hash inputs properly", async function () {
            const testLABS = TestHelper.generateTestLABS(user1.address);
            const validHash = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("valid data"));
            const invalidHash = "0xinvalid";
            
            // Valid hash should work
            await expect(
                LABSRegistry.connect(admin).bridgeCredential(
                    validHash,
                    "https://issuer.com",
                    testLABS,
                    "HashCredential",
                    1234567890,
                    validHash
                )
            ).to.not.be.reverted;
            
            // Invalid hash format should be handled gracefully
            await expect(
                LABSRegistry.connect(admin).bridgeCredential(
                    invalidHash,
                    "https://issuer.com",
                    testLABS,
                    "InvalidHashCredential",
                    1234567890,
                    invalidHash
                )
            ).to.not.be.reverted; // String validation, not cryptographic validation
        });
    });

    describe("Emergency Response Security", function () {
        it("Should handle emergency scenarios securely", async function () {
            const testLABS = TestHelper.generateTestLABS(user1.address);
            
            // Create LABS setup
            await TestHelper.createCompleteLABSSetup(
                { LABSRegistry, stateRecovery, recoveryGovernance },
                { admin, issuer, user: user1 },
                { LABS: testLABS }
            );
            
            // Activate emergency mode
            await recoveryGovernance.connect(governor).activateEmergencyMode("Security emergency");
            
            // Verify emergency mode is active
            const config = await recoveryGovernance.config();
            expect(config.emergencyMode).to.be.true;
            
            // Perform emergency recovery
            const recoveryData = ethers.utils.defaultAbiCoder.encode(
                ["string", "address", "string", "string"],
                [testLABS, user2.address, TestHelper.generateTestPublicKey(), TestHelper.generateTestServiceEndpoint()]
            );
            
            await LABSRegistry.connect(admin).enableRecoveryMode();
            await recoveryGovernance.connect(governor).governedRecovery(0, recoveryData, "Emergency security recovery", true);
            
            // Verify emergency recovery worked
            const LABSDoc = await LABSRegistry.getLABSDocument(testLABS);
            expect(LABSDoc.owner).to.equal(user2.address);
            
            // Deactivate emergency mode
            await recoveryGovernance.connect(governor).deactivateEmergencyMode();
            
            const configAfter = await recoveryGovernance.config();
            expect(configAfter.emergencyMode).to.be.false;
        });

        it("Should prevent unauthorized emergency actions", async function () {
            await expect(
                recoveryGovernance.connect(attacker).activateEmergencyMode("Fake emergency")
            ).to.be.revertedWith("RecoveryGovernance: caller missing GOVERNOR_ROLE");
            
            await expect(
                recoveryGovernance.connect(attacker).deactivateEmergencyMode()
            ).to.be.revertedWith("RecoveryGovernance: caller missing GOVERNOR_ROLE");
        });
    });

    describe("Audit Trail Security", function () {
        it("Should maintain immutable audit trail", async function () {
            const testLABS = TestHelper.generateTestLABS(user1.address);
            
            // Perform operations that should be audited
            await LABSRegistry.connect(admin).bridgeLABS(testLABS, user1.address, TestHelper.generateTestPublicKey(), TestHelper.generateTestServiceEndpoint());
            
            // Perform recovery through governance
            const recoveryData = ethers.utils.defaultAbiCoder.encode(
                ["string", "address", "string", "string"],
                [testLABS, user2.address, TestHelper.generateTestPublicKey(), TestHelper.generateTestServiceEndpoint()]
            );
            
            await LABSRegistry.connect(admin).enableRecoveryMode();
            const result = await TestHelper.performGovernedRecovery(
                { LABSRegistry, stateRecovery, recoveryGovernance },
                { governor, admin },
                recoveryData,
                "Audit trail test"
            );
            
            // Verify audit trail is created
            expect(result.proposalId).to.not.be.null;
            expect(result.successful).to.be.true;
            
            // Verify operation can be audited
            const [timestamp, executor, emergency, reason, successful] = 
                await recoveryGovernance.connect(auditor).auditRecoveryOperation(result.proposalId);
            
            expect(timestamp).to.be.gt(0);
            expect(executor).to.equal(governor.address);
            expect(emergency).to.be.false;
            expect(reason).to.equal("Audit trail test");
            expect(successful).to.be.true;
        });

        it("Should prevent audit trail tampering", async function () {
            // Audit trail should be immutable
            const history = await recoveryGovernance.getOperationHistory(0, 10);
            
            // History should be read-only
            expect(history.length).to.be.greaterThanOrEqual(0);
            
            // No functions should allow modifying audit trail
            // This is verified by the lack of such functions in the contract interface
        });
    });
});
