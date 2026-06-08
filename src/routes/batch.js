const express = require('express');
const { BatchService, BatchOperationType, BatchStatus } = require('../services/batchService');

const router = express.Router();
const batchService = new BatchService();

/**
 * POST /api/batch/execute
 * Execute a batch of operations with atomic execution and rollback
 */
router.post('/execute', async (req, res) => {
  try {
    const { operations, rollbackOnError = true } = req.body;

    if (!operations || !Array.isArray(operations)) {
      return res.status(400).json({
        success: false,
        error: 'Operations array is required'
      });
    }

    if (operations.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'At least one operation is required'
      });
    }

    // Validate operations
    for (const operation of operations) {
      if (!operation.type || !Object.values(BatchOperationType).includes(operation.type)) {
        return res.status(400).json({
          success: false,
          error: `Invalid operation type: ${operation.type}`
        });
      }
    }

    const batchId = `batch_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const result = await batchService.executeBatch(batchId, operations, { rollbackOnError });

    res.status(201).json({
      success: true,
      data: result,
      message: 'Batch executed successfully'
    });

  } catch (error) {
    console.error('Batch execution error:', error);
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/batch/:batchId/status
 * Get the status of a batch operation
 */
router.get('/:batchId/status', (req, res) => {
  try {
    const { batchId } = req.params;
    
    const status = batchService.getBatchStatus(batchId);
    
    res.json({
      success: true,
      data: status,
      message: 'Batch status retrieved successfully'
    });

  } catch (error) {
    console.error('Get batch status error:', error);
    res.status(404).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/batch/:batchId/rollback
 * Manually rollback a failed batch operation
 */
router.post('/:batchId/rollback', async (req, res) => {
  try {
    const { batchId } = req.params;
    
    const result = await batchService.rollbackBatch(batchId);
    
    res.json({
      success: true,
      data: result,
      message: 'Batch rolled back successfully'
    });

  } catch (error) {
    console.error('Batch rollback error:', error);
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/batch/LABS/create-batch
 * Create multiple LABSs in a batch
 */
router.post('/LABS/create-batch', async (req, res) => {
  try {
    const { LABSConfigs } = req.body;

    if (!LABSConfigs || !Array.isArray(LABSConfigs)) {
      return res.status(400).json({
        success: false,
        error: 'LABSConfigs array is required'
      });
    }

    const operations = LABSConfigs.map(config => 
      BatchService.createLABSOperation(config)
    );

    const batchId = `LABS_create_batch_${Date.now()}`;
    
    const result = await batchService.executeBatch(batchId, operations);

    res.status(201).json({
      success: true,
      data: result,
      message: `${result.summary.successfulOperations} LABSs created successfully`
    });

  } catch (error) {
    console.error('Batch LABS creation error:', error);
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/batch/LABS/update-batch
 * Update multiple LABSs in a batch
 */
router.post('/LABS/update-batch', async (req, res) => {
  try {
    const { updates } = req.body;

    if (!updates || !Array.isArray(updates)) {
      return res.status(400).json({
        success: false,
        error: 'updates array is required'
      });
    }

    const operations = updates.map(update => 
      BatchService.updateLABSOperation(update.LABS, update.updates, update.secretKey)
    );

    const batchId = `LABS_update_batch_${Date.now()}`;
    
    const result = await batchService.executeBatch(batchId, operations);

    res.json({
      success: true,
      data: result,
      message: `${result.summary.successfulOperations} LABSs updated successfully`
    });

  } catch (error) {
    console.error('Batch LABS update error:', error);
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/batch/credentials/issue-batch
 * Issue multiple credentials in a batch
 */
router.post('/credentials/issue-batch', async (req, res) => {
  try {
    const { credentials } = req.body;

    if (!credentials || !Array.isArray(credentials)) {
      return res.status(400).json({
        success: false,
        error: 'credentials array is required'
      });
    }

    const operations = credentials.map(credential => 
      BatchService.issueCredentialOperation(credential)
    );

    const batchId = `credential_issue_batch_${Date.now()}`;
    
    const result = await batchService.executeBatch(batchId, operations);

    res.status(201).json({
      success: true,
      data: result,
      message: `${result.summary.successfulOperations} credentials issued successfully`
    });

  } catch (error) {
    console.error('Batch credential issuance error:', error);
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/batch/credentials/revoke-batch
 * Revoke multiple credentials in a batch
 */
router.post('/credentials/revoke-batch', async (req, res) => {
  try {
    const { revocations } = req.body;

    if (!revocations || !Array.isArray(revocations)) {
      return res.status(400).json({
        success: false,
        error: 'revocations array is required'
      });
    }

    const operations = revocations.map(revocation => 
      BatchService.revokeCredentialOperation(
        revocation.credentialId, 
        revocation.issuerLABS, 
        revocation.reason
      )
    );

    const batchId = `credential_revoke_batch_${Date.now()}`;
    
    const result = await batchService.executeBatch(batchId, operations);

    res.json({
      success: true,
      data: result,
      message: `${result.summary.successfulOperations} credentials revoked successfully`
    });

  } catch (error) {
    console.error('Batch credential revocation error:', error);
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/batch/bridge/LABS-batch
 * Bridge multiple LABSs to Ethereum in a batch
 */
router.post('/bridge/LABS-batch', async (req, res) => {
  try {
    const { LABSs } = req.body;

    if (!LABSs || !Array.isArray(LABSs)) {
      return res.status(400).json({
        success: false,
        error: 'LABSs array is required'
      });
    }

    const operations = LABSs.map(LABS => 
      BatchService.bridgeLABSOperation(
        LABS.LABS,
        LABS.ownerAddress,
        LABS.publicKey,
        LABS.serviceEndpoint
      )
    );

    const batchId = `LABS_bridge_batch_${Date.now()}`;
    
    const result = await batchService.executeBatch(batchId, operations);

    res.status(201).json({
      success: true,
      data: result,
      message: `${result.summary.successfulOperations} LABSs bridged successfully`
    });

  } catch (error) {
    console.error('Batch LABS bridging error:', error);
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/batch/bridge/credential-batch
 * Bridge multiple credentials to Ethereum in a batch
 */
router.post('/bridge/credential-batch', async (req, res) => {
  try {
    const { credentials } = req.body;

    if (!credentials || !Array.isArray(credentials)) {
      return res.status(400).json({
        success: false,
        error: 'credentials array is required'
      });
    }

    const operations = credentials.map(credential => 
      BatchService.bridgeCredentialOperation(
        credential.credentialId,
        credential.issuer,
        credential.subject,
        credential.credentialType,
        credential.expires,
        credential.dataHash
      )
    );

    const batchId = `credential_bridge_batch_${Date.now()}`;
    
    const result = await batchService.executeBatch(batchId, operations);

    res.status(201).json({
      success: true,
      data: result,
      message: `${result.summary.successfulOperations} credentials bridged successfully`
    });

  } catch (error) {
    console.error('Batch credential bridging error:', error);
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/batch/mixed
 * Execute a mixed batch of different operation types
 */
router.post('/mixed', async (req, res) => {
  try {
    const { operations } = req.body;

    if (!operations || !Array.isArray(operations)) {
      return res.status(400).json({
        success: false,
        error: 'operations array is required'
      });
    }

    // Convert operation objects to proper format
    const formattedOperations = operations.map(op => {
      switch (op.type) {
        case 'CREATE_LABS':
          return BatchService.createLABSOperation(op.data);
        case 'UPDATE_LABS':
          return BatchService.updateLABSOperation(op.data.LABS, op.data.updates, op.data.secretKey);
        case 'ISSUE_CREDENTIAL':
          return BatchService.issueCredentialOperation(op.data);
        case 'REVOKE_CREDENTIAL':
          return BatchService.revokeCredentialOperation(op.data.credentialId, op.data.issuerLABS, op.data.reason);
        case 'BRIDGE_LABS':
          return BatchService.bridgeLABSOperation(op.data.LABS, op.data.ownerAddress, op.data.publicKey, op.data.serviceEndpoint);
        case 'BRIDGE_CREDENTIAL':
          return BatchService.bridgeCredentialOperation(op.data.credentialId, op.data.issuer, op.data.subject, op.data.credentialType, op.data.expires, op.data.dataHash);
        default:
          throw new Error(`Unsupported operation type: ${op.type}`);
      }
    });

    const batchId = `mixed_batch_${Date.now()}`;
    
    const result = await batchService.executeBatch(batchId, formattedOperations);

    res.status(201).json({
      success: true,
      data: result,
      message: 'Mixed batch executed successfully'
    });

  } catch (error) {
    console.error('Mixed batch execution error:', error);
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;
