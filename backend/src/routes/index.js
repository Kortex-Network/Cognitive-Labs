const express = require('express');
const router = express.Router();
<<<<<<< HEAD
const { validateEndpoint, validateInput, sanitizeQuery, sanitizeParams } = require('../middleware/inputValidation');
=======
const templateService = require('../services/templateService');
const webhookService = require('../services/webhookService');
const Webhook = require('../models/Webhook'); // For basic CRUD without a service wrapper for all operations
const analyticsService = require('../services/analyticsService');
>>>>>>> upstream/main

const v1Routes = require('./v1');

<<<<<<< HEAD
// Apply sanitization middleware globally
router.use(sanitizeQuery);
router.use(sanitizeParams);

/**
 * @route   GET /api
 * @desc    Get API routes info
 * @access  Public
 */
router.get('/', (req, res) => {
  res.json({ 
    message: 'API routes works',
    endpoints: [
      'POST /contracts/create-account - Create Stellar account',
      'POST /contracts/fund-account - Fund Stellar account',
      'GET /contracts/account/:publicKey - Get account balance',
      'POST /contracts/sign-transaction - Sign transaction'
    ]
  });
});

// Secure account creation
router.post('/contracts/create-account', async (req, res) => {
  try {
    const StellarSdk = require('stellar-sdk');
    const pair = StellarSdk.Keypair.random();
    
    const accountData = {
      publicKey: pair.publicKey(),
      secretKey: pair.secret(),
      network: stellarConfig.network,
    };
    
    res.json({
      success: true,
      data: accountData,
    });
  } catch (error) {
    console.error('Account creation error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create account',
    });
  }
});

// Secure account funding
router.post('/contracts/fund-account', validateEndpoint('fundAccount'), async (req, res) => {
  try {
    const { publicKey } = req.body;
    
    // Use Friendbot for testnet funding
    if (stellarConfig.network === 'TESTNET') {
      const response = await fetch(`${stellarConfig.friendbotUrl}?addr=${publicKey}`);
      
      if (response.ok) {
        const result = await response.json();
        res.json({
          success: true,
          data: result,
        });
      } else {
        res.status(400).json({
          success: false,
          error: 'Failed to fund account',
        });
=======
/**
 * @openapi
 * tags:
 *   name: Templates
 *   description: Credential template management
 *   name: Webhooks
 *   description: Webhook subscriptions and notifications
 */

// API Versioning Strategy
router.use(v1Routes);

// Analytics routes (temporarily at root for testing)
router.get('/analytics/dashboard', async (req, res) => {
  try {
    const { timeRange = '30d' } = req.query;
    const validTimeRanges = ['7d', '30d', '90d', '1y'];
    if (!validTimeRanges.includes(timeRange)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid timeRange. Must be one of: 7d, 30d, 90d, 1y'
      });
    }
    const analytics = await analyticsService.getDashboardAnalytics(timeRange);
    res.json({
      success: true,
      data: analytics,
      meta: {
        timeRange,
        generatedAt: new Date().toISOString()
>>>>>>> upstream/main
      }
    });
  } catch (error) {
    console.error('Error fetching dashboard analytics:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

<<<<<<< HEAD
// Secure account balance
router.get('/contracts/account/:publicKey', validateInput('publicKey', 'params'), async (req, res) => {
=======
// Fallback for missing versions or root
router.get('/', (req, res) => {
  res.json({
    message: 'Cognitive Lab LABS API',
    versions: ['v1'],
    current_version: 'v1'
  });
});

/**
 * @openapi
 * /templates:
 *   get:
 *     summary: Get credential templates
 *     tags: [Templates]
 *     parameters:
 *       - in: query
 *         name: type
 *         schema:
 *           type: string
 *         description: Filter by template type
 *     responses:
 *       200:
 *         description: List of credential templates
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   id:
 *                     type: string
 *                   name:
 *                     type: string
 *                   claims:
 *                     type: object
 */
// --- Credential Templates ---

router.get('/templates', async (req, res) => {
>>>>>>> upstream/main
  try {
    const templates = await templateService.getTemplates(req.query);
    res.json({ success: true, data: templates });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

<<<<<<< HEAD
// Secure transaction signing
router.post('/contracts/sign-transaction', validateEndpoint('signTransaction'), async (req, res) => {
  try {
    const { transactionXDR, secretKey } = req.body;
    
    const StellarSdk = require('stellar-sdk');
    const keypair = StellarSdk.Keypair.fromSecret(secretKey);
    const transaction = StellarSdk.TransactionBuilder.fromXDR(transactionXDR, stellarConfig.passphrase);
    
    transaction.sign(keypair);
    
    res.json({
      success: true,
      data: {
        signedXDR: transaction.toXDR(),
      },
    });
=======
/**
 * @openapi
 * /templates:
 *   post:
 *     summary: Create a new credential template
 *     tags: [Templates]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name, claims]
 *             properties:
 *               name:
 *                 type: string
 *               claims:
 *                 type: object
 *                 description: Template claims schema
 *     responses:
 *       201:
 *         description: Template created successfully
 */
router.post('/templates', async (req, res) => {
  try {
    const template = await templateService.createTemplate(req.body);
    res.json({ success: true, data: template });
>>>>>>> upstream/main
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * @openapi
 * /templates/{id}:
 *   get:
 *     summary: Get credential template by ID
 *     tags: [Templates]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Template details
 *       404:
 *         description: Template not found
 */
router.get('/templates/:id', async (req, res) => {
  try {
    const template = await templateService.getTemplateById(req.params.id);
    res.json({ success: true, data: template });
  } catch (error) {
    res.status(404).json({ success: false, error: error.message });
  }
});

/**
 * @openapi
 * /webhooks:
 *   get:
 *     summary: List active webhooks
 *     tags: [Webhooks]
 *     responses:
 *       200:
 *         description: List of webhook subscriptions
 */
// --- Webhooks ---

router.get('/webhooks', async (req, res) => {
  try {
    const webhooks = await Webhook.find({ active: true });
    res.json({ success: true, data: webhooks });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * @openapi
 * /webhooks:
 *   post:
 *     summary: Create a new webhook
 *     tags: [Webhooks]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               url:
 *                 type: string
 *                 format: uri
 *               event:
 *                 type: string
 *               active:
 *                 type: boolean
 *     responses:
 *       201:
 *         description: Webhook created successfully
 */
router.post('/webhooks', async (req, res) => {
  try {
    const webhook = new Webhook(req.body);
    await webhook.save();
    res.json({ success: true, data: webhook });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

/**
 * @openapi
 * /webhooks/{id}:
 *   delete:
 *     summary: Deactivate a webhook
 *     tags: [Webhooks]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Webhook deactivated successfully
 */
router.delete('/webhooks/:id', async (req, res) => {
  try {
    await Webhook.findByIdAndUpdate(req.params.id, { active: false });
    res.json({ success: true, message: 'Webhook deactivated' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;

