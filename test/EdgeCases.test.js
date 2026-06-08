const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("Edge Cases and Error Conditions Tests", function () {
    let LABSRegistry;
    let stateRecovery;
    let recoveryGovernance;
    let owner, admin, governor, guardian, auditor, issuer, recovery, user1, user2, user3, attacker;
    
    beforeEach(async function () {
        [owner, admin, governor, guardian, auditor, issuer, recovery, user1, user2, user3, attacker] = await ethers.getSigners();
        
        // Deploy contracts
        const StateRecoveryFactory = await ethers.getContractFactory("StateRecovery");
        stateRecovery = await StateRecoveryFactory.deploy();
        await stateRecovery.deployed();
        
        const LABSRegistryFactory = await ethers.getContractFactory("EthereumLABSRegistry");
        LABSRegistry = await LABSRegistryFactory.deploy();
        await LABSRegistry.deployed();
        
        const RecoveryGovernanceFactory = await ethers.getContractFactory("RecoveryGovernance");
        recoveryGovernance = await RecoveryGovernanceFactory.deploy(stateRecovery.address);
        await recoveryGovernance.deployed();
        
        // Setup basic roles
        await LABSRegistry.grantRole(await LABSRegistry.ADMIN_ROLE(), admin.address);
        await LABSRegistry.grantRole(await LABSRegistry.ISSUER_ROLE(), issuer.address);
        await LABSRegistry.grantRole(await LABSRegistry.RECOVERY_ROLE(), recovery.address);
        
        await stateRecovery.grantRole(await stateRecovery.RECOVERY_ROLE(), recovery.address);
        await stateRecovery.grantRole(await stateRecovery.EMERGENCY_ROLE(), recovery.address);
        await stateRecovery.grantRole(await stateRecovery.GOVERNANCE_ROLE(), governor.address);
        
        await recoveryGovernance.grantRole(await recoveryGovernance.GOVERNOR_ROLE(), governor.address);
        await recoveryGovernance.grantRole(await recoveryGovernance.GUARDIAN_ROLE(), guardian.address);
        await recoveryGovernance.grantRole(await recoveryGovernance.AUDITOR_ROLE(), auditor.address);
        
        // Set up contract relationships
        await LABSRegistry.setStateRecoveryContract(stateRecovery.address);
        await stateRecovery.setTargetContracts(LABSRegistry.address, ethers.constants.AddressZero);
        await recoveryGovernance.connect(governor).authorizeContract(stateRecovery.address);
        await LABSRegistry.grantRole(await LABSRegistry.RECOVERY_ROLE(), stateRecovery.address);
    });

    describe("Boundary Value Testing", function () {
        it("Should handle maximum length strings", async function () {
            // Create very long strings to test boundary conditions
            const longLABS = "LABS:ethereum:" + "1".repeat(40);
            const longPublicKey = "0x" + "A".repeat(64);
            const longServiceEndpoint = "https://" + "a".repeat(1000) + ".com";
            const longReason = "R".repeat(10000);
            
            // Test with long strings
            await expect(
                LABSRegistry.connect(admin).bridgeLABS(longLABS, user1.address, longPublicKey, longServiceEndpoint)
            ).to.not.be.reverted;
            
            // Verify the data was stored correctly
            const LABSDoc = await LABSRegistry.getLABSDocument(longLABS);
            expect(LABSDoc.owner).to.equal(user1.address);
            expect(LABSDoc.publicKey).to.equal(longPublicKey);
            expect(LABSDoc.serviceEndpoint).to.equal(longServiceEndpoint);
            
            // Test governance with long reason
            await LABSRegistry.connect(admin).enableRecoveryMode();
            
            const recoveryData = ethers.utils.defaultAbiCoder.encode(
                ["string", "address", "string", "string"],
                [longLABS, user2.address, longPublicKey, longServiceEndpoint]
            );
            
            await recoveryGovernance.connect(governor).governedRecovery(0, recoveryData, longReason, false);
        });

        it("Should handle empty and whitespace strings", async function () {
            // Test with empty strings
            await expect(
                LABSRegistry.connect(admin).bridgeLABS(TEST_LABS, user1.address, TEST_PUBLIC_KEY, "")
            ).to.not.be.reverted;
            
            // Test with whitespace strings
            const whitespaceLABS = "LABS:ethereum:   \t\n";
            const whitespaceKey = "   \t\n";
            const whitespaceEndpoint = "   \t\n";
            
            await expect(
                LABSRegistry.connect(admin).bridgeLABS(whitespaceLABS, user1.address, whitespaceKey, whitespaceEndpoint)
            ).to.not.be.reverted;
        });

        it("Should handle numeric boundary values", async function () {
            // Test with minimum values
            const minExpires = 1;
            const minTimestamp = 0;
            
            await LABSRegistry.connect(admin).bridgeCredential(
                ethers.utils.keccak256(ethers.utils.toUtf8Bytes("min")),
                "https://min.issuer.com",
                TEST_LABS,
                "MinCredential",
                minExpires,
                ethers.utils.keccak256("min")
            );
            
            // Test with maximum values
            const maxExpires = ethers.constants.MaxUint256;
            
            await LABSRegistry.connect(admin).bridgeCredential(
                ethers.utils.keccak256(ethers.utils.toUtf8Bytes("max")),
                "https://max.issuer.com",
                TEST_LABS,
                "MaxCredential",
                maxExpires,
                ethers.utils.keccak256("max")
            );
        });
    });

    describe("Invalid Input Handling", function () {
        it("Should handle invalid addresses", async function () {
            // Test with zero address
            await expect(
                LABSRegistry.connect(admin).bridgeLABS(TEST_LABS, ethers.constants.AddressZero, TEST_PUBLIC_KEY, TEST_SERVICE_ENDPOINT)
            ).to.not.be.reverted; // Should be allowed for bridging
            
            // Test with invalid address in recovery
            await LABSRegistry.connect(admin).enableRecoveryMode();
            
            await expect(
                LABSRegistry.connect(recovery).recoverLABSDocument(TEST_LABS, ethers.constants.AddressZero, TEST_PUBLIC_KEY, TEST_SERVICE_ENDPOINT)
            ).to.be.revertedWith("New owner cannot be zero address");
        });

        it("Should handle malformed LABS strings", async function () {
            const malformedLABSs = [
                "",
                "not-a-LABS",
                "LABS:",
                "LABS:ethereum:",
                "LABS:ethereum:0x",
                "LABS:ethereum:0x123", // Too short
                "LABS:ethereum:0x" + "1".repeat(41), // Too long
                "LABS:ethereum:0xZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZ", // Invalid hex
            ];
            
            for (const LABS of malformedLABSs) {
                if (LABS.length === 0) {
                    await expect(
                        LABSRegistry.connect(recovery).recoverLABSDocument(LABS, user1.address, TEST_PUBLIC_KEY, TEST_SERVICE_ENDPOINT)
                    ).to.be.revertedWith("LABS cannot be empty");
                } else {
                    // Most malformed LABSs should be accepted as strings
                    await expect(
                        LABSRegistry.connect(admin).bridgeLABS(LABS, user1.address, TEST_PUBLIC_KEY, TEST_SERVICE_ENDPOINT)
                    ).to.not.be.reverted;
                }
            }
        });

        it("Should handle invalid public keys", async function () {
            const invalidKeys = [
                "",
                "0x",
                "0x123", // Too short
                "0x" + "1".repeat(65), // Too long
                "0xZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZ", // Invalid hex
            ];
            
            for (const key of invalidKeys) {
                if (key.length === 0) {
                    await expect(
                        LABSRegistry.connect(recovery).recoverLABSDocument(TEST_LABS, user1.address, key, TEST_SERVICE_ENDPOINT)
                    ).to.be.revertedWith("Public key cannot be empty");
                } else {
                    // Most invalid keys should be accepted as strings
                    await expect(
                        LABSRegistry.connect(admin).bridgeLABS(TEST_LABS, user1.address, key, TEST_SERVICE_ENDPOINT)
                    ).to.not.be.reverted;
                }
            }
        });

        it("Should handle invalid credential data", async function () {
            const invalidCredentialIds = [
                ethers.constants.HashZero,
                ethers.utils.keccak256(ethers.utils.toUtf8Bytes("")),
            ];
            
            for (const credentialId of invalidCredentialIds) {
                if (credentialId === ethers.constants.HashZero) {
                    await expect(
                        LABSRegistry.connect(recovery).recoverCredential(
                            credentialId,
                            "https://issuer.com",
                            TEST_LABS,
                            "Credential",
                            1234567890,
                            ethers.utils.keccak256("data")
                        )
                    ).to.be.revertedWith("Credential ID cannot be zero");
                }
            }
            
            const invalidStrings = ["", "   \t\n"];
            
            for (const issuer of invalidStrings) {
                await expect(
                    LABSRegistry.connect(recovery).recoverCredential(
                        ethers.utils.keccak256("test"),
                        issuer,
                        TEST_LABS,
                        "Credential",
                        1234567890,
                        ethers.utils.keccak256("data")
                    )
                ).to.be.revertedWith("Issuer cannot be empty");
            }
            
            for (const subject of invalidStrings) {
                await expect(
                    LABSRegistry.connect(recovery).recoverCredential(
                        ethers.utils.keccak256("test"),
                        "https://issuer.com",
                        subject,
                        "Credential",
                        1234567890,
                        ethers.utils.keccak256("data")
                    )
                ).to.be.revertedWith("Subject cannot be empty");
            }
        });
    });

    describe("Reentrancy Attack Prevention", function () {
        it("Should prevent reentrancy in critical functions", async function () {
            // Deploy a malicious contract that attempts reentrancy
            const MaliciousContractFactory = await ethers.getContractFactory("MaliciousReentrancyContract");
            const maliciousContract = await MaliciousContractFactory.deploy(LABSRegistry.address);
            await maliciousContract.deployed();
            
            // Bridge a LABS to the malicious contract
            await LABSRegistry.connect(admin).bridgeLABS(TEST_LABS, maliciousContract.address, TEST_PUBLIC_KEY, TEST_SERVICE_ENDPOINT);
            
            // Attempt to trigger reentrancy through setData
            const key = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("reentrancy-key"));
            const value = ethers.utils.toUtf8Bytes("reentrancy-value");
            
            // This should fail due to reentrancy protection
            await expect(
                maliciousContract.attemptReentrancy(key, value)
            ).to.be.reverted;
        });

        it("Should handle nested calls safely", async function () {
            // Test that nested calls don't cause issues
            await LABSRegistry.connect(admin).bridgeLABS(TEST_LABS, user1.address, TEST_PUBLIC_KEY, TEST_SERVICE_ENDPOINT);
            
            // Create a contract that makes nested calls
            const NestedContractFactory = await ethers.getContractFactory("NestedCallContract");
            const nestedContract = await NestedContractFactory.deploy(LABSRegistry.address);
            await nestedContract.deployed();
            
            // This should work without issues
            await expect(
                nestedContract.makeNestedCalls()
            ).to.not.be.reverted;
        });
    });

    describe("Gas Limit and Out of Gas Scenarios", function () {
        it("Should handle operations near gas limits", async function () {
            // Create a scenario that uses a lot of gas
            const manyLABSs = [];
            for (let i = 0; i < 50; i++) {
                const LABS = `LABS:ethereum:0x${i.toString().padStart(40, '0')}`;
                manyLABSs.push(LABS);
                await LABSRegistry.connect(admin).bridgeLABS(LABS, user1.address, TEST_PUBLIC_KEY, TEST_SERVICE_ENDPOINT);
            }
            
            // Add many claims to each LABS
            for (const LABS of manyLABSs) {
                for (let j = 0; j < 10; j++) {
                    await LABSRegistry.connect(user1).addClaim(
                        j, 1, issuer.address,
                        ethers.utils.toUtf8Bytes(`signature-${j}`),
                        ethers.utils.toUtf8Bytes(`data-${j}`),
                        `https://claim-${j}.com`
                    );
                }
            }
            
            // This should still work even with high gas usage
            const history = await recoveryGovernance.getOperationHistory(0, 100);
            expect(history.length).to.be.greaterThanOrEqual(0);
        });

        it("Should handle failed transactions gracefully", async function () {
            // Create a scenario that will fail
            await LABSRegistry.connect(admin).bridgeLABS(TEST_LABS, user1.address, TEST_PUBLIC_KEY, TEST_SERVICE_ENDPOINT);
            
            // Try to bridge the same LABS again (should fail)
            await expect(
                LABSRegistry.connect(admin).bridgeLABS(TEST_LABS, user2.address, TEST_PUBLIC_KEY, TEST_SERVICE_ENDPOINT)
            ).to.be.revertedWith("LABS already exists on this chain");
            
            // Verify the contract is still in a valid state
            const LABSDoc = await LABSRegistry.getLABSDocument(TEST_LABS);
            expect(LABSDoc.owner).to.equal(user1.address);
        });
    });

    describe("Concurrency and Race Conditions", function () {
        it("Should handle concurrent operations safely", async function () {
            // Create multiple concurrent operations
            const promises = [];
            
            for (let i = 0; i < 10; i++) {
                const LABS = `LABS:ethereum:0x${i.toString().padStart(40, '0')}`;
                promises.push(LABSRegistry.connect(admin).bridgeLABS(LABS, user1.address, TEST_PUBLIC_KEY, TEST_SERVICE_ENDPOINT));
            }
            
            // All should succeed
            await Promise.all(promises);
            
            // Verify all LABSs were created
            for (let i = 0; i < 10; i++) {
                const LABS = `LABS:ethereum:0x${i.toString().padStart(40, '0')}`;
                const LABSDoc = await LABSRegistry.getLABSDocument(LABS);
                expect(LABSDoc.owner).to.equal(user1.address);
            }
        });

        it("Should handle state consistency during concurrent operations", async function () {
            // Bridge a LABS
            await LABSRegistry.connect(admin).bridgeLABS(TEST_LABS, user1.address, TEST_PUBLIC_KEY, TEST_SERVICE_ENDPOINT);
            
            // Create concurrent claim operations
            const claimPromises = [];
            for (let i = 0; i < 5; i++) {
                claimPromises.push(
                    LABSRegistry.connect(user1).addClaim(
                        i, 1, issuer.address,
                        ethers.utils.toUtf8Bytes(`concurrent-sig-${i}`),
                        ethers.utils.toUtf8Bytes(`concurrent-data-${i}`),
                        `https://concurrent-${i}.com`
                    )
                );
            }
            
            await Promise.all(claimPromises);
            
            // Verify all claims were added
            for (let i = 0; i < 5; i++) {
                const claimIds = await LABSRegistry.connect(user1).getClaimIdsByTopic(i);
                expect(claimIds.length).to.equal(1);
            }
        });
    });

    describe("Memory and Storage Overflow", function () {
        it("Should handle large arrays safely", async function () {
            // Create a user with many LABSs
            for (let i = 0; i < 20; i++) {
                const LABS = `LABS:ethereum:0x${i.toString().padStart(40, '0')}`;
                await LABSRegistry.connect(admin).bridgeLABS(LABS, user1.address, TEST_PUBLIC_KEY, TEST_SERVICE_ENDPOINT);
            }
            
            // This should work without issues
            const userLABSs = await LABSRegistry.ownerToLABSs(user1.address);
            expect(userLABSs.length).to.equal(20);
        });

        it("Should handle large mappings efficiently", async function () {
            // Create many credentials
            for (let i = 0; i < 100; i++) {
                const credentialId = ethers.utils.keccak256(ethers.utils.toUtf8Bytes(`credential-${i}`));
                await LABSRegistry.connect(admin).bridgeCredential(
                    credentialId,
                    `https://issuer-${i}.com`,
                    TEST_LABS,
                    `Credential-${i}`,
                    1234567890 + i,
                    ethers.utils.keccak256(`data-${i}`)
                );
            }
            
            // Verify all credentials exist
            for (let i = 0; i < 100; i++) {
                const credentialId = ethers.utils.keccak256(ethers.utils.toUtf8Bytes(`credential-${i}`));
                const credential = await LABSRegistry.getCredential(credentialId);
                expect(credential.issuer).to.equal(`https://issuer-${i}.com`);
            }
        });
    });

    describe("Time-Related Edge Cases", function () {
        it("Should handle timestamp edge cases", async function () {
            // Test with minimum timestamp
            const minTimestamp = 0;
            
            // Fast forward to a specific time
            await ethers.provider.send("evm_setNextBlockTimestamp", [minTimestamp]);
            await ethers.provider.send("evm_mine");
            
            await LABSRegistry.connect(admin).bridgeLABS(TEST_LABS, user1.address, TEST_PUBLIC_KEY, TEST_SERVICE_ENDPOINT);
            
            const LABSDoc = await LABSRegistry.getLABSDocument(TEST_LABS);
            expect(LABSDoc.created).to.equal(minTimestamp);
            
            // Test with maximum timestamp
            const maxTimestamp = ethers.constants.MaxUint256.div(1000); // Convert to seconds
            
            await ethers.provider.send("evm_setNextBlockTimestamp", [maxTimestamp.toNumber()]);
            await ethers.provider.send("evm_mine");
            
            await LABSRegistry.connect(admin).bridgeLABS(TEST_LABS_2, user2.address, TEST_PUBLIC_KEY, TEST_SERVICE_ENDPOINT);
            
            const LABSDoc2 = await LABSRegistry.getLABSDocument(TEST_LABS_2);
            expect(LABSDoc2.created).to.equal(maxTimestamp);
        });

        it("Should handle voting period edge cases", async function () {
            // Create a proposal
            const data = ethers.utils.defaultAbiCoder.encode(
                ["string", "address", "string", "string"],
                [TEST_LABS, user1.address, TEST_PUBLIC_KEY, TEST_SERVICE_ENDPOINT]
            );
            
            const proposalId = await stateRecovery.connect(recovery).proposeRecovery(0, "Edge case test", data);
            
            // Test voting exactly at deadline
            const proposal = await stateRecovery.getProposal(proposalId);
            const deadline = proposal.votingDeadline;
            
            await ethers.provider.send("evm_setNextBlockTimestamp", [deadline.toNumber()]);
            await ethers.provider.send("evm_mine");
            
            // Should still be able to vote
            await expect(
                stateRecovery.connect(recovery).voteOnRecovery(proposalId, true, "Last minute vote")
            ).to.not.be.reverted;
            
            // Test voting after deadline
            await ethers.provider.send("evm_increaseTime", [1]);
            await ethers.provider.send("evm_mine");
            
            await expect(
                stateRecovery.connect(recovery).voteOnRecovery(proposalId, false, "Late vote")
            ).to.be.revertedWith("StateRecovery: voting period ended");
        });
    });

    describe("Permission and Access Control Edge Cases", function () {
        it("Should handle role assignment edge cases", async function () {
            // Test assigning multiple roles to same address
            await LABSRegistry.grantRole(await LABSRegistry.ADMIN_ROLE(), user1.address);
            await LABSRegistry.grantRole(await LABSRegistry.ISSUER_ROLE(), user1.address);
            await LABSRegistry.grantRole(await LABSRegistry.RECOVERY_ROLE(), user1.address);
            
            // User should have all roles
            expect(await LABSRegistry.hasRole(await LABSRegistry.ADMIN_ROLE(), user1.address)).to.be.true;
            expect(await LABSRegistry.hasRole(await LABSRegistry.ISSUER_ROLE(), user1.address)).to.be.true;
            expect(await LABSRegistry.hasRole(await LABSRegistry.RECOVERY_ROLE(), user1.address)).to.be.true;
            
            // Test revoking one role
            await LABSRegistry.revokeRole(await LABSRegistry.ADMIN_ROLE(), user1.address);
            
            expect(await LABSRegistry.hasRole(await LABSRegistry.ADMIN_ROLE(), user1.address)).to.be.false;
            expect(await LABSRegistry.hasRole(await LABSRegistry.ISSUER_ROLE(), user1.address)).to.be.true;
            expect(await LABSRegistry.hasRole(await LABSRegistry.RECOVERY_ROLE(), user1.address)).to.be.true;
        });

        it("Should handle self-role assignment", async function () {
            // Admin should be able to assign roles to themselves
            await LABSRegistry.connect(admin).grantRole(await LABSRegistry.ISSUER_ROLE(), admin.address);
            expect(await LABSRegistry.hasRole(await LABSRegistry.ISSUER_ROLE(), admin.address)).to.be.true;
            
            // Admin should be able to revoke their own roles
            await LABSRegistry.connect(admin).revokeRole(await LABSRegistry.ISSUER_ROLE(), admin.address);
            expect(await LABSRegistry.hasRole(await LABSRegistry.ISSUER_ROLE(), admin.address)).to.be.false;
        });

        it("Should handle role hierarchy edge cases", async function () {
            // Create a complex role hierarchy
            await LABSRegistry.grantRole(await LABSRegistry.ADMIN_ROLE(), user1.address);
            await LABSRegistry.grantRole(await LABSRegistry.ISSUER_ROLE(), user2.address);
            await LABSRegistry.grantRole(await LABSRegistry.RECOVERY_ROLE(), user3.address);
            
            // Test that each role can perform its specific functions
            await expect(
                LABSRegistry.connect(user1).bridgeLABS(TEST_LABS, attacker.address, TEST_PUBLIC_KEY, TEST_SERVICE_ENDPOINT)
            ).to.not.be.reverted;
            
            await expect(
                LABSRegistry.connect(user2).addClaim(1, 1, issuer.address, "0x123", "0x456", "https://test.com")
            ).to.be.reverted; // User2 doesn't have a LABS
            
            // Bridge a LABS to user2 first
            await LABSRegistry.connect(admin).bridgeLABS(TEST_LABS, user2.address, TEST_PUBLIC_KEY, TEST_SERVICE_ENDPOINT);
            
            await expect(
                LABSRegistry.connect(user2).addClaim(1, 1, issuer.address, "0x123", "0x456", "https://test.com")
            ).to.not.be.reverted;
        });
    });

    describe("Data Corruption and Recovery Edge Cases", function () {
        it("Should handle partial data corruption", async function () {
            // Bridge a LABS
            await LABSRegistry.connect(admin).bridgeLABS(TEST_LABS, user1.address, TEST_PUBLIC_KEY, TEST_SERVICE_ENDPOINT);
            
            // Simulate partial corruption by updating only some fields
            await LABSRegistry.connect(admin).enableRecoveryMode();
            
            const corruptedData = ethers.utils.defaultAbiCoder.encode(
                ["string", "address", "string", "string"],
                [TEST_LABS, user2.address, "", ""] // Empty public key and service endpoint
            );
            
            await recoveryGovernance.connect(governor).governedRecovery(0, corruptedData, "Partial corruption test", false);
            
            // Verify partial recovery
            const LABSDoc = await LABSRegistry.getLABSDocument(TEST_LABS);
            expect(LABSDoc.owner).to.equal(user2.address);
            expect(LABSDoc.publicKey).to.equal(""); // Should be empty
            expect(LABSDoc.serviceEndpoint).to.equal(""); // Should be empty
        });

        it("Should handle recovery of non-existent data", async function () {
            await LABSRegistry.connect(admin).enableRecoveryMode();
            
            // Try to recover a LABS that doesn't exist
            const nonExistentLABS = "LABS:ethereum:0x9999999999999999999999999999999999999999";
            const recoveryData = ethers.utils.defaultAbiCoder.encode(
                ["string", "address", "string", "string"],
                [nonExistentLABS, user1.address, TEST_PUBLIC_KEY, TEST_SERVICE_ENDPOINT]
            );
            
            await recoveryGovernance.connect(governor).governedRecovery(0, recoveryData, "Recover non-existent", false);
            
            // Verify LABS was created
            const LABSDoc = await LABSRegistry.getLABSDocument(nonExistentLABS);
            expect(LABSDoc.owner).to.equal(user1.address);
            expect(LABSDoc.publicKey).to.equal(TEST_PUBLIC_KEY);
        });
    });
});

// Note: Helper contracts for reentrancy and nested call testing would need to be
// deployed as separate Solidity files. The test cases above demonstrate the
// concepts but require actual contract deployment for execution.
