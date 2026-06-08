const express = require('express');
const Joi = require('joi');
const ContractService = require('../services/contractService');
const { authMiddleware, logger } = require('../middleware');
const { validateEndpoint, sanitizeParams } = require('../middleware/inputValidation');
const RBACMiddleware = require('../middleware/rbacMiddleware');

const router = express.Router();
const contractService = new ContractService();
const rbacMiddleware = new RBACMiddleware();

// Validation schemas
const deployContractSchema = Joi.object({
  deployerSecret: Joi.string().required().min(56).max(56)
});

const registerLABSSchema = Joi.object({
  LABS: Joi.string().required().pattern(/^LABS:stellar:G[A-Z0-9]{55}$/),
  publicKey: Joi.string().required().min(56).max(56),
  serviceEndpoint: Joi.string().uri().optional(),
  signerSecret: Joi.string().required().min(56).max(56)
});

const updateLABSSchema = Joi.object({
  LABS: Joi.string().required().pattern(/^LABS:stellar:G[A-Z0-9]{55}$/),
  updates: Joi.object({
    publicKey: Joi.string().min(56).max(56).optional(),
    serviceEndpoint: Joi.string().uri().optional()
  }).required(),
  signerSecret: Joi.string().required().min(56).max(56)
});

const issueCredentialSchema = Joi.object({
  issuerLABS: Joi.string().required().pattern(/^LABS:stellar:G[A-Z0-9]{55}$/),
  subjectLABS: Joi.string().required().pattern(/^LABS:stellar:G[A-Z0-9]{55}$/),
  credentialType: Joi.string().required(),
  claims: Joi.object().required(),
  signerSecret: Joi.string().required().min(56).max(56)
});

/**
 * @openapi
 * tags:
 *   name: Contracts
 *   description: Smart contract operations for LABS and Credentials on Stellar
 */

/**
 * @openapi
 * /contracts/deploy:
 *   post:
 *     summary: Deploy LABS registry contract
 *     tags: [Contracts]
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [deployerSecret]
 *             properties:
 *               deployerSecret:
 *                 type: string
 *                 description: Stellar secret key of the deployer
 *     responses:
 *       201:
 *         description: Contract deployed successfully
 *       400:
 *         description: Validation error
 *       500:
 *         description: Server error
 */
router.post('/deploy', 
  rbacMiddleware.authenticate(),
  rbacMiddleware.requirePermission('contract.deploy'),
  rbacMiddleware.auditLog('contract_deploy'),
  async (req, res, next) => {
    try {
      const { error, value } = deployContractSchema.validate(req.body);
      
      if (error) {
        return res.status(400).json({
          success: false,
          error: 'Validation error',
          details: error.details.map(d => d.message)
        });
      }

      const { deployerSecret } = value;
      
      logger.info('Deploying LABS registry contract', { userId: req.userId });
      
      const result = await contractService.deployContract(deployerSecret);
      
      res.status(201).json({
        success: true,
        data: result,
        message: 'Contract deployed successfully'
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * @openapi
 * /contracts/register-LABS:
 *   post:
 *     summary: Register a new LABS on the blockchain
 *     tags: [Contracts]
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [LABS, publicKey, signerSecret]
 *             properties:
 *               LABS:
 *                 type: string
 *               publicKey:
 *                 type: string
 *               serviceEndpoint:
 *                 type: string
 *               signerSecret:
 *                 type: string
 *     responses:
 *       201:
 *         description: LABS registered successfully
 */
router.post('/register-LABS', 
  rbacMiddleware.authenticate(),
  rbacMiddleware.requirePermission('LABS.create'),
  rbacMiddleware.auditLog('LABS_register'),
  validateEndpoint('registerLABS'),
  async (req, res, next) => {
    try {
      const { LABS, publicKey, serviceEndpoint, signerSecret } = req.body;
      
      logger.info('Registering LABS on blockchain', { LABS, userId: req.userId });
      
      const result = await contractService.registerLABS(
        LABS,
        publicKey,
        serviceEndpoint,
        signerSecret
      );
      
      res.status(201).json({
        success: true,
        data: result,
        message: 'LABS registered successfully'
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * @openapi
 * /contracts/update-LABS:
 *   put:
 *     summary: Update LABS document on blockchain
 *     tags: [Contracts]
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200:
 *         description: LABS updated successfully
 */
router.put('/update-LABS', 
  rbacMiddleware.authenticate(),
  rbacMiddleware.requirePermission('LABS.update'),
  rbacMiddleware.auditLog('LABS_update'),
  async (req, res, next) => {
    try {
      const { error, value } = updateLABSSchema.validate(req.body);
      
      if (error) {
        return res.status(400).json({
          success: false,
          error: 'Validation error',
          details: error.details.map(d => d.message)
        });
      }

      const { LABS, updates, signerSecret } = value;
      
      logger.info('Updating LABS on blockchain', { LABS, userId: req.userId });
      
      const result = await contractService.updateLABS(LABS, updates, signerSecret);
      
      res.json({
        success: true,
        data: result,
        message: 'LABS updated successfully'
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * @openapi
 * /contracts/issue-credential:
 *   post:
 *     summary: Issue verifiable credential on blockchain
 *     tags: [Contracts]
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       201:
 *         description: Credential issued successfully
 */
router.post('/issue-credential', 
  rbacMiddleware.authenticate(),
  rbacMiddleware.requirePermission('credential.issue'),
  rbacMiddleware.auditLog('credential_issue'),
  validateEndpoint('issueCredential'),
  async (req, res, next) => {
    try {
      const { issuerLABS, subjectLABS, credentialType, claims, signerSecret } = req.body;
      
      logger.info('Issuing credential on blockchain', {
        issuerLABS,
        subjectLABS,
        credentialType,
        userId: req.userId
      });
      
      const result = await contractService.issueCredential(
        issuerLABS,
        subjectLABS,
        credentialType,
        claims,
        signerSecret
      );
      
      res.status(201).json({
        success: true,
        data: result,
        message: 'Credential issued successfully'
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * @openapi
 * /contracts/revoke-credential:
 *   post:
 *     summary: Revoke credential on blockchain
 *     tags: [Contracts]
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200:
 *         description: Credential revoked successfully
 */
router.post('/revoke-credential', 
  rbacMiddleware.authenticate(),
  rbacMiddleware.requirePermission('credential.revoke'),
  rbacMiddleware.auditLog('credential_revoke'),
  validateEndpoint('revokeCredential'),
  async (req, res, next) => {
    try {
      const { credentialId, signerSecret } = req.body;
      
      logger.info('Revoking credential on blockchain', { credentialId, userId: req.userId });
      
      const result = await contractService.revokeCredential(credentialId, signerSecret);
    
    res.json({
      success: true,
      data: result,
      message: 'Credential revoked successfully'
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @openapi
 * /contracts/LABS/{LABS}:
 *   get:
 *     summary: Get LABS document from blockchain
 *     tags: [Contracts]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: LABS
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: LABS retrieved successfully
 *       404:
 *         description: LABS not found
 */
router.get('/LABS/:LABS', sanitizeParams, async (req, res, next) => {
  try {
    const { LABS } = req.params;
    
    // Validate LABS format
    if (!LABS.match(/^LABS:stellar:G[A-Z0-9]{55}$/)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid LABS format'
      });
    }
    
    logger.debug('Getting LABS from blockchain', { LABS });
    
    const LABSDocument = await contractService.getLABS(LABS);
    
    if (!LABSDocument) {
      return res.status(404).json({
        success: false,
        error: 'LABS not found'
      });
    }
    
    res.json({
      success: true,
      data: LABSDocument,
      message: 'LABS retrieved successfully'
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @openapi
 * /contracts/credential/{credentialId}:
 *   get:
 *     summary: Get credential from blockchain
 *     tags: [Contracts]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: credentialId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Credential retrieved successfully
 */
router.get('/credential/:credentialId', sanitizeParams, async (req, res, next) => {
  try {
    const { credentialId } = req.params;
    
    logger.debug('Getting credential from blockchain', { credentialId });
    
    const credential = await contractService.getCredential(credentialId);
    
    if (!credential) {
      return res.status(404).json({
        success: false,
        error: 'Credential not found'
      });
    }
    
    res.json({
      success: true,
      data: credential,
      message: 'Credential retrieved successfully'
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @openapi
 * /contracts/owner-LABSs/{publicKey}:
 *   get:
 *     summary: Get all LABSs for an owner
 *     tags: [Contracts]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: publicKey
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Owner LABSs retrieved successfully
 */
router.get('/owner-LABSs/:publicKey', async (req, res, next) => {
  try {
    const { publicKey } = req.params;
    
    // Validate Stellar address
    if (!contractService.validateStellarAddress(publicKey)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid Stellar public key'
      });
    }
    
    logger.debug('Getting owner LABSs', { publicKey });
    
    const LABSs = await contractService.getOwnerLABSs(publicKey);
    
    res.json({
      success: true,
      data: LABSs,
      count: LABSs.length,
      message: 'Owner LABSs retrieved successfully'
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @openapi
 * /contracts/verify-credential:
 *   post:
 *     summary: Verify credential on blockchain
 *     tags: [Contracts]
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200:
 *         description: Credential verified successfully
 */
router.post('/verify-credential', validateEndpoint('verifyCredential'), async (req, res, next) => {
  try {
    const { credentialId } = req.body;
    
    logger.info('Verifying credential on blockchain', { credentialId });
    
    const verification = await contractService.verifyCredential(credentialId);
    
    res.json({
      success: true,
      data: verification,
      message: verification.valid ? 
        'Credential verified successfully' : 
        'Credential verification failed'
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @openapi
 * /contracts/info:
 *   get:
 *     summary: Get contract information
 *     tags: [Contracts]
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200:
 *         description: Contract information retrieved successfully
 */
router.get('/info', async (req, res, next) => {
  try {
    logger.debug('Getting contract information');
    
    const info = await contractService.getContractInfo();
    
    res.json({
      success: true,
      data: info,
      message: 'Contract information retrieved successfully'
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @openapi
 * /contracts/create-account:
 *   post:
 *     summary: Create new Stellar account
 *     tags: [Contracts]
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       201:
 *         description: Account created successfully
 */
router.post('/create-account', async (req, res, next) => {
  try {
    logger.info('Creating new Stellar account');
    
    const account = await contractService.createAccount();
    
    res.status(201).json({
      success: true,
      data: account,
      message: 'Account created successfully'
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @openapi
 * /contracts/fund-account:
 *   post:
 *     summary: Fund testnet account
 *     tags: [Contracts]
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200:
 *         description: Account funded successfully
 */
router.post('/fund-account', validateEndpoint('fundAccount'), async (req, res, next) => {
  try {
    const { publicKey } = req.body;
    
    logger.info('Funding testnet account', { publicKey });
    
    const result = await contractService.fundTestnetAccount(publicKey);
    
    res.json({
      success: true,
      data: result,
      message: 'Account funded successfully'
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @openapi
 * /contracts/account/{publicKey}:
 *   get:
 *     summary: Get account information
 *     tags: [Contracts]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: publicKey
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Account information retrieved successfully
 */
router.get('/account/:publicKey', async (req, res, next) => {
  try {
    const { publicKey } = req.params;
    
    logger.debug('Getting account information', { publicKey });
    
    const account = await contractService.getAccount(publicKey);
    
    res.json({
      success: true,
      data: account,
      message: 'Account information retrieved successfully'
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;

