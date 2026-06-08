const { BatchService, BatchOperationType, BatchStatus } = require('../services/batchService');
const LABSService = require('../services/LABSService');

// Mock LABSService
jest.mock('../services/LABSService');
jest.mock('../services/stellarService');

describe('BatchService', () => {
  let batchService;
  let mockLABSService;

  beforeEach(() => {
    batchService = new BatchService();
    mockLABSService = new LABSService();
    
    // Clear all batches before each test
    batchService.activeBatches.clear();
  });

  describe('executeBatch', () => {
    test('should execute a successful batch of operations', async () => {
      const operations = [
        BatchService.createLABSOperation({ serviceEndpoint: 'https://example.com' }),
        BatchService.issueCredentialOperation({
          issuerLABS: 'LABS:stellar:test1',
          subjectLABS: 'LABS:stellar:test2',
          claims: { name: 'John Doe' }
        })
      ];

      // Mock successful operations
      mockLABSService.createLABS.mockResolvedValue({
        LABS: 'LABS:stellar:test1',
        account: { publicKey: 'test1' }
      });
      
      mockLABSService.createVerifiableCredential.mockResolvedValue({
        id: 'cred-123',
        issuer: 'LABS:stellar:test1',
        subject: 'LABS:stellar:test2'
      });

      batchService.LABSService = mockLABSService;

      const result = await batchService.executeBatch('test-batch', operations);

      expect(result.success).toBe(true);
      expect(result.batchId).toBe('test-batch');
      expect(result.results).toHaveLength(2);
      expect(result.summary.totalOperations).toBe(2);
      expect(result.summary.successfulOperations).toBe(2);
      expect(result.summary.failedOperations).toBe(0);
    });

    test('should handle batch failure and rollback', async () => {
      const operations = [
        BatchService.createLABSOperation({ serviceEndpoint: 'https://example.com' }),
        BatchService.issueCredentialOperation({
          issuerLABS: 'LABS:stellar:test1',
          subjectLABS: 'LABS:stellar:test2',
          claims: { name: 'John Doe' }
        })
      ];

      // Mock first operation success, second failure
      mockLABSService.createLABS.mockResolvedValue({
        LABS: 'LABS:stellar:test1',
        account: { publicKey: 'test1' }
      });
      
      mockLABSService.createVerifiableCredential.mockRejectedValue(
        new Error('Credential creation failed')
      );

      batchService.LABSService = mockLABSService;

      await expect(batchService.executeBatch('test-batch', operations))
        .rejects.toThrow('Credential creation failed');

      const batchStatus = batchService.getBatchStatus('test-batch');
      expect(batchStatus.status).toBe(BatchStatus.ROLLED_BACK);
    });

    test('should skip rollback when disabled', async () => {
      const operations = [
        BatchService.createLABSOperation({ serviceEndpoint: 'https://example.com' })
      ];

      mockLABSService.createLABS.mockRejectedValue(
        new Error('LABS creation failed')
      );

      batchService.LABSService = mockLABSService;

      await expect(batchService.executeBatch('test-batch', operations, { rollbackOnError: false }))
        .rejects.toThrow('LABS creation failed');

      const batchStatus = batchService.getBatchStatus('test-batch');
      expect(batchStatus.status).toBe(BatchStatus.FAILED);
    });
  });

  describe('executeOperation', () => {
    test('should execute CREATE_LABS operation', async () => {
      const operation = BatchService.createLABSOperation({ serviceEndpoint: 'https://example.com' });
      const batch = {
        id: 'test-batch',
        operations: [operation],
        status: BatchStatus.IN_PROGRESS,
        results: [],
        rollbackData: []
      };

      mockLABSService.createLABS.mockResolvedValue({
        LABS: 'LABS:stellar:test1',
        account: { publicKey: 'test1' }
      });

      batchService.LABSService = mockLABSService;

      const result = await batchService.executeOperation(operation, batch);

      expect(result.status).toBe('SUCCESS');
      expect(result.type).toBe(BatchOperationType.CREATE_LABS);
      expect(result.result.LABS).toBe('LABS:stellar:test1');
      expect(batch.rollbackData).toHaveLength(1);
    });

    test('should execute UPDATE_LABS operation', async () => {
      const operation = BatchService.updateLABSOperation(
        'LABS:stellar:test1',
        { serviceEndpoint: 'https://updated.com' },
        'secret-key'
      );
      const batch = {
        id: 'test-batch',
        operations: [operation],
        status: BatchStatus.IN_PROGRESS,
        results: [],
        rollbackData: []
      };

      const currentState = {
        LABSDocument: { id: 'LABS:stellar:test1', serviceEndpoint: 'https://old.com' }
      };

      mockLABSService.resolveLABS.mockResolvedValue(currentState);
      mockLABSService.updateLABS.mockResolvedValue({
        LABSDocument: { id: 'LABS:stellar:test1', serviceEndpoint: 'https://updated.com' }
      });

      batchService.LABSService = mockLABSService;

      const result = await batchService.executeOperation(operation, batch);

      expect(result.status).toBe('SUCCESS');
      expect(result.type).toBe(BatchOperationType.UPDATE_LABS);
      expect(result.result.previousState).toBe(currentState);
      expect(batch.rollbackData).toHaveLength(1);
    });

    test('should handle operation failure', async () => {
      const operation = BatchService.createLABSOperation({ serviceEndpoint: 'https://example.com' });
      const batch = {
        id: 'test-batch',
        operations: [operation],
        status: BatchStatus.IN_PROGRESS,
        results: [],
        rollbackData: []
      };

      mockLABSService.createLABS.mockRejectedValue(new Error('Creation failed'));

      batchService.LABSService = mockLABSService;

      const result = await batchService.executeOperation(operation, batch);

      expect(result.status).toBe('FAILED');
      expect(result.error).toBe('Creation failed');
      expect(batch.rollbackData).toHaveLength(0);
    });
  });

  describe('rollbackBatch', () => {
    test('should rollback a failed batch', async () => {
      const batch = {
        id: 'test-batch',
        operations: [],
        status: BatchStatus.FAILED,
        results: [],
        rollbackData: [
          { type: BatchOperationType.CREATE_LABS, data: { LABS: 'LABS:stellar:test1' } },
          { type: BatchOperationType.ISSUE_CREDENTIAL, credentialId: 'cred-123' }
        ],
        error: 'Test error'
      };

      batchService.activeBatches.set('test-batch', batch);

      const result = await batchService.rollbackBatch('test-batch');

      expect(result.success).toBe(true);
      expect(batch.status).toBe(BatchStatus.ROLLED_BACK);
    });

    test('should throw error for non-existent batch', async () => {
      await expect(batchService.rollbackBatch('non-existent'))
        .rejects.toThrow('Batch non-existent not found');
    });

    test('should throw error for batch that is not failed', async () => {
      const batch = {
        id: 'test-batch',
        operations: [],
        status: BatchStatus.COMPLETED,
        results: [],
        rollbackData: []
      };

      batchService.activeBatches.set('test-batch', batch);

      await expect(batchService.rollbackBatch('test-batch'))
        .rejects.toThrow('Cannot rollback batch with status: COMPLETED');
    });
  });

  describe('getBatchStatus', () => {
    test('should return batch status', () => {
      const batch = {
        id: 'test-batch',
        status: BatchStatus.IN_PROGRESS,
        startTime: '2023-01-01T00:00:00.000Z',
        endTime: null,
        error: null,
        operations: [{}, {}],
        results: [
          { status: 'SUCCESS' },
          { status: 'FAILED' }
        ]
      };

      batchService.activeBatches.set('test-batch', batch);

      const status = batchService.getBatchStatus('test-batch');

      expect(status.id).toBe('test-batch');
      expect(status.status).toBe(BatchStatus.IN_PROGRESS);
      expect(status.operationCount).toBe(2);
      expect(status.completedOperations).toBe(1);
      expect(status.failedOperations).toBe(1);
    });

    test('should throw error for non-existent batch', () => {
      expect(() => batchService.getBatchStatus('non-existent'))
        .toThrow('Batch non-existent not found');
    });
  });

  describe('generateBatchSummary', () => {
    test('should generate correct batch summary', () => {
      const batch = {
        operations: [{}, {}, {}],
        results: [
          { status: 'SUCCESS' },
          { status: 'SUCCESS' },
          { status: 'FAILED' }
        ],
        startTime: '2023-01-01T00:00:00.000Z',
        endTime: '2023-01-01T00:01:00.000Z'
      };

      const summary = batchService.generateBatchSummary(batch);

      expect(summary.totalOperations).toBe(3);
      expect(summary.successfulOperations).toBe(2);
      expect(summary.failedOperations).toBe(1);
      expect(summary.successRate).toBe(66.66666666666666);
      expect(summary.duration).toBe(60000);
    });
  });

  describe('operation helpers', () => {
    test('should create correct operation objects', () => {
      const LABSOp = BatchService.createLABSOperation({ serviceEndpoint: 'https://example.com' });
      expect(LABSOp.type).toBe(BatchOperationType.CREATE_LABS);
      expect(LABSOp.data.serviceEndpoint).toBe('https://example.com');

      const updateOp = BatchService.updateLABSOperation('LABS:test', { name: 'test' }, 'secret');
      expect(updateOp.type).toBe(BatchOperationType.UPDATE_LABS);
      expect(updateOp.data.LABS).toBe('LABS:test');
      expect(updateOp.data.updates.name).toBe('test');
      expect(updateOp.data.secretKey).toBe('secret');

      const issueOp = BatchService.issueCredentialOperation({
        issuerLABS: 'LABS:issuer',
        subjectLABS: 'LABS:subject',
        claims: { name: 'John' }
      });
      expect(issueOp.type).toBe(BatchOperationType.ISSUE_CREDENTIAL);
      expect(issueOp.data.issuerLABS).toBe('LABS:issuer');

      const revokeOp = BatchService.revokeCredentialOperation('cred-123', 'LABS:issuer', 'test');
      expect(revokeOp.type).toBe(BatchOperationType.REVOKE_CREDENTIAL);
      expect(revokeOp.data.credentialId).toBe('cred-123');
      expect(revokeOp.data.reason).toBe('test');

      const bridgeLABSOp = BatchService.bridgeLABSOperation('LABS:test', '0x123', 'pubkey', 'endpoint');
      expect(bridgeLABSOp.type).toBe(BatchOperationType.BRIDGE_LABS);
      expect(bridgeLABSOp.data.LABS).toBe('LABS:test');

      const bridgeCredOp = BatchService.bridgeCredentialOperation('cred-123', 'issuer', 'subject', 'type', 12345, 'hash');
      expect(bridgeCredOp.type).toBe(BatchOperationType.BRIDGE_CREDENTIAL);
      expect(bridgeCredOp.data.credentialId).toBe('cred-123');
    });
  });
});
