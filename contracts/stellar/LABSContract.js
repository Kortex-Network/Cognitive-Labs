/**
 * Stellar LABS Smart Contract Implementation
 * 
 * This represents the smart contract layer for Stellar LABS operations.
 * Stellar uses a different smart contract model than Ethereum.
 */

const StellarSDK = require('stellar-sdk');

class LABSContract {
  constructor(serverUrl = 'https://horizon-testnet.stellar.org') {
    this.server = new StellarSDK.Horizon.Server(serverUrl);
    this.contractAddress = null; // Will be set during deployment
  }

  /**
   * Deploy the LABS registry contract
   */
  async deploy(deployerSecret) {
    try {
      const deployerKeypair = StellarSDK.Keypair.fromSecret(deployerSecret);
      const deployerAccount = await this.server.loadAccount(deployerKeypair.publicKey());

      // Create contract account
      const contractKeypair = StellarSDK.Keypair.random();
      
      const transaction = new StellarSDK.TransactionBuilder(deployerAccount, {
        fee: StellarSDK.BASE_FEE,
        networkPassphrase: StellarSDK.Network.current().networkPassphrase()
      })
        .addOperation(StellarSDK.Operation.createAccount({
          destination: contractKeypair.publicKey(),
          startingBalance: '2.5' // Minimum balance for contract
        }))
        .addOperation(StellarSDK.Operation.manageData({
          name: 'contract_type',
          value: 'stellar_LABS_registry_v1'
        }))
        .addOperation(StellarSDK.Operation.manageData({
          name: 'contract_version',
          value: '1.0.0'
        }))
        .addOperation(StellarSDK.Operation.setOptions({
          masterWeight: 0, // Remove master key
          lowThreshold: 1,
          mediumThreshold: 1,
          highThreshold: 1
        }))
        .setTimeout(30)
        .build();

      transaction.sign(deployerKeypair);
      const result = await this.server.submitTransaction(transaction);

      this.contractAddress = contractKeypair.publicKey();
      
      return {
        contractAddress: this.contractAddress,
        transactionHash: result.hash,
        contractSecret: contractKeypair.secret() // Return for testing
      };
    } catch (error) {
      throw new Error(`Contract deployment failed: ${error.message}`);
    }
  }

  /**
   * Register a new LABS on the contract
   */
  async registerLABS(LABS, publicKey, serviceEndpoint, signerSecret) {
    if (!LABS || !publicKey || !signerSecret) {
      throw new Error('LABS, publicKey, and signerSecret are required');
    }
    if (!LABS.startsWith('LABS:')) {
      throw new Error('LABS must start with "LABS:"');
    }
    try {
      const signerKeypair = StellarSDK.Keypair.fromSecret(signerSecret);
      const contractAccount = await this.server.loadAccount(this.contractAddress);

      // Check LABS doesn't already exist
      const existing = contractAccount.data_attr[`LABS_${LABS}`];
      if (existing) {
        throw new Error('LABS already exists');
      }

      const transaction = new StellarSDK.TransactionBuilder(contractAccount, {
        fee: StellarSDK.BASE_FEE * 3,
        networkPassphrase: StellarSDK.Network.current().networkPassphrase()
      })
        .addOperation(StellarSDK.Operation.manageData({
          name: `LABS_${LABS}`,
          value: JSON.stringify({
            LABS,
            publicKey,
            serviceEndpoint,
            owner: signerKeypair.publicKey(),
            created: new Date().toISOString(),
            active: true
          })
        }))
        .addOperation(StellarSDK.Operation.manageData({
          name: `LABS_owner_${LABS}`,
          value: signerKeypair.publicKey()
        }))
        .addOperation(StellarSDK.Operation.manageData({
          name: `LABS_created_${LABS}`,
          value: new Date().toISOString()
        }))
        .setTimeout(30)
        .build();

      // Sign with contract account (multi-sig setup required)
      // For now, we'll use the signer as proxy
      transaction.sign(signerKeypair);
      
      const result = await this.server.submitTransaction(transaction);
      return result;
    } catch (error) {
      throw new Error(`LABS registration failed: ${error.message}`);
    }
  }

  /**
   * Update LABS document
   */
  async updateLABS(LABS, updates, signerSecret) {
    if (!LABS || !signerSecret) {
      throw new Error('LABS and signerSecret are required');
    }
    try {
      const signerKeypair = StellarSDK.Keypair.fromSecret(signerSecret);
      const contractAccount = await this.server.loadAccount(this.contractAddress);

      // Get current LABS data
      const currentData = await this.getLABS(LABS);

      if (!currentData) {
        throw new Error('LABS not found');
      }

      // Ownership check: only the LABS owner can update it
      if (currentData.owner !== signerKeypair.publicKey()) {
        throw new Error('Unauthorized: only the LABS owner can update this LABS');
      }

      const updatedData = {
        ...currentData,
        ...updates,
        updated: new Date().toISOString()
      };

      const transaction = new StellarSDK.TransactionBuilder(contractAccount, {
        fee: StellarSDK.BASE_FEE,
        networkPassphrase: StellarSDK.Network.current().networkPassphrase()
      })
        .addOperation(StellarSDK.Operation.manageData({
          name: `LABS_${LABS}`,
          value: JSON.stringify(updatedData)
        }))
        .addOperation(StellarSDK.Operation.manageData({
          name: `LABS_updated_${LABS}`,
          value: new Date().toISOString()
        }))
        .setTimeout(30)
        .build();

      transaction.sign(signerKeypair);
      const result = await this.server.submitTransaction(transaction);
      
      return result;
    } catch (error) {
      throw new Error(`LABS update failed: ${error.message}`);
    }
  }

  /**
   * Issue a verifiable credential
   */
  async issueCredential(issuerLABS, subjectLABS, credentialType, claims, signerSecret) {
    if (!issuerLABS || !subjectLABS || !credentialType || !signerSecret) {
      throw new Error('issuerLABS, subjectLABS, credentialType, and signerSecret are required');
    }
    try {
      const signerKeypair = StellarSDK.Keypair.fromSecret(signerSecret);
      const contractAccount = await this.server.loadAccount(this.contractAddress);

      // Verify the issuer LABS exists and the signer is its owner
      const issuerDoc = await this.getLABS(issuerLABS);
      if (!issuerDoc) {
        throw new Error('Issuer LABS not found');
      }
      if (issuerDoc.owner !== signerKeypair.publicKey()) {
        throw new Error('Unauthorized: signer is not the owner of the issuer LABS');
      }

      const credentialId = this.generateCredentialId(issuerLABS, subjectLABS, credentialType);
      
      const credential = {
        id: credentialId,
        issuer: issuerLABS,
        subject: subjectLABS,
        type: credentialType,
        claims,
        issued: new Date().toISOString(),
        revoked: false
      };

      const transaction = new StellarSDK.TransactionBuilder(contractAccount, {
        fee: StellarSDK.BASE_FEE * 2,
        networkPassphrase: StellarSDK.Network.current().networkPassphrase()
      })
        .addOperation(StellarSDK.Operation.manageData({
          name: `credential_${credentialId}`,
          value: JSON.stringify(credential)
        }))
        .addOperation(StellarSDK.Operation.manageData({
          name: `credential_issued_${credentialId}`,
          value: new Date().toISOString()
        }))
        .setTimeout(30)
        .build();

      transaction.sign(signerKeypair);
      const result = await this.server.submitTransaction(transaction);
      
      return { credential, transaction: result };
    } catch (error) {
      throw new Error(`Credential issuance failed: ${error.message}`);
    }
  }

  /**
   * Revoke a credential
   */
  async revokeCredential(credentialId, signerSecret) {
    if (!credentialId || !signerSecret) {
      throw new Error('credentialId and signerSecret are required');
    }
    try {
      const signerKeypair = StellarSDK.Keypair.fromSecret(signerSecret);
      const contractAccount = await this.server.loadAccount(this.contractAddress);

      // Get current credential
      const credential = await this.getCredential(credentialId);

      if (!credential) {
        throw new Error('Credential not found');
      }

      if (credential.revoked) {
        throw new Error('Credential is already revoked');
      }

      // Issuer ownership check: only the issuer's LABS owner can revoke
      const issuerDoc = await this.getLABS(credential.issuer);
      if (!issuerDoc) {
        throw new Error('Issuer LABS not found');
      }
      if (issuerDoc.owner !== signerKeypair.publicKey()) {
        throw new Error('Unauthorized: only the credential issuer can revoke this credential');
      }

      const updatedCredential = {
        ...credential,
        revoked: true,
        revokedAt: new Date().toISOString()
      };

      const transaction = new StellarSDK.TransactionBuilder(contractAccount, {
        fee: StellarSDK.BASE_FEE,
        networkPassphrase: StellarSDK.Network.current().networkPassphrase()
      })
        .addOperation(StellarSDK.Operation.manageData({
          name: `credential_${credentialId}`,
          value: JSON.stringify(updatedCredential)
        }))
        .addOperation(StellarSDK.Operation.manageData({
          name: `credential_revoked_${credentialId}`,
          value: new Date().toISOString()
        }))
        .setTimeout(30)
        .build();

      transaction.sign(signerKeypair);
      const result = await this.server.submitTransaction(transaction);
      
      return result;
    } catch (error) {
      throw new Error(`Credential revocation failed: ${error.message}`);
    }
  }

  /**
   * Get LABS document from contract
   */
  async getLABS(LABS) {
    try {
      const account = await this.server.loadAccount(this.contractAddress);
      const LABSData = account.data_attr[`LABS_${LABS}`];
      
      if (!LABSData) {
        return null;
      }

      return JSON.parse(LABSData);
    } catch (error) {
      throw new Error(`Failed to get LABS: ${error.message}`);
    }
  }

  /**
   * Get credential from contract
   */
  async getCredential(credentialId) {
    try {
      const account = await this.server.loadAccount(this.contractAddress);
      const credentialData = account.data_attr[`credential_${credentialId}`];
      
      if (!credentialData) {
        return null;
      }

      return JSON.parse(credentialData);
    } catch (error) {
      throw new Error(`Failed to get credential: ${error.message}`);
    }
  }

  /**
   * Get all LABSs for an owner
   */
  async getOwnerLABSs(ownerPublicKey) {
    try {
      const account = await this.server.loadAccount(this.contractAddress);
      const LABSs = [];
      
      // Find all LABS entries for this owner
      Object.keys(account.data_attr).forEach(key => {
        if (key.startsWith('LABS_owner_')) {
          const LABS = key.replace('LABS_owner_', '');
          const LABSData = account.data_attr[`LABS_${LABS}`];
          
          if (LABSData) {
            const parsed = JSON.parse(LABSData);
            if (parsed.owner === ownerPublicKey) {
              LABSs.push(parsed);
            }
          }
        }
      });

      return LABSs;
    } catch (error) {
      throw new Error(`Failed to get owner LABSs: ${error.message}`);
    }
  }

  /**
   * Get contract information
   */
  async getContractInfo() {
    try {
      const account = await this.server.loadAccount(this.contractAddress);
      
      return {
        address: this.contractAddress,
        type: account.data_attr.contract_type,
        version: account.data_attr.contract_version,
        dataEntries: Object.keys(account.data_attr).length
      };
    } catch (error) {
      throw new Error(`Failed to get contract info: ${error.message}`);
    }
  }

  /**
   * Generate unique credential ID
   */
  generateCredentialId(issuerLABS, subjectLABS, credentialType) {
    const crypto = require('crypto');
    const data = `${issuerLABS}${subjectLABS}${credentialType}${Date.now()}`;
    return crypto.createHash('sha256').update(data).digest('hex').substring(0, 32);
  }

  /**
   * Verify credential signature (mock implementation)
   */
  async verifyCredential(credentialId) {
    try {
      const credential = await this.getCredential(credentialId);
      
      if (!credential) {
        return { valid: false, error: 'Credential not found' };
      }

      if (credential.revoked) {
        return { valid: false, error: 'Credential has been revoked' };
      }

      // Additional verification logic would go here
      // For now, just check if it exists and isn't revoked
      
      return { 
        valid: true, 
        credential,
        verifiedAt: new Date().toISOString()
      };
    } catch (error) {
      return { valid: false, error: error.message };
    }
  }
}

module.exports = LABSContract;
