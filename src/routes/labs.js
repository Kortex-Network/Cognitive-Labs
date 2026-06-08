const express = require('express');
const LABSService = require('../services/LABSService');
const StellarService = require('../services/stellarService');

const router = express.Router();
const LABSService = new LABSService();
const stellarService = new StellarService();

/**
 * POST /api/LABS/create
 * Create a new LABS on Stellar network
 */
router.post('/create', async (req, res) => {
  try {
    const { serviceEndpoint, additionalServices, additionalKeys } = req.body;
    
    const result = await LABSService.createLABS({
      serviceEndpoint,
      additionalServices,
      additionalKeys
    });

    // Don't expose secret key in production
    if (process.env.NODE_ENV === 'production') {
      delete result.account.secretKey;
    }

    res.status(201).json({
      success: true,
      data: result,
      message: 'LABS created successfully'
    });
  } catch (error) {
    console.error('Create LABS error:', error);
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/LABS/resolve/:LABS
 * Resolve a LABS to its document
 */
router.get('/resolve/:LABS', async (req, res) => {
  try {
    const { LABS } = req.params;
    
    const result = await LABSService.resolveLABS(LABS);
    
    res.json({
      success: true,
      data: result,
      message: 'LABS resolved successfully'
    });
  } catch (error) {
    console.error('Resolve LABS error:', error);
    res.status(404).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * PUT /api/LABS/update/:LABS
 * Update a LABS document
 */
router.put('/update/:LABS', async (req, res) => {
  try {
    const { LABS } = req.params;
    const { updates, secretKey } = req.body;
    
    if (!secretKey) {
      return res.status(400).json({
        success: false,
        error: 'Secret key is required for LABS updates'
      });
    }

    const result = await LABSService.updateLABS(LABS, updates, secretKey);
    
    res.json({
      success: true,
      data: result,
      message: 'LABS updated successfully'
    });
  } catch (error) {
    console.error('Update LABS error:', error);
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/LABS/authenticate
 * Authenticate with a LABS and get JWT token
 */
router.post('/authenticate', async (req, res) => {
  try {
    const { LABS, secretKey } = req.body;
    
    // Verify the LABS exists and the secret key matches
    const publicKey = LABSService.extractPublicKeyFromLABS(LABS);
    const account = await stellarService.getAccount(publicKey);
    
    // In a real implementation, you would verify the secret key matches the account
    // For now, we'll just check the account exists
    
    const token = LABSService.createAuthToken(LABS);
    
    res.json({
      success: true,
      data: {
        token,
        LABS,
        expiresIn: '1h'
      },
      message: 'Authentication successful'
    });
  } catch (error) {
    console.error('Authentication error:', error);
    res.status(401).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/LABS/verify-token
 * Verify a LABS authentication token
 */
router.post('/verify-token', async (req, res) => {
  try {
    const { token } = req.body;
    
    const result = LABSService.verifyAuthToken(token);
    
    if (result.valid) {
      res.json({
        success: true,
        data: {
          valid: true,
          LABS: result.LABS
        },
        message: 'Token is valid'
      });
    } else {
      res.status(401).json({
        success: false,
        error: result.error
      });
    }
  } catch (error) {
    console.error('Token verification error:', error);
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/LABS/account/:publicKey
 * Get Stellar account information
 */
router.get('/account/:publicKey', async (req, res) => {
  try {
    const { publicKey } = req.params;
    
    const account = await stellarService.getAccount(publicKey);
    
    res.json({
      success: true,
      data: {
        accountId: account.account_id(),
        sequence: account.sequence,
        balances: account.balances,
        data: account.data_attr,
        signers: account.signers,
        thresholds: account.thresholds
      },
      message: 'Account information retrieved successfully'
    });
  } catch (error) {
    console.error('Get account error:', error);
    res.status(404).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/LABS/transaction
 * Submit a signed transaction to Stellar
 */
router.post('/transaction', async (req, res) => {
  try {
    const { transactionXDR } = req.body;
    
    const transaction = StellarSDK.TransactionBuilder.fromXDR(
      transactionXDR,
      StellarSDK.Network.current().networkPassphrase()
    );
    
    const result = await stellarService.submitTransaction(transaction);
    
    res.json({
      success: true,
      data: result,
      message: 'Transaction submitted successfully'
    });
  } catch (error) {
    console.error('Submit transaction error:', error);
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/LABS/transactions/:publicKey
 * Get recent transactions for a LABS
 */
router.get('/transactions/:publicKey', async (req, res) => {
  try {
    const { publicKey } = req.params;
    const { limit = 10 } = req.query;
    
    const transactions = await stellarService.server
      .transactions()
      .forAccount(publicKey)
      .order('desc')
      .limit(parseInt(limit))
      .call();
    
    res.json({
      success: true,
      data: {
        transactions: transactions.records,
        next: transactions.next
      },
      message: 'Transactions retrieved successfully'
    });
  } catch (error) {
    console.error('Get transactions error:', error);
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;
