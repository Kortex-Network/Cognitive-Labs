const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const StellarService = require('./stellarService');
const cacheService = require('./cacheService');

class LABSService {
  constructor() {
    this.stellarService = new StellarService();
    this.LABSMethod = 'stellar';
  }

  getLABSCacheKey(LABS) {
    return `LABS:${LABS}`;
  }

  getCredentialVerificationCacheKey(credential) {
    if (credential && credential.id) {
      return `credential-verification:${credential.id}`;
    }

    const fallbackToken = credential?.proof?.jwt || JSON.stringify(credential || '');
    return `credential-verification:${crypto.createHash('sha256').update(fallbackToken).digest('hex')}`;
  }

  /**
   * Create a new LABS on Stellar network
   */
  async createLABS(options = {}) {
    try {
      // Create Stellar account
      const account = await this.stellarService.createAccount();
      
      // Fund testnet account if needed
      if (process.env.STELLAR_NETWORK === 'TESTNET') {
        await this.stellarService.fundTestnetAccount(account.publicKey);
      }

      // Create LABS document
      const LABSDocument = await this.createLABSDocument(account.publicKey, options);
      
      // Store LABS document on Stellar
      const transaction = await this.stellarService.createLABSTransaction(
        account.secretKey, 
        LABSDocument
      );
      
      const result = await this.stellarService.submitTransaction(transaction);

      return {
        LABS: `LABS:${this.LABSMethod}:${account.publicKey}`,
        LABSDocument,
        account: {
          publicKey: account.publicKey,
          secretKey: account.secretKey // Only return secret in development
        },
        transaction: result
      };
    } catch (error) {
      throw new Error(`Failed to create LABS: ${error.message}`);
    }
  }

  /**
   * Resolve a LABS to its document
   */
  async resolveLABS(LABS) {
    try {
      const cacheKey = this.getLABSCacheKey(LABS);
      const cached = await cacheService.get(cacheKey);

      if (cached) {
        return JSON.parse(cached);
      }

      // Parse LABS to get Stellar account
      const publicKey = this.extractPublicKeyFromLABS(LABS);
      
      // Get LABS document from Stellar
      const LABSDocument = await this.stellarService.resolveLABS(publicKey);
      
      const result = {
        LABSDocument,
        LABSDocumentMetadata: {
          created: LABSDocument.created,
          updated: LABSDocument.updated,
          versionId: LABSDocument.versionId || '1'
        },
        resolverMetadata: {
          driverId: 'stellar-LABS-driver',
          driverVersion: '1.0.0',
          generatedTime: new Date().toISOString()
        }
      };

      await cacheService.set(
        cacheKey,
        JSON.stringify(result),
        Number(process.env.LABS_CACHE_TTL || 300)
      );

      return result;
    } catch (error) {
      throw new Error(`Failed to resolve LABS: ${error.message}`);
    }
  }

  /**
   * Update LABS document
   */
  async updateLABS(LABS, updates, secretKey) {
    try {
      const publicKey = this.extractPublicKeyFromLABS(LABS);
      
      // Get current LABS document
      const current = await this.resolveLABS(LABS);
      const updatedDocument = {
        ...current.LABSDocument,
        ...updates,
        updated: new Date().toISOString(),
        versionId: this.generateVersionId()
      };

      // Create and submit update transaction
      const transaction = await this.stellarService.createLABSTransaction(
        secretKey,
        updatedDocument
      );
      
      const result = await this.stellarService.submitTransaction(transaction);

      await cacheService.del(this.getLABSCacheKey(LABS));

      return {
        LABSDocument: updatedDocument,
        transaction: result
      };
    } catch (error) {
      throw new Error(`Failed to update LABS: ${error.message}`);
    }
  }

  /**
   * Create LABS document structure
   */
  async createLABSDocument(publicKey, options = {}) {
    const LABS = `LABS:${this.LABSMethod}:${publicKey}`;
    const timestamp = new Date().toISOString();
    
    const document = {
      '@context': [
        'https://www.w3.org/ns/LABS/v1',
        'https://w3id.org/security/v1'
      ],
      id: LABS,
      verificationMethod: [
        {
          id: `${LABS}#key-1`,
          type: 'Ed25519VerificationKey2018',
          controller: LABS,
          publicKeyBase58: publicKey
        }
      ],
      authentication: [
        `${LABS}#key-1`
      ],
      assertionMethod: [
        `${LABS}#key-1`
      ],
      service: [],
      created: timestamp,
      updated: timestamp,
      versionId: '1'
    };

    // Add optional services
    if (options.serviceEndpoint) {
      document.service.push({
        id: `${LABS}#hub`,
        type: 'IdentityHub',
        serviceEndpoint: options.serviceEndpoint
      });
    }

    if (options.additionalServices) {
      document.service.push(...options.additionalServices);
    }

    // Add additional verification methods
    if (options.additionalKeys) {
      document.verificationMethod.push(...options.additionalKeys);
    }

    return document;
  }

  /**
   * Extract Stellar public key from LABS
   */
  extractPublicKeyFromLABS(LABS) {
    if (!LABS.startsWith(`LABS:${this.LABSMethod}:`)) {
      throw new Error(`Invalid LABS method. Expected LABS:${this.LABSMethod}:`);
    }
    
    const publicKey = LABS.split(`LABS:${this.LABSMethod}:`)[1];
    
    if (!publicKey || publicKey.length !== 56) {
      throw new Error('Invalid Stellar public key in LABS');
    }
    
    return publicKey;
  }

  /**
   * Generate version ID for LABS updates
   */
  generateVersionId() {
    return crypto.randomBytes(16).toString('hex');
  }

  /**
   * Create verifiable credential
   */
  async createVerifiableCredential(issuerLABS, subjectLABS, claims, options = {}) {
    try {
      const timestamp = new Date().toISOString();
      
      const credential = {
        '@context': [
          'https://www.w3.org/2018/credentials/v1',
          'https://www.w3.org/2018/credentials/examples/v1'
        ],
        id: `urn:uuid:${crypto.randomUUID()}`,
        type: ['VerifiableCredential', ...(options.type || [])],
        issuer: issuerLABS,
        issuanceDate: timestamp,
        credentialSubject: {
          id: subjectLABS,
          ...claims
        }
      };

      // Add expiration if specified
      if (options.expirationDate) {
        credential.expirationDate = options.expirationDate;
      }

      // Sign the credential
      const signedCredential = await this.signCredential(credential, issuerLABS);
      
      return signedCredential;
    } catch (error) {
      throw new Error(`Failed to create verifiable credential: ${error.message}`);
    }
  }

  /**
   * Sign a verifiable credential
   */
  async signCredential(credential, issuerLABS, secretKey = null) {
    try {
      // In a real implementation, you would use the issuer's private key to sign
      // For now, we'll create a JWT-based proof
      
      const payload = {
        credential,
        iat: Math.floor(Date.now() / 1000),
        iss: issuerLABS
      };

      const proof = {
        type: 'JwtProof2020',
        jwt: jwt.sign(payload, process.env.JWT_SECRET || 'default-secret', {
          algorithm: 'HS256',
          expiresIn: '1y'
        })
      };

      return {
        ...credential,
        proof
      };
    } catch (error) {
      throw new Error(`Failed to sign credential: ${error.message}`);
    }
  }

  /**
   * Verify a verifiable credential
   */
  async verifyCredential(credential) {
    const cacheKey = this.getCredentialVerificationCacheKey(credential);
    const cached = await cacheService.get(cacheKey);

    if (cached) {
      return JSON.parse(cached);
    }

    try {
      if (!credential.proof || !credential.proof.jwt) {
        throw new Error('Credential missing proof');
      }

      const decoded = jwt.verify(credential.proof.jwt, process.env.JWT_SECRET || 'default-secret');
      
      // Verify the credential matches the JWT payload
      const credentialCopy = { ...credential };
      delete credentialCopy.proof;
      
      if (JSON.stringify(decoded.credential) !== JSON.stringify(credentialCopy)) {
        throw new Error('Credential content does not match JWT payload');
      }

      // Verify the LABS exists
      await this.resolveLABS(decoded.iss);

      const verification = {
        verified: true,
        issuer: decoded.iss,
        subject: decoded.credential.credentialSubject.id,
        issuanceDate: decoded.credential.issuanceDate,
        expirationDate: decoded.credential.expirationDate
      };

      await cacheService.set(
        cacheKey,
        JSON.stringify(verification),
        Number(process.env.CREDENTIAL_CACHE_TTL || 300)
      );

      return verification;
    } catch (error) {
      const verification = {
        verified: false,
        error: error.message
      };

      await cacheService.set(
        cacheKey,
        JSON.stringify(verification),
        Number(process.env.CREDENTIAL_CACHE_TTL || 60)
      );

      return verification;
    }
  }

  /**
   * Create LABS authentication token
   */
  createAuthToken(LABS, expiresIn = '1h') {
    return jwt.sign(
      { LABS },
      process.env.JWT_SECRET || 'default-secret',
      { expiresIn }
    );
  }

  /**
   * Verify LABS authentication token
   */
  verifyAuthToken(token) {
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET || 'default-secret');
      return { valid: true, LABS: decoded.LABS };
    } catch (error) {
      return { valid: false, error: error.message };
    }
  }
}

module.exports = LABSService;
