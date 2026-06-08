const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("EthereumLABSRegistry Contract Tests", function () {
    let LABSRegistry;
    let stateRecovery;
    let owner, admin, issuer, recovery, user1, user2, user3, attacker;
    
    // Test constants
    const TEST_LABS = "LABS:ethereum:0x1234567890123456789012345678901234567890";
    const TEST_LABS_2 = "LABS:ethereum:0x9876543210987654321098765432109876543210";
    const TEST_PUBLIC_KEY = "0xABCDEF1234567890ABCDEF1234567890ABCDEF1234567890ABCDEF1234567890";
    const TEST_SERVICE_ENDPOINT = "https://LABS.example.com/endpoint";
    const TEST_CREDENTIAL_ID = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("test-credential"));

    beforeEach(async function () {
        [owner, admin, issuer, recovery, user1, user2, user3, attacker] = await ethers.getSigners();
        
        // Deploy StateRecovery first
        const StateRecoveryFactory = await ethers.getContractFactory("StateRecovery");
        stateRecovery = await StateRecoveryFactory.deploy();
        await stateRecovery.deployed();
        
        // Deploy EthereumLABSRegistry
        const LABSRegistryFactory = await ethers.getContractFactory("EthereumLABSRegistry");
        LABSRegistry = await LABSRegistryFactory.deploy();
        await LABSRegistry.deployed();
        
        // Setup roles
        await LABSRegistry.grantRole(await LABSRegistry.ADMIN_ROLE(), admin.address);
        await LABSRegistry.grantRole(await LABSRegistry.ISSUER_ROLE(), issuer.address);
        await LABSRegistry.grantRole(await LABSRegistry.RECOVERY_ROLE(), recovery.address);
        
        // Set state recovery contract
        await LABSRegistry.setStateRecoveryContract(stateRecovery.address);
        
        // Setup state recovery to call LABS registry
        await stateRecovery.setTargetContracts(LABSRegistry.address, ethers.constants.AddressZero);
        await stateRecovery.grantRole(await stateRecovery.RECOVERY_ROLE(), LABSRegistry.address);
    });

    describe("Contract Initialization", function () {
        it("Should deploy with correct owner", async function () {
            expect(await LABSRegistry._admin()).to.equal(owner.address);
        });

        it("Should set correct role constants", async function () {
            const adminRole = await LABSRegistry.ADMIN_ROLE();
            const issuerRole = await LABSRegistry.ISSUER_ROLE();
            const recoveryRole = await LABSRegistry.RECOVERY_ROLE();
            
            expect(adminRole).to.equal(ethers.utils.keccak256(ethers.utils.toUtf8Bytes("ADMIN_ROLE")));
            expect(issuerRole).to.equal(ethers.utils.keccak256(ethers.utils.toUtf8Bytes("ISSUER_ROLE")));
            expect(recoveryRole).to.equal(ethers.utils.keccak256(ethers.utils.toUtf8Bytes("RECOVERY_ROLE")));
        });

        it("Should initialize with correct recovery mode state", async function () {
            expect(await LABSRegistry.recoveryMode()).to.be.false;
            expect(await LABSRegistry.stateRecoveryContract()).to.equal(stateRecovery.address);
        });
    });

    describe("Role Management", function () {
        it("Should allow admin to grant roles", async function () {
            await LABSRegistry.connect(admin).grantRole(await LABSRegistry.ISSUER_ROLE(), user1.address);
            expect(await LABSRegistry.hasRole(await LABSRegistry.ISSUER_ROLE(), user1.address)).to.be.true;
        });

        it("Should prevent non-admin from granting roles", async function () {
            await expect(
                LABSRegistry.connect(attacker).grantRole(await LABSRegistry.ISSUER_ROLE(), user1.address)
            ).to.be.revertedWith("AccessControl: caller missing role");
        });

        it("Should allow role-based access control", async function () {
            expect(await LABSRegistry.hasRole(await LABSRegistry.ADMIN_ROLE(), admin.address)).to.be.true;
            expect(await LABSRegistry.hasRole(await LABSRegistry.ISSUER_ROLE(), issuer.address)).to.be.true;
            expect(await LABSRegistry.hasRole(await LABSRegistry.RECOVERY_ROLE(), recovery.address)).to.be.true;
            expect(await LABSRegistry.hasRole(await LABSRegistry.ADMIN_ROLE(), attacker.address)).to.be.false;
        });
    });

    describe("LABS Bridging", function () {
        it("Should allow admin to bridge LABS", async function () {
            const tx = await LABSRegistry.connect(admin).bridgeLABS(
                TEST_LABS,
                user1.address,
                TEST_PUBLIC_KEY,
                TEST_SERVICE_ENDPOINT
            );
            
            const receipt = await tx.wait();
            const event = receipt.events.find(e => e.event === "LABSBridged");
            
            expect(event.args.LABS).to.equal(TEST_LABS);
            expect(event.args.owner).to.equal(user1.address);
            expect(event.args.publicKey).to.equal(TEST_PUBLIC_KEY);
            
            // Verify LABS document
            const LABSDoc = await LABSRegistry.getLABSDocument(TEST_LABS);
            expect(LABSDoc.owner).to.equal(user1.address);
            expect(LABSDoc.publicKey).to.equal(TEST_PUBLIC_KEY);
            expect(LABSDoc.serviceEndpoint).to.equal(TEST_SERVICE_ENDPOINT);
            expect(LABSDoc.active).to.be.true;
            expect(LABSDoc.created).to.be.gt(0);
            expect(LABSDoc.updated).to.equal(LABSDoc.created);
        });

        it("Should prevent bridging duplicate LABS", async function () {
            await LABSRegistry.connect(admin).bridgeLABS(TEST_LABS, user1.address, TEST_PUBLIC_KEY, TEST_SERVICE_ENDPOINT);
            
            await expect(
                LABSRegistry.connect(admin).bridgeLABS(TEST_LABS, user2.address, TEST_PUBLIC_KEY, TEST_SERVICE_ENDPOINT)
            ).to.be.revertedWith("LABS already exists on this chain");
        });

        it("Should prevent non-admin from bridging LABS", async function () {
            await expect(
                LABSRegistry.connect(attacker).bridgeLABS(TEST_LABS, user1.address, TEST_PUBLIC_KEY, TEST_SERVICE_ENDPOINT)
            ).to.be.revertedWith("AccessControl: caller missing role");
        });

        it("Should handle empty service endpoint", async function () {
            await LABSRegistry.connect(admin).bridgeLABS(TEST_LABS_2, user2.address, TEST_PUBLIC_KEY, "");
            
            const LABSDoc = await LABSRegistry.getLABSDocument(TEST_LABS_2);
            expect(LABSDoc.serviceEndpoint).to.equal("");
        });
    });

    describe("Credential Bridging", function () {
        it("Should allow admin to bridge credential", async function () {
            const expires = Math.floor(Date.now() / 1000) + 86400; // 24 hours from now
            const dataHash = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("credential data"));
            
            const tx = await LABSRegistry.connect(admin).bridgeCredential(
                TEST_CREDENTIAL_ID,
                "https://issuer.example.com",
                "LABS:example:subject",
                "VerificationCredential",
                expires,
                dataHash
            );
            
            const receipt = await tx.wait();
            const event = receipt.events.find(e => e.event === "CredentialBridged");
            
            expect(event.args.id).to.equal(TEST_CREDENTIAL_ID);
            expect(event.args.issuer).to.equal("https://issuer.example.com");
            expect(event.args.subject).to.equal("LABS:example:subject");
            
            // Verify credential
            const credential = await LABSRegistry.getCredential(TEST_CREDENTIAL_ID);
            expect(credential.id).to.equal(TEST_CREDENTIAL_ID);
            expect(credential.issuer).to.equal("https://issuer.example.com");
            expect(credential.subject).to.equal("LABS:example:subject");
            expect(credential.credentialType).to.equal("VerificationCredential");
            expect(credential.expires).to.equal(expires);
            expect(credential.dataHash).to.equal(dataHash);
            expect(credential.revoked).to.be.false;
        });

        it("Should prevent bridging duplicate credential", async function () {
            await LABSRegistry.connect(admin).bridgeCredential(
                TEST_CREDENTIAL_ID,
                "https://issuer.example.com",
                "LABS:example:subject",
                "VerificationCredential",
                1234567890,
                ethers.utils.keccak256("data")
            );
            
            await expect(
                LABSRegistry.connect(admin).bridgeCredential(
                    TEST_CREDENTIAL_ID,
                    "https://other-issuer.example.com",
                    "LABS:example:other-subject",
                    "OtherCredential",
                    1234567890,
                    ethers.utils.keccak256("other-data")
                )
            ).to.be.revertedWith("Credential already exists");
        });

        it("Should prevent non-admin from bridging credential", async function () {
            await expect(
                LABSRegistry.connect(attacker).bridgeCredential(
                    TEST_CREDENTIAL_ID,
                    "https://issuer.example.com",
                    "LABS:example:subject",
                    "VerificationCredential",
                    1234567890,
                    ethers.utils.keccak256("data")
                )
            ).to.be.revertedWith("AccessControl: caller missing role");
        });
    });

    describe("ERC725 Implementation", function () {
        beforeEach(async function () {
            // Bridge a LABS first for ERC725 tests
            await LABSRegistry.connect(admin).bridgeLABS(TEST_LABS, user1.address, TEST_PUBLIC_KEY, TEST_SERVICE_ENDPOINT);
        });

        it("Should allow LABS owner to set data", async function () {
            const key = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("test-key"));
            const value = ethers.utils.toUtf8Bytes("test-value");
            
            const tx = await LABSRegistry.connect(user1).setData(key, value);
            const receipt = await tx.wait();
            const event = receipt.events.find(e => e.event === "DataChanged");
            
            expect(event.args.key).to.equal(key);
            expect(event.args.value).to.equal(value);
            
            // Verify data was set
            const storedValue = await LABSRegistry.connect(user1).getData(key);
            expect(storedValue).to.equal(value);
        });

        it("Should prevent non-LABS owner from setting data", async function () {
            const key = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("test-key"));
            const value = ethers.utils.toUtf8Bytes("test-value");
            
            await expect(
                LABSRegistry.connect(attacker).setData(key, value)
            ).to.be.revertedWith("No LABS found for caller address");
        });

        it("Should allow LABS owner to get data", async function () {
            const key = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("test-key"));
            const value = ethers.utils.toUtf8Bytes("test-value");
            
            await LABSRegistry.connect(user1).setData(key, value);
            
            const retrievedValue = await LABSRegistry.connect(user1).getData(key);
            expect(retrievedValue).to.equal(value);
        });

        it("Should allow LABS owner to execute calls", async function () {
            // Deploy a simple target contract for execution testing
            const TargetFactory = await ethers.getContractFactory("ReentrancyGuard");
            const target = await TargetFactory.deploy();
            await target.deployed();
            
            const callData = target.interface.encodeFunctionData("reentrancyGuardEntered");
            
            const tx = await LABSRegistry.connect(user1).execute(
                0, // operation type
                target.address,
                0, // value
                callData
            );
            
            const receipt = await tx.wait();
            const event = receipt.events.find(e => e.event === "Executed");
            
            expect(event.args.operationType).to.equal(0);
            expect(event.args.target).to.equal(target.address);
            expect(event.args.value).to.equal(0);
        });

        it("Should prevent non-LABS owner from executing calls", async function () {
            const TargetFactory = await ethers.getContractFactory("ReentrancyGuard");
            const target = await TargetFactory.deploy();
            await target.deployed();
            
            const callData = target.interface.encodeFunctionData("reentrancyGuardEntered");
            
            await expect(
                LABSRegistry.connect(attacker).execute(0, target.address, 0, callData)
            ).to.be.revertedWith("No LABS found for caller address");
        });

        it("Should handle failed execution", async function () {
            const callData = "0x12345678"; // Invalid function selector
            
            await expect(
                LABSRegistry.connect(user1).execute(0, user1.address, 0, callData)
            ).to.be.revertedWith("Execution failed");
        });
    });

    describe("ERC735 Implementation", function () {
        beforeEach(async function () {
            // Bridge a LABS first for ERC735 tests
            await LABSRegistry.connect(admin).bridgeLABS(TEST_LABS, user1.address, TEST_PUBLIC_KEY, TEST_SERVICE_ENDPOINT);
        });

        it("Should allow LABS owner to add claim", async function () {
            const topic = 1;
            const scheme = 1;
            const signature = ethers.utils.toUtf8Bytes("signature");
            const data = ethers.utils.toUtf8Bytes("claim data");
            const uri = "https://claim.example.com";
            
            const tx = await LABSRegistry.connect(user1).addClaim(topic, scheme, issuer.address, signature, data, uri);
            const receipt = await tx.wait();
            const event = receipt.events.find(e => e.event === "ClaimAdded");
            
            expect(event.args.topic).to.equal(topic);
            expect(event.args.scheme).to.equal(scheme);
            expect(event.args.issuer).to.equal(issuer.address);
            
            // Verify claim was added
            const claimId = ethers.utils.keccak256(ethers.utils.defaultAbiCoder.encode(
                ["address", "uint256"],
                [issuer.address, topic]
            ));
            
            const claim = await LABSRegistry.connect(user1).getClaim(claimId);
            expect(claim.topic).to.equal(topic);
            expect(claim.scheme).to.equal(scheme);
            expect(claim.issuer).to.equal(issuer.address);
        });

        it("Should allow issuer to add claim", async function () {
            const topic = 2;
            const scheme = 1;
            const signature = ethers.utils.toUtf8Bytes("issuer signature");
            const data = ethers.utils.toUtf8Bytes("issuer claim data");
            const uri = "https://issuer-claim.example.com";
            
            const tx = await LABSRegistry.connect(issuer).addClaim(topic, scheme, issuer.address, signature, data, uri);
            const receipt = await tx.wait();
            const event = receipt.events.find(e => e.event === "ClaimAdded");
            
            expect(event.args.issuer).to.equal(issuer.address);
        });

        it("Should prevent unauthorized claim addition", async function () {
            const topic = 3;
            const scheme = 1;
            const signature = ethers.utils.toUtf8Bytes("signature");
            const data = ethers.utils.toUtf8Bytes("claim data");
            const uri = "https://claim.example.com";
            
            await expect(
                LABSRegistry.connect(attacker).addClaim(topic, scheme, issuer.address, signature, data, uri)
            ).to.be.revertedWith("No LABS found for caller address");
        });

        it("Should allow LABS owner to remove claim", async function () {
            const topic = 1;
            const scheme = 1;
            const signature = ethers.utils.toUtf8Bytes("signature");
            const data = ethers.utils.toUtf8Bytes("claim data");
            const uri = "https://claim.example.com";
            
            // Add a claim first
            const addTx = await LABSRegistry.connect(user1).addClaim(topic, scheme, issuer.address, signature, data, uri);
            const addReceipt = await addTx.wait();
            const addEvent = addReceipt.events.find(e => e.event === "ClaimAdded");
            const claimId = addEvent.args.claimId;
            
            // Remove the claim
            const tx = await LABSRegistry.connect(user1).removeClaim(claimId);
            const receipt = await tx.wait();
            const event = receipt.events.find(e => e.event === "ClaimRemoved");
            
            expect(event.args.claimId).to.equal(claimId);
            expect(event.args.topic).to.equal(topic);
        });

        it("Should prevent non-LABS owner from removing claim", async function () {
            const topic = 1;
            const scheme = 1;
            const signature = ethers.utils.toUtf8Bytes("signature");
            const data = ethers.utils.toUtf8Bytes("claim data");
            const uri = "https://claim.example.com";
            
            // Add a claim first
            const addTx = await LABSRegistry.connect(user1).addClaim(topic, scheme, issuer.address, signature, data, uri);
            const addReceipt = await addTx.wait();
            const addEvent = addReceipt.events.find(e => e.event === "ClaimAdded");
            const claimId = addEvent.args.claimId;
            
            // Try to remove with unauthorized user
            await expect(
                LABSRegistry.connect(attacker).removeClaim(claimId)
            ).to.be.revertedWith("No LABS found for caller address");
        });

        it("Should get claims by topic", async function () {
            const topic = 1;
            const scheme = 1;
            const signature = ethers.utils.toUtf8Bytes("signature");
            const data = ethers.utils.toUtf8Bytes("claim data");
            const uri = "https://claim.example.com";
            
            // Add multiple claims with same topic
            await LABSRegistry.connect(user1).addClaim(topic, scheme, issuer.address, signature, data, uri);
            await LABSRegistry.connect(user1).addClaim(topic, scheme, user2.address, signature, data, uri);
            
            const claimIds = await LABSRegistry.connect(user1).getClaimIdsByTopic(topic);
            expect(claimIds.length).to.equal(2);
        });
    });

    describe("Recovery Mode", function () {
        it("Should allow admin to enable recovery mode", async function () {
            await LABSRegistry.connect(admin).enableRecoveryMode();
            expect(await LABSRegistry.recoveryMode()).to.be.true;
        });

        it("Should allow admin to disable recovery mode", async function () {
            await LABSRegistry.connect(admin).enableRecoveryMode();
            await LABSRegistry.connect(admin).disableRecoveryMode();
            expect(await LABSRegistry.recoveryMode()).to.be.false;
        });

        it("Should prevent non-admin from enabling recovery mode", async function () {
            await expect(
                LABSRegistry.connect(attacker).enableRecoveryMode()
            ).to.be.revertedWith("AccessControl: caller missing role");
        });

        it("Should prevent non-admin from disabling recovery mode", async function () {
            await expect(
                LABSRegistry.connect(attacker).disableRecoveryMode()
            ).to.be.revertedWith("AccessControl: caller missing role");
        });

        it("Should prevent operations when not in recovery mode", async function () {
            await expect(
                LABSRegistry.connect(recovery).recoverLABSDocument(TEST_LABS, user1.address, TEST_PUBLIC_KEY, TEST_SERVICE_ENDPOINT)
            ).to.be.revertedWith("Contract is not in recovery mode");
        });
    });

    describe("Recovery Functions", function () {
        beforeEach(async function () {
            await LABSRegistry.connect(admin).enableRecoveryMode();
        });

        it("Should allow recovery contract to recover LABS document", async function () {
            const tx = await LABSRegistry.connect(recovery).recoverLABSDocument(
                TEST_LABS,
                user1.address,
                TEST_PUBLIC_KEY,
                TEST_SERVICE_ENDPOINT
            );
            
            const receipt = await tx.wait();
            const event = receipt.events.find(e => e.event === "LABSUpdated");
            
            expect(event.args.LABS).to.equal(TEST_LABS);
            
            // Verify LABS document was recovered
            const LABSDoc = await LABSRegistry.getLABSDocument(TEST_LABS);
            expect(LABSDoc.owner).to.equal(user1.address);
            expect(LABSDoc.publicKey).to.equal(TEST_PUBLIC_KEY);
            expect(LABSDoc.serviceEndpoint).to.equal(TEST_SERVICE_ENDPOINT);
            expect(LABSDoc.active).to.be.true;
        });

        it("Should allow recovery contract to recover credential", async function () {
            const tx = await LABSRegistry.connect(recovery).recoverCredential(
                TEST_CREDENTIAL_ID,
                "https://recovered-issuer.example.com",
                "LABS:recovered:subject",
                "RecoveredCredential",
                1234567890,
                ethers.utils.keccak256("recovered data")
            );
            
            const receipt = await tx.wait();
            const event = receipt.events.find(e => e.event === "CredentialBridged");
            
            expect(event.args.id).to.equal(TEST_CREDENTIAL_ID);
            expect(event.args.issuer).to.equal("https://recovered-issuer.example.com");
            
            // Verify credential was recovered
            const credential = await LABSRegistry.getCredential(TEST_CREDENTIAL_ID);
            expect(credential.issuer).to.equal("https://recovered-issuer.example.com");
            expect(credential.subject).to.equal("LABS:recovered:subject");
            expect(credential.credentialType).to.equal("RecoveredCredential");
        });

        it("Should allow recovery contract to recover ownership mapping", async function () {
            // First bridge a LABS to user1
            await LABSRegistry.connect(admin).bridgeLABS(TEST_LABS, user1.address, TEST_PUBLIC_KEY, TEST_SERVICE_ENDPOINT);
            
            // Then transfer ownership to user2
            await LABSRegistry.connect(recovery).recoverOwnershipMapping(user1.address, user2.address, TEST_LABS);
            
            // Verify ownership was transferred
            const LABSDoc = await LABSRegistry.getLABSDocument(TEST_LABS);
            expect(LABSDoc.owner).to.equal(user2.address);
        });

        it("Should allow recovery contract to recover role assignment", async function () {
            await LABSRegistry.connect(recovery).recoverRoleAssignment(
                await LABSRegistry.ISSUER_ROLE(),
                user1.address,
                true
            );
            
            expect(await LABSRegistry.hasRole(await LABSRegistry.ISSUER_ROLE(), user1.address)).to.be.true;
        });

        it("Should prevent non-recovery contract from calling recovery functions", async function () {
            await expect(
                LABSRegistry.connect(attacker).recoverLABSDocument(TEST_LABS, user1.address, TEST_PUBLIC_KEY, TEST_SERVICE_ENDPOINT)
            ).to.be.revertedWith("Only recovery contract can call this function");
        });
    });

    describe("State Validation", function () {
        it("Should validate state integrity", async function () {
            const [isValid, issue] = await LABSRegistry.validateStateIntegrity();
            expect(isValid).to.be.true;
            expect(issue).to.equal("No issues found");
        });

        it("Should provide state summary", async function () {
            const [totalLABSs, totalCredentials, totalOwners, isInRecoveryMode] = await LABSRegistry.getStateSummary();
            expect(isInRecoveryMode).to.be.false;
            // Note: These are placeholder values in the current implementation
            expect(totalLABSs).to.equal(0);
            expect(totalCredentials).to.equal(0);
            expect(totalOwners).to.equal(0);
        });
    });

    describe("Edge Cases and Error Conditions", function () {
        it("Should handle empty LABS string", async function () {
            await expect(
                LABSRegistry.connect(recovery).recoverLABSDocument("", user1.address, TEST_PUBLIC_KEY, TEST_SERVICE_ENDPOINT)
            ).to.be.revertedWith("LABS cannot be empty");
        });

        it("Should handle zero address for owner", async function () {
            await expect(
                LABSRegistry.connect(recovery).recoverLABSDocument(TEST_LABS, ethers.constants.AddressZero, TEST_PUBLIC_KEY, TEST_SERVICE_ENDPOINT)
            ).to.be.revertedWith("New owner cannot be zero address");
        });

        it("Should handle empty public key", async function () {
            await expect(
                LABSRegistry.connect(recovery).recoverLABSDocument(TEST_LABS, user1.address, "", TEST_SERVICE_ENDPOINT)
            ).to.be.revertedWith("Public key cannot be empty");
        });

        it("Should handle zero credential ID", async function () {
            await expect(
                LABSRegistry.connect(recovery).recoverCredential(
                    ethers.constants.HashZero,
                    "https://issuer.example.com",
                    "LABS:example:subject",
                    "Credential",
                    1234567890,
                    ethers.utils.keccak256("data")
                )
            ).to.be.revertedWith("Credential ID cannot be zero");
        });

        it("Should handle empty issuer", async function () {
            await expect(
                LABSRegistry.connect(recovery).recoverCredential(
                    TEST_CREDENTIAL_ID,
                    "",
                    "LABS:example:subject",
                    "Credential",
                    1234567890,
                    ethers.utils.keccak256("data")
                )
            ).to.be.revertedWith("Issuer cannot be empty");
        });

        it("Should handle empty subject", async function () {
            await expect(
                LABSRegistry.connect(recovery).recoverCredential(
                    TEST_CREDENTIAL_ID,
                    "https://issuer.example.com",
                    "",
                    "Credential",
                    1234567890,
                    ethers.utils.keccak256("data")
                )
            ).to.be.revertedWith("Subject cannot be empty");
        });

        it("Should prevent operations when not in recovery mode", async function () {
            await LABSRegistry.connect(admin).disableRecoveryMode();
            
            await expect(
                LABSRegistry.connect(recovery).recoverLABSDocument(TEST_LABS, user1.address, TEST_PUBLIC_KEY, TEST_SERVICE_ENDPOINT)
            ).to.be.revertedWith("Contract is not in recovery mode");
        });

        it("Should handle non-existent LABS operations", async function () {
            const nonExistentLABS = "LABS:ethereum:0x9999999999999999999999999999999999999999";
            
            const LABSDoc = await LABSRegistry.getLABSDocument(nonExistentLABS);
            expect(LABSDoc.owner).to.equal(ethers.constants.AddressZero);
            expect(LABSDoc.created).to.equal(0);
            expect(LABSDoc.updated).to.equal(0);
            expect(LABSDoc.active).to.be.false;
        });

        it("Should handle non-existent credential operations", async function () {
            const nonExistentCredential = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("non-existent"));
            
            const credential = await LABSRegistry.getCredential(nonExistentCredential);
            expect(credential.id).to.equal(ethers.constants.HashZero);
            expect(credential.issued).to.equal(0);
            expect(credential.expires).to.equal(0);
            expect(credential.revoked).to.be.false;
        });
    });
});
