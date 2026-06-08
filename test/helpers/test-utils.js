const { ethers } = require("hardhat");

/**
 * Test utilities and helper functions for Cognitive Lab Registry testing
 */

class TestHelper {
    /**
     * Generate test Cognitive Lab string
     * @param {string} address - Ethereum address
     * @returns {string} Cognitive Lab string
     */
    static generateTestCognitiveLab(address) {
        return `LABS:ethereum:${address}`;
    }

    /**
     * Generate test public key
     * @param {number} length - Key length in characters
     * @returns {string} Public key string
     */
    static generateTestPublicKey(length = 64) {
        return "0x" + "ABCDEF1234567890".repeat(Math.ceil(length / 16)).substring(0, length);
    }

    /**
     * Generate test service endpoint
     * @param {string} domain - Domain name
     * @returns {string} Service endpoint URL
     */
    static generateTestServiceEndpoint(domain = "example.com") {
        return `https://cognitive-lab.${domain}/endpoint`;
    }

    /**
     * Generate test credential data
     * @param {string} issuer - Issuer URL
     * @param {string} subject - Subject Cognitive Lab
     * @param {string} type - Credential type
     * @returns {object} Credential data object
     */
    static generateTestCredential(issuer, subject, type) {
        return {
            id: ethers.utils.keccak256(ethers.utils.toUtf8Bytes(`${issuer}-${subject}-${type}-${Date.now()}`)),
            issuer: issuer || `https://issuer-${Date.now()}.example.com`,
            subject: subject || this.generateTestCognitiveLab(ethers.Wallet.createRandom().address),
            credentialType: type || "VerificationCredential",
            expires: Math.floor(Date.now() / 1000) + 86400, // 24 hours from now
            dataHash: ethers.utils.keccak256(ethers.utils.toUtf8Bytes(`credential-data-${Date.now()}`))
        };
    }

    /**
     * Generate test claim data
     * @param {number} topic - Claim topic
     * @param {address} issuer - Issuer address
     * @returns {object} Claim data object
     */
    static generateTestClaim(topic, issuer) {
        return {
            topic: topic || 1,
            scheme: 1,
            issuer: issuer || ethers.Wallet.createRandom().address,
            signature: ethers.utils.toUtf8Bytes(`signature-${Date.now()}`),
            data: ethers.utils.toUtf8Bytes(`claim-data-${Date.now()}`),
            uri: `https://claim-${Date.now()}.example.com`
        };
    }

    /**
     * Deploy contracts with proper setup
     * @param {object} signers - Contract signers
     * @returns {object} Deployed contracts
     */
    static async deployContracts(signers) {
        const [owner, admin, governor, guardian, auditor, issuer, recovery] = signers;

        // Deploy StateRecovery
        const StateRecoveryFactory = await ethers.getContractFactory("StateRecovery");
        const stateRecovery = await StateRecoveryFactory.deploy();
        await stateRecovery.deployed();

        // Deploy EthereumCognitiveLabRegistry
        const CognitiveLabRegistryFactory = await ethers.getContractFactory("EthereumCognitiveLabRegistry");
        const cognitiveLabRegistry = await CognitiveLabRegistryFactory.deploy();
        await cognitiveLabRegistry.deployed();

        // Deploy RecoveryGovernance
        const RecoveryGovernanceFactory = await ethers.getContractFactory("RecoveryGovernance");
        const recoveryGovernance = await RecoveryGovernanceFactory.deploy(stateRecovery.address);
        await recoveryGovernance.deployed();

        return {
            cognitiveLabRegistry,
            stateRecovery,
            recoveryGovernance,
            owner,
            admin,
            governor,
            guardian,
            auditor,
            issuer,
            recovery
        };
    }

    /**
     * Setup roles and permissions for contracts
     * @param {object} contracts - Deployed contracts
     * @param {object} signers - Contract signers
     */
    static async setupRolesAndPermissions(contracts, signers) {
        const { cognitiveLabRegistry, stateRecovery, recoveryGovernance } = contracts;
        const { admin, governor, guardian, auditor, issuer, recovery } = signers;

        // Cognitive Lab Registry roles
        await cognitiveLabRegistry.grantRole(await cognitiveLabRegistry.ADMIN_ROLE(), admin.address);
        await cognitiveLabRegistry.grantRole(await cognitiveLabRegistry.ISSUER_ROLE(), issuer.address);
        await cognitiveLabRegistry.grantRole(await cognitiveLabRegistry.RECOVERY_ROLE(), recovery.address);

        // State Recovery roles
        await stateRecovery.grantRole(await stateRecovery.RECOVERY_ROLE(), recovery.address);
        await stateRecovery.grantRole(await stateRecovery.EMERGENCY_ROLE(), recovery.address);
        await stateRecovery.grantRole(await stateRecovery.GOVERNANCE_ROLE(), governor.address);

        // Recovery Governance roles
        await recoveryGovernance.grantRole(await recoveryGovernance.GOVERNOR_ROLE(), governor.address);
        await recoveryGovernance.grantRole(await recoveryGovernance.GUARDIAN_ROLE(), guardian.address);
        await recoveryGovernance.grantRole(await recoveryGovernance.AUDITOR_ROLE(), auditor.address);

        // Set up contract relationships
        await cognitiveLabRegistry.setStateRecoveryContract(stateRecovery.address);
        await stateRecovery.setTargetContracts(cognitiveLabRegistry.address, ethers.constants.AddressZero);
        await recoveryGovernance.connect(governor).authorizeContract(stateRecovery.address);
        
        // Grant recovery contract permissions
        await cognitiveLabRegistry.grantRole(await cognitiveLabRegistry.RECOVERY_ROLE(), stateRecovery.address);
        await stateRecovery.grantRole(await stateRecovery.RECOVERY_ROLE(), cognitiveLabRegistry.address);
    }

    /**
     * Create a complete Cognitive Lab setup with claims and credentials
     * @param {object} contracts - Deployed contracts
     * @param {object} signers - Contract signers
     * @param {object} options - Configuration options
     * @returns {object} Created Cognitive Lab data
     */
    static async createCompleteCognitiveLabSetup(contracts, signers, options = {}) {
        const { cognitiveLabRegistry, stateRecovery, recoveryGovernance } = contracts;
        const { admin, issuer, user } = signers;

        const cognitiveLab = options.cognitiveLab || this.generateTestCognitiveLab(user.address);
        const publicKey = options.publicKey || this.generateTestPublicKey();
        const serviceEndpoint = options.serviceEndpoint || this.generateTestServiceEndpoint();

        // Bridge Cognitive Lab
        await cognitiveLabRegistry.connect(admin).bridgeCognitiveLab(cognitiveLab, user.address, publicKey, serviceEndpoint);

        // Add claims
        const claims = [];
        if (options.addClaims !== false) {
            for (let i = 0; i < (options.claimCount || 3); i++) {
                const claim = this.generateTestClaim(i + 1, issuer.address);
                await cognitiveLabRegistry.connect(user).addClaim(
                    claim.topic,
                    claim.scheme,
                    claim.issuer,
                    claim.signature,
                    claim.data,
                    claim.uri
                );
                claims.push(claim);
            }
        }

        // Add credentials
        const credentials = [];
        if (options.addCredentials !== false) {
            for (let i = 0; i < (options.credentialCount || 2); i++) {
                const credential = this.generateTestCredential(
                    `https://issuer-${i}.example.com`,
                    cognitiveLab,
                    `CredentialType${i}`
                );
                await cognitiveLabRegistry.connect(admin).bridgeCredential(
                    credential.id,
                    credential.issuer,
                    credential.subject,
                    credential.credentialType,
                    credential.expires,
                    credential.dataHash
                );
                credentials.push(credential);
            }
        }

        return {
            cognitiveLab,
            publicKey,
            serviceEndpoint,
            claims,
            credentials
        };
    }

    /**
     * Perform governed recovery
     * @param {object} contracts - Deployed contracts
     * @param {object} signers - Contract signers
     * @param {object} recoveryData - Recovery data
     * @param {string} reason - Recovery reason
     * @param {boolean} emergency - Whether it's an emergency recovery
     * @returns {object} Recovery result
     */
    static async performGovernedRecovery(contracts, signers, recoveryData, reason, emergency = false) {
        const { cognitiveLabRegistry, stateRecovery, recoveryGovernance } = contracts;
        const { governor, admin } = signers;

        // Enable recovery mode
        await cognitiveLabRegistry.connect(admin).enableRecoveryMode();

        // Activate emergency mode if needed
        if (emergency) {
            await recoveryGovernance.connect(governor).activateEmergencyMode(reason);
        }

        // Encode recovery data
        const encodedData = ethers.utils.defaultAbiCoder.encode(
            ["string", "address", "string", "string"],
            [recoveryData.cognitiveLab, recoveryData.newOwner, recoveryData.newPublicKey, recoveryData.newServiceEndpoint]
        );

        // Perform governed recovery
        const tx = await recoveryGovernance.connect(governor).governedRecovery(
            0, // COGNITIVE_LAB_DOCUMENT
            encodedData,
            reason,
            emergency
        );

        const receipt = await tx.wait();
        const event = receipt.events.find(e => e.event === "RecoveryOperationLogged");

        return {
            transaction: tx,
            receipt,
            event,
            proposalId: event ? event.args.proposalId : null,
            successful: event ? event.args.successful : false
        };
    }

    /**
     * Wait for a specific number of blocks
     * @param {number} blockCount - Number of blocks to wait
     */
    static async waitForBlocks(blockCount) {
        for (let i = 0; i < blockCount; i++) {
            await ethers.provider.send("evm_mine");
        }
    }

    /**
     * Increase blockchain time
     * @param {number} seconds - Number of seconds to increase
     */
    static async increaseTime(seconds) {
        await ethers.provider.send("evm_increaseTime", [seconds]);
        await ethers.provider.send("evm_mine");
    }

    /**
     * Set specific block timestamp
     * @param {number} timestamp - Timestamp to set
     */
    static async setTimestamp(timestamp) {
        await ethers.provider.send("evm_setNextBlockTimestamp", [timestamp]);
        await ethers.provider.send("evm_mine");
    }

    /**
     * Get current block timestamp
     * @returns {number} Current block timestamp
     */
    static async getCurrentTimestamp() {
        const block = await ethers.provider.getBlock("latest");
        return block.timestamp;
    }

    /**
     * Calculate gas cost in ETH
     * @param {object} receipt - Transaction receipt
     * @returns {string} Gas cost in ETH
     */
    static calculateGasCost(receipt) {
        return ethers.utils.formatEther(receipt.gasUsed.mul(receipt.effectiveGasPrice));
    }

    /**
     * Verify event was emitted
     * @param {object} receipt - Transaction receipt
     * @param {string} eventName - Event name
     * @param {object} expectedArgs - Expected event arguments
     * @returns {boolean} Whether event was emitted with expected args
     */
    static verifyEvent(receipt, eventName, expectedArgs = {}) {
        const event = receipt.events.find(e => e.event === eventName);
        if (!event) return false;

        if (Object.keys(expectedArgs).length === 0) return true;

        for (const [key, value] of Object.entries(expectedArgs)) {
            if (event.args[key] !== value) {
                return false;
            }
        }

        return true;
    }

    /**
     * Generate test data for boundary testing
     * @returns {object} Boundary test data
     */
    static generateBoundaryTestData() {
        return {
            longString: "A".repeat(10000),
            emptyString: "",
            whitespaceString: "   \t\n\r   ",
            maxUint256: ethers.constants.MaxUint256,
            minUint256: 0,
            maxAddress: "0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF",
            minAddress: ethers.constants.AddressZero,
            longCognitiveLab: "LABS:ethereum:" + "1".repeat(40),
            shortCognitiveLab: "LABS:ethereum:0x1",
            invalidCognitiveLab: "not-a-cognitive-lab",
            longPublicKey: "0x" + "A".repeat(64),
            shortPublicKey: "0x1",
            invalidPublicKey: "0xZZZ",
            longEndpoint: "https://" + "a".repeat(1000) + ".com",
            emptyEndpoint: ""
        };
    }

    /**
     * Create multiple signers for testing
     * @param {number} count - Number of signers to create
     * @returns {array} Array of signers
     */
    static async createSigners(count) {
        const signers = await ethers.getSigners();
        return signers.slice(0, Math.min(count, signers.length));
    }

    /**
     * Batch bridge multiple Cognitive Labs
     * @param {object} cognitiveLabRegistry - Cognitive Lab Registry contract
     * @param {object} admin - Admin signer
     * @param {array} cognitiveLabs - Array of Cognitive Lab data
     */
    static async batchBridgeCognitiveLabs(cognitiveLabRegistry, admin, cognitiveLabs) {
        const promises = cognitiveLabs.map(cognitiveLab => 
            cognitiveLabRegistry.connect(admin).bridgeCognitiveLab(cognitiveLab.cognitiveLab, cognitiveLab.owner, cognitiveLab.publicKey, cognitiveLab.serviceEndpoint)
        );
        return Promise.all(promises);
    }

    /**
     * Batch add multiple claims
     * @param {object} cognitiveLabRegistry - Cognitive Lab Registry contract
     * @param {object} user - User signer
     * @param {array} claims - Array of claim data
     */
    static async batchAddClaims(cognitiveLabRegistry, user, claims) {
        const promises = claims.map(claim => 
            cognitiveLabRegistry.connect(user).addClaim(
                claim.topic,
                claim.scheme,
                claim.issuer,
                claim.signature,
                claim.data,
                claim.uri
            )
        );
        return Promise.all(promises);
    }

    /**
     * Validate Cognitive Lab document structure
     * @param {object} cognitiveLabDoc - Cognitive Lab document
     * @param {object} expected - Expected values
     * @returns {boolean} Whether Cognitive Lab document is valid
     */
    static validateCognitiveLabDocument(cognitiveLabDoc, expected = {}) {
        const requiredFields = ['owner', 'created', 'updated', 'active', 'publicKey', 'serviceEndpoint'];
        
        for (const field of requiredFields) {
            if (cognitiveLabDoc[field] === undefined) {
                return false;
            }
        }

        for (const [key, value] of Object.entries(expected)) {
            if (cognitiveLabDoc[key] !== value) {
                return false;
            }
        }

        return true;
    }

    /**
     * Validate credential structure
     * @param {object} credential - Credential object
     * @param {object} expected - Expected values
     * @returns {boolean} Whether credential is valid
     */
    static validateCredential(credential, expected = {}) {
        const requiredFields = ['id', 'issuer', 'subject', 'credentialType', 'issued', 'expires', 'dataHash', 'revoked'];
        
        for (const field of requiredFields) {
            if (credential[field] === undefined) {
                return false;
            }
        }

        for (const [key, value] of Object.entries(expected)) {
            if (credential[key] !== value) {
                return false;
            }
        }

        return true;
    }
}

module.exports = TestHelper;
