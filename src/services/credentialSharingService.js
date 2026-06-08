const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const LABSService = require('./LABSService');

/**
 * Credential Sharing Service
 * Handles secure credential sharing with third parties with expiration controls
 */
class CredentialSharingService {
  constructor() {
    this.LABSService = new LABSService();
    // In-memory storage for shared credentials (in production, use a database)
    this.sharedCredentials = new Map();
    this.encryptionKey = process.env.ENCRYPTION_KEY || crypto.randomBytes(32).toString('hex');
  }

  /**
   * Share a credential with a third party
   * @param {string} credentialId - The credential ID to share
   * @param {string} sharedByLABS - The LABS of the user sharing the credential
   * @param {string} sharedWithLABS - The LABS of the third party receiving access
   * @param {object} options - Sharing options
   * @param {number} options.expiresIn - Expiration time in seconds (default: 86400 = 24 hours)
   * @param {number} options.maxAccessCount - Maximum number of times the credential can be accessed (optional)
   * @param {string} options.purpose - Purpose of sharing (optional)
   * @returns {object} Shared credential details with access token
   */
  async shareCredential(credentialId, sharedByLABS, sharedWithLABS, options = {}) {
    try {
      // Validate inputs
      if (!credentialId || !sharedByLABS || !sharedWithLABS) {
        throw new Error('credentialId, sharedByLABS, and sharedWithLABS are required');
      }

      // Verify both LABSs exist
      await this.LABSService.resolveLABS(sharedByLABS);
      await this.LABSService.resolveLABS(sharedWithLABS);

      // Generate unique sharing ID
      const sharingId = crypto.randomUUID();
      
      // Set expiration (default 24 hours)
      const expiresIn = options.expiresIn || 86400;
      const expiresAt = new Date(Date.now() + expiresIn * 1000).toISOString();

      // Create access token with expiration
      const accessToken = jwt.sign(
        {
          sharingId,
          credentialId,
          sharedByLABS,
          sharedWithLABS,
          purpose: options.purpose || 'general'
        },
        this.encryptionKey,
        { expiresIn: `${expiresIn}s` }
      );

      // Store sharing record
      const sharingRecord = {
        sharingId,
        credentialId,
        sharedByLABS,
        sharedWithLABS,
        createdAt: new Date().toISOString(),
        expiresAt,
        maxAccessCount: options.maxAccessCount || null,
        accessCount: 0,
        purpose: options.purpose || 'general',
        status: 'active',
        accessToken: this.hashToken(accessToken)
      };

      this.sharedCredentials.set(sharingId, sharingRecord);

      return {
        success: true,
        data: {
          sharingId,
          accessToken,
          expiresAt,
          maxAccessCount: options.maxAccessCount || null,
          purpose: options.purpose || 'general',
          message: 'Credential shared successfully'
        }
      };
    } catch (error) {
      throw new Error(`Failed to share credential: ${error.message}`);
    }
  }

  /**
   * Access a shared credential
   * @param {string} sharingId - The sharing ID
   * @param {string} accessToken - The access token
   * @param {string} requestorLABS - The LABS of the party requesting access
   * @returns {object} The shared credential if access is granted
   */
  async accessSharedCredential(sharingId, accessToken, requestorLABS) {
    try {
      // Validate inputs
      if (!sharingId || !accessToken || !requestorLABS) {
        throw new Error('sharingId, accessToken, and requestorLABS are required');
      }

      // Retrieve sharing record
      const sharingRecord = this.sharedCredentials.get(sharingId);
      
      if (!sharingRecord) {
        throw new Error('Sharing record not found');
      }

      // Verify access token
      const tokenHash = this.hashToken(accessToken);
      if (tokenHash !== sharingRecord.accessToken) {
        throw new Error('Invalid access token');
      }

      // Verify JWT token
      const decoded = jwt.verify(accessToken, this.encryptionKey);
      
      // Verify the token matches the sharing record
      if (decoded.sharingId !== sharingId) {
        throw new Error('Token does not match sharing record');
      }

      // Verify requestor is authorized
      if (decoded.sharedWithLABS !== requestorLABS) {
        throw new Error('Requestor is not authorized to access this credential');
      }

      // Check if sharing is expired
      if (new Date() > new Date(sharingRecord.expiresAt)) {
        sharingRecord.status = 'expired';
        this.sharedCredentials.set(sharingId, sharingRecord);
        throw new Error('Credential sharing has expired');
      }

      // Check if sharing is still active
      if (sharingRecord.status !== 'active') {
        throw new Error(`Credential sharing is ${sharingRecord.status}`);
      }

      // Check access count limit
      if (sharingRecord.maxAccessCount && sharingRecord.accessCount >= sharingRecord.maxAccessCount) {
        sharingRecord.status = 'exhausted';
        this.sharedCredentials.set(sharingId, sharingRecord);
        throw new Error('Maximum access count reached');
      }

      // Increment access count
      sharingRecord.accessCount++;
      this.sharedCredentials.set(sharingId, sharingRecord);

      // Return credential details (in production, fetch actual credential from storage)
      return {
        success: true,
        data: {
          credentialId: sharingRecord.credentialId,
          sharedBy: sharingRecord.sharedByLABS,
          sharedWith: sharingRecord.sharedWithLABS,
          purpose: sharingRecord.purpose,
          accessCount: sharingRecord.accessCount,
          remainingAccess: sharingRecord.maxAccessCount 
            ? sharingRecord.maxAccessCount - sharingRecord.accessCount 
            : null,
          expiresAt: sharingRecord.expiresAt,
          message: 'Credential accessed successfully'
        }
      };
    } catch (error) {
      throw new Error(`Failed to access shared credential: ${error.message}`);
    }
  }

  /**
   * Revoke a shared credential
   * @param {string} sharingId - The sharing ID
   * @param {string} sharedByLABS - The LABS of the user who shared the credential
   * @returns {object} Revocation confirmation
   */
  async revokeSharedCredential(sharingId, sharedByLABS) {
    try {
      if (!sharingId || !sharedByLABS) {
        throw new Error('sharingId and sharedByLABS are required');
      }

      const sharingRecord = this.sharedCredentials.get(sharingId);
      
      if (!sharingRecord) {
        throw new Error('Sharing record not found');
      }

      // Verify the revoker is the original sharer
      if (sharingRecord.sharedByLABS !== sharedByLABS) {
        throw new Error('Only the original sharer can revoke access');
      }

      // Update status to revoked
      sharingRecord.status = 'revoked';
      sharingRecord.revokedAt = new Date().toISOString();
      this.sharedCredentials.set(sharingId, sharingRecord);

      return {
        success: true,
        data: {
          sharingId,
          status: 'revoked',
          revokedAt: sharingRecord.revokedAt,
          message: 'Credential sharing revoked successfully'
        }
      };
    } catch (error) {
      throw new Error(`Failed to revoke shared credential: ${error.message}`);
    }
  }

  /**
   * Get all shared credentials for a LABS
   * @param {string} LABS - The LABS to query
   * @param {string} role - 'sharedBy' or 'sharedWith'
   * @returns {array} List of shared credentials
   */
  async getSharedCredentials(LABS, role = 'sharedBy') {
    try {
      if (!LABS) {
        throw new Error('LABS is required');
      }

      if (role !== 'sharedBy' && role !== 'sharedWith') {
        throw new Error('Role must be either "sharedBy" or "sharedWith"');
      }

      const sharedList = [];
      
      for (const [sharingId, record] of this.sharedCredentials.entries()) {
        if (record[role] === LABS) {
          sharedList.push({
            sharingId,
            credentialId: record.credentialId,
            [role]: record[role],
            otherParty: role === 'sharedBy' ? record.sharedWithLABS : record.sharedByLABS,
            createdAt: record.createdAt,
            expiresAt: record.expiresAt,
            accessCount: record.accessCount,
            maxAccessCount: record.maxAccessCount,
            purpose: record.purpose,
            status: record.status
          });
        }
      }

      return {
        success: true,
        data: sharedList,
        count: sharedList.length
      };
    } catch (error) {
      throw new Error(`Failed to get shared credentials: ${error.message}`);
    }
  }

  /**
   * Extend expiration of a shared credential
   * @param {string} sharingId - The sharing ID
   * @param {string} sharedByLABS - The LABS of the user who shared the credential
   * @param {number} additionalSeconds - Additional time in seconds to extend
   * @returns {object} Updated sharing details
   */
  async extendSharingExpiration(sharingId, sharedByLABS, additionalSeconds) {
    try {
      if (!sharingId || !sharedByLABS || !additionalSeconds) {
        throw new Error('sharingId, sharedByLABS, and additionalSeconds are required');
      }

      const sharingRecord = this.sharedCredentials.get(sharingId);
      
      if (!sharingRecord) {
        throw new Error('Sharing record not found');
      }

      // Verify the requester is the original sharer
      if (sharingRecord.sharedByLABS !== sharedByLABS) {
        throw new Error('Only the original sharer can extend expiration');
      }

      // Check if sharing is still active
      if (sharingRecord.status !== 'active') {
        throw new Error(`Cannot extend ${sharingRecord.status} sharing`);
      }

      // Extend expiration
      const currentExpiry = new Date(sharingRecord.expiresAt);
      const newExpiry = new Date(currentExpiry.getTime() + additionalSeconds * 1000);
      sharingRecord.expiresAt = newExpiry.toISOString();
      this.sharedCredentials.set(sharingId, sharingRecord);

      return {
        success: true,
        data: {
          sharingId,
          newExpiresAt: sharingRecord.expiresAt,
          message: 'Sharing expiration extended successfully'
        }
      };
    } catch (error) {
      throw new Error(`Failed to extend sharing expiration: ${error.message}`);
    }
  }

  /**
   * Clean up expired sharing records
   * @returns {object} Cleanup results
   */
  cleanupExpiredShares() {
    const now = new Date();
    let cleanedCount = 0;

    for (const [sharingId, record] of this.sharedCredentials.entries()) {
      if (record.status === 'active' && new Date(record.expiresAt) < now) {
        record.status = 'expired';
        this.sharedCredentials.set(sharingId, record);
        cleanedCount++;
      }
    }

    return {
      success: true,
      data: {
        cleanedCount,
        message: `Cleaned up ${cleanedCount} expired sharing records`
      }
    };
  }

  /**
   * Hash a token for secure storage
   * @param {string} token - The token to hash
   * @returns {string} Hashed token
   */
  hashToken(token) {
    return crypto.createHash('sha256').update(token).digest('hex');
  }

  /**
   * Get sharing statistics
   * @returns {object} Statistics about shared credentials
   */
  getStatistics() {
    let active = 0;
    let expired = 0;
    let revoked = 0;
    let exhausted = 0;
    let totalAccess = 0;

    for (const record of this.sharedCredentials.values()) {
      switch (record.status) {
        case 'active':
          active++;
          break;
        case 'expired':
          expired++;
          break;
        case 'revoked':
          revoked++;
          break;
        case 'exhausted':
          exhausted++;
          break;
      }
      totalAccess += record.accessCount;
    }

    return {
      success: true,
      data: {
        total: this.sharedCredentials.size,
        active,
        expired,
        revoked,
        exhausted,
        totalAccess
      }
    };
  }
}

module.exports = CredentialSharingService;
