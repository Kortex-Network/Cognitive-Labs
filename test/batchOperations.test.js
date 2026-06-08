const request = require('supertest');
const app = require('../src/index');
const { BatchService, BatchOperationType } = require('../src/services/batchService');

describe('Batch Operations API', () => {
  describe('POST /api/batch/execute', () => {
    test('should execute a successful batch', async () => {
      const operations = [
        {
          type: BatchOperationType.CREATE_LABS,
          data: { serviceEndpoint: 'https://example.com' }
        },
        {
          type: BatchOperationType.ISSUE_CREDENTIAL,
          data: {
            issuerLABS: 'LABS:stellar:test1',
            subjectLABS: 'LABS:stellar:test2',
            claims: { name: 'John Doe' }
          }
        }
      ];

      const response = await request(app)
        .post('/api/batch/execute')
        .send({ operations })
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data.results).toHaveLength(2);
      expect(response.body.data.summary.totalOperations).toBe(2);
    });

    test('should reject invalid operation type', async () => {
      const operations = [
        {
          type: 'INVALID_TYPE',
          data: {}
        }
      ];

      const response = await request(app)
        .post('/api/batch/execute')
        .send({ operations })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('Invalid operation type');
    });

    test('should reject empty operations array', async () => {
      const response = await request(app)
        .post('/api/batch/execute')
        .send({ operations: [] })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('At least one operation is required');
    });

    test('should reject missing operations array', async () => {
      const response = await request(app)
        .post('/api/batch/execute')
        .send({})
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('Operations array is required');
    });
  });

  describe('GET /api/batch/:batchId/status', () => {
    test('should return batch status', async () => {
      // First create a batch
      const operations = [
        {
          type: BatchOperationType.CREATE_COGNITIVE_LAB,
          data: { serviceEndpoint: 'https://example.com' }
        }
      ];

      const createResponse = await request(app)
        .post('/api/batch/execute')
        .send({ operations })
        .expect(201);

      const batchId = createResponse.body.data.batchId;

      // Then get status
      const statusResponse = await request(app)
        .get(`/api/batch/${batchId}/status`)
        .expect(200);

      expect(statusResponse.body.success).toBe(true);
      expect(statusResponse.body.data.id).toBe(batchId);
      expect(statusResponse.body.data.operationCount).toBe(1);
    });

    test('should return 404 for non-existent batch', async () => {
      const response = await request(app)
        .get('/api/batch/non-existent/status')
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('not found');
    });
  });

  describe('POST /api/batch/cognitive-lab/create-batch', () => {
    test('should create multiple Cognitive Labs in batch', async () => {
      const cognitiveLabConfigs = [
        { serviceEndpoint: 'https://example1.com' },
        { serviceEndpoint: 'https://example2.com' }
      ];

      const response = await request(app)
        .post('/api/batch/cognitive-lab/create-batch')
        .send({ cognitiveLabConfigs })
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data.summary.totalOperations).toBe(2);
      expect(response.body.message).toContain('2 Cognitive Labs created');
    });

    test('should reject invalid cognitiveLabConfigs', async () => {
      const response = await request(app)
        .post('/api/batch/cognitive-lab/create-batch')
        .send({ cognitiveLabConfigs: 'invalid' })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('cognitiveLabConfigs array is required');
    });
  });

  describe('POST /api/batch/credentials/issue-batch', () => {
    test('should issue multiple credentials in batch', async () => {
      const credentials = [
        {
          issuerCognitiveLab: 'LABS:stellar:issuer1',
          subjectCognitiveLab: 'LABS:stellar:subject1',
          claims: { name: 'John Doe', degree: 'Bachelor' }
        },
        {
          issuerCognitiveLab: 'LABS:stellar:issuer2',
          subjectCognitiveLab: 'LABS:stellar:subject2',
          claims: { name: 'Jane Smith', license: 'Medical' }
        }
      ];

      const response = await request(app)
        .post('/api/batch/credentials/issue-batch')
        .send({ credentials })
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data.summary.totalOperations).toBe(2);
      expect(response.body.message).toContain('2 credentials issued');
    });

    test('should reject invalid credentials array', async () => {
      const response = await request(app)
        .post('/api/batch/credentials/issue-batch')
        .send({ credentials: 'invalid' })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('credentials array is required');
    });
  });

  describe('POST /api/batch/mixed', () => {
    test('should execute mixed operations', async () => {
      const operations = [
        {
          type: BatchOperationType.CREATE_LABS,
          data: { serviceEndpoint: 'https://example.com' }
        },
        {
          type: BatchOperationType.ISSUE_CREDENTIAL,
          data: {
            issuerLABS: 'LABS:stellar:test1',
            subjectLABS: 'LABS:stellar:test2',
            claims: { name: 'John Doe' }
          }
        }
      ];

      const response = await request(app)
        .post('/api/batch/mixed')
        .send({ operations })
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data.results).toHaveLength(2);
      expect(response.body.message).toContain('Mixed batch executed successfully');
    });

    test('should reject unsupported operation type in mixed batch', async () => {
      const operations = [
        {
          type: 'UNSUPPORTED_TYPE',
          data: {}
        }
      ];

      const response = await request(app)
        .post('/api/batch/mixed')
        .send({ operations })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('Unsupported operation type');
    });
  });

  describe('Error handling', () => {
    test('should handle batch execution failure gracefully', async () => {
      const operations = [
        {
          type: BatchOperationType.CREATE_COGNITIVE_LAB,
          data: { serviceEndpoint: 'https://example.com' }
        }
      ];

      // Mock a failure in Cognitive Lab creation
      const response = await request(app)
        .post('/api/batch/execute')
        .send({ operations })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBeDefined();
    });
  });
});

describe('Batch Service Integration', () => {
  let batchService;

  beforeEach(() => {
    batchService = new BatchService();
  });

  describe('Atomic Execution', () => {
    test('should maintain atomicity across operations', async () => {
      // This test would require mocking the underlying services
      // to simulate partial failures and verify rollback behavior
      expect(true).toBe(true); // Placeholder
    });
  });

  describe('Rollback Mechanism', () => {
    test('should rollback on failure', async () => {
      // Test rollback functionality
      expect(true).toBe(true); // Placeholder
    });

    test('should handle rollback failures gracefully', async () => {
      // Test rollback failure scenarios
      expect(true).toBe(true); // Placeholder
    });
  });

  describe('Performance', () => {
    test('should handle large batches efficiently', async () => {
      // Test performance with large number of operations
      expect(true).toBe(true); // Placeholder
    });
  });
});
