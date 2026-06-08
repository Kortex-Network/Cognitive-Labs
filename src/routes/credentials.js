const express = require('express');
const LABSService = require('../services/LABSService');

const router = express.Router();
const LABSService = new LABSService();

/**
 * POST /api/credentials/issue
 * Issue a new verifiable credential
 */
router.post('/issue', async (req, res) => {
  try {
    const { 
      issuerLABS, 
      subjectLABS, 
      claims, 
      type = [],
      expirationDate,
      issuerSecretKey 
    } = req.body;

    // Validate required fields
    if (!issuerLABS || !subjectLABS || !claims) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: issuerLABS, subjectLABS, claims'
      });
    }

    // Verify issuer LABS exists
    await LABSService.resolveLABS(issuerLABS);
    
    // Verify subject LABS exists
    await LABSService.resolveLABS(subjectLABS);

    const credential = await LABSService.createVerifiableCredential(
      issuerLABS,
      subjectLABS,
      claims,
      {
        type,
        expirationDate
      }
    );

    res.status(201).json({
      success: true,
      data: credential,
      message: 'Verifiable credential issued successfully'
    });
  } catch (error) {
    console.error('Issue credential error:', error);
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/credentials/verify
 * Verify a verifiable credential
 */
router.post('/verify', async (req, res) => {
  try {
    const { credential } = req.body;

    if (!credential) {
      return res.status(400).json({
        success: false,
        error: 'Credential is required'
      });
    }

    const verification = await LABSService.verifyCredential(credential);

    res.json({
      success: true,
      data: verification,
      message: verification.verified ? 
        'Credential verified successfully' : 
        'Credential verification failed'
    });
  } catch (error) {
    console.error('Verify credential error:', error);
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/credentials/batch-issue
 * Issue multiple verifiable credentials at once
 */
router.post('/batch-issue', async (req, res) => {
  try {
    const { issuerLABS, credentials } = req.body;

    if (!issuerLABS || !credentials || !Array.isArray(credentials)) {
      return res.status(400).json({
        success: false,
        error: 'issuerLABS and credentials array are required'
      });
    }

    // Verify issuer LABS exists
    await LABSService.resolveLABS(issuerLABS);

    const issuedCredentials = [];

    for (const cred of credentials) {
      const { subjectLABS, claims, type = [], expirationDate } = cred;
      
      // Verify subject LABS exists
      await LABSService.resolveLABS(subjectLABS);
      
      const credential = await LABSService.createVerifiableCredential(
        issuerLABS,
        subjectLABS,
        claims,
        {
          type,
          expirationDate
        }
      );
      
      issuedCredentials.push(credential);
    }

    res.status(201).json({
      success: true,
      data: issuedCredentials,
      message: `${issuedCredentials.length} credentials issued successfully`
    });
  } catch (error) {
    console.error('Batch issue credentials error:', error);
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/credentials/batch-verify
 * Verify multiple verifiable credentials
 */
router.post('/batch-verify', async (req, res) => {
  try {
    const { credentials } = req.body;

    if (!credentials || !Array.isArray(credentials)) {
      return res.status(400).json({
        success: false,
        error: 'Credentials array is required'
      });
    }

    const verifications = [];

    for (const credential of credentials) {
      const verification = await LABSService.verifyCredential(credential);
      verifications.push({
        credentialId: credential.id,
        ...verification
      });
    }

    res.json({
      success: true,
      data: verifications,
      message: `${verifications.length} credentials verified`
    });
  } catch (error) {
    console.error('Batch verify credentials error:', error);
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/credentials/templates
 * Get predefined credential templates
 */
router.get('/templates', (req, res) => {
  const templates = [
    {
      id: 'university-degree',
      name: 'University Degree',
      type: ['VerifiableCredential', 'UniversityDegreeCredential'],
      claims: {
        degree: 'Bachelor of Science',
        major: 'Computer Science',
        university: 'Example University',
        graduationDate: '2023-06-15',
        gpa: '3.8'
      }
    },
    {
      id: 'professional-license',
      name: 'Professional License',
      type: ['VerifiableCredential', 'ProfessionalLicenseCredential'],
      claims: {
        licenseType: 'Medical Doctor',
        licenseNumber: 'MD123456',
        issuingBoard: 'State Medical Board',
        issuedDate: '2020-01-15',
        expirationDate: '2025-01-15',
        status: 'Active'
      }
    },
    {
      id: 'age-verification',
      name: 'Age Verification',
      type: ['VerifiableCredential', 'AgeVerificationCredential'],
      claims: {
        isOver18: true,
        isOver21: true,
        verificationMethod: 'Document Verification'
      }
    },
    {
      id: 'employment-verification',
      name: 'Employment Verification',
      type: ['VerifiableCredential', 'EmploymentCredential'],
      claims: {
        employer: 'Tech Company Inc.',
        position: 'Software Engineer',
        startDate: '2021-03-01',
        currentEmployee: true,
        department: 'Engineering'
      }
    },
    {
      id: 'identity-verification',
      name: 'Identity Verification',
      type: ['VerifiableCredential', 'IdentityCredential'],
      claims: {
        verifiedName: 'John Doe',
        verifiedDateOfBirth: '1990-01-01',
        verificationLevel: 'High',
        verificationMethod: 'Government ID',
        verifiedCountry: 'US'
      }
    }
  ];

  res.json({
    success: true,
    data: templates,
    message: 'Credential templates retrieved successfully'
  });
});

/**
 * POST /api/credentials/from-template
 * Create a credential from a template
 */
router.post('/from-template', async (req, res) => {
  try {
    const { 
      templateId, 
      issuerLABS, 
      subjectLABS, 
      customClaims = {},
      expirationDate 
    } = req.body;

    if (!templateId || !issuerLABS || !subjectLABS) {
      return res.status(400).json({
        success: false,
        error: 'templateId, issuerLABS, and subjectLABS are required'
      });
    }

    // Get templates
    const templatesResponse = await new Promise((resolve) => {
      require('./credentials').get('/templates', {}, resolve);
    });
    
    const template = templatesResponse.data.find(t => t.id === templateId);
    
    if (!template) {
      return res.status(404).json({
        success: false,
        error: 'Template not found'
      });
    }

    // Merge template claims with custom claims
    const claims = { ...template.claims, ...customClaims };

    const credential = await LABSService.createVerifiableCredential(
      issuerLABS,
      subjectLABS,
      claims,
      {
        type: template.type,
        expirationDate
      }
    );

    res.status(201).json({
      success: true,
      data: credential,
      message: `Credential created from ${template.name} template`
    });
  } catch (error) {
    console.error('Create credential from template error:', error);
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/credentials/revoke
 * Revoke a verifiable credential (placeholder implementation)
 */
router.post('/revoke', async (req, res) => {
  try {
    const { credentialId, issuerLABS, reason } = req.body;

    if (!credentialId || !issuerLABS) {
      return res.status(400).json({
        success: false,
        error: 'credentialId and issuerLABS are required'
      });
    }

    // In a real implementation, you would:
    // 1. Verify the issuer has authority to revoke
    // 2. Add the credential to a revocation list
    // 3. Store the revocation on the blockchain

    const revocation = {
      credentialId,
      issuerLABS,
      revokedAt: new Date().toISOString(),
      reason: reason || 'Revoked by issuer',
      status: 'revoked'
    };

    res.json({
      success: true,
      data: revocation,
      message: 'Credential revoked successfully'
    });
  } catch (error) {
    console.error('Revoke credential error:', error);
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;
