const request = require('supertest');
const { expect } = require('chai');
const app = require('../../server');
const TestUtils = require('../utils/testUtils');
const TestData = require('../utils/testData');

describe('Integration Test Suite', function() {
  this.timeout(60000); // 60 second timeout for integration tests

  let server;
  let testUsers = [];
  let authTokens = [];
  let createdLABSs = [];
  let createdCredentials = [];

  before(async function() {
    // Setup test environment
    await TestUtils.setupTestEnvironment();
    await TestUtils.setupTestDatabase();
    await TestUtils.setupTestRedis();
    
    // Start test server
    server = app.listen(0);
    
    // Create test users
    for (let i = 0; i < 3; i++) {
      const user = await TestUtils.createTestUser({
        walletAddress: TestUtils.generateRandomStellarAddress(),
        email: `test${i}@example.com`,
        roles: i === 0 ? ['USER', 'ADMIN'] : ['USER']
      });
      
      testUsers.push(user);
      authTokens.push(TestUtils.generateAuthToken(user));
    }
    
    console.log('Integration test suite setup completed');
  });

  after(async function() {
    // Cleanup
    if (server) server.close();
    await TestUtils.cleanup();
    console.log('Integration test suite cleanup completed');
  });

  beforeEach(async function() {
    // Clear test data
    await TestUtils.clearTestData(TestUtils.testDb);
    await TestUtils.testRedis.flushdb();
    
    // Reset arrays
    createdLABSs = [];
    createdCredentials = [];
  });

  describe('Complete User Journey', function() {
    
    it('should handle complete LABS lifecycle for a user', async function() {
      const user = testUsers[0];
      const token = authTokens[0];
      
      // Step 1: Create LABS
      const LABSData = TestData.validLABS({
        owner: user.walletAddress
      });
      
      const createResponse = await request(app)
        .post('/api/v1/LABS')
        .set('Authorization', `Bearer ${token}`)
        .send(LABSData)
        .expect(201);
      
      expect(createResponse.body.success).to.be.true;
      expect(createResponse.body.data.LABS).to.equal(LABSData.LABS);
      
      const createdLABS = createResponse.body.data;
      createdLABSs.push(createdLABS);
      
      // Step 2: Retrieve and verify LABS
      const getResponse = await request(app)
        .get(`/api/v1/LABS/${createdLABS.LABS}`)
        .set('Authorization', `Bearer ${token}`)
        .expect(200);
      
      expect(getResponse.body.data.LABS).to.equal(createdLABS.LABS);
      expect(getResponse.body.data.owner).to.equal(user.walletAddress);
      
      // Step 3: Update LABS
      const updateData = {
        serviceEndpoint: 'https://updated.example.com',
        verificationMethods: [
          {
            id: 'key-updated',
            type: 'Ed25519VerificationKey2018',
            controller: createdLABS.LABS,
            publicKeyBase58: TestUtils.generateRandomStellarAddress()
          }
        ]
      };
      
      const updateResponse = await request(app)
        .put(`/api/v1/LABS/${createdLABS.LABS}`)
        .set('Authorization', `Bearer ${token}`)
        .send(updateData)
        .expect(200);
      
      expect(updateResponse.body.data.serviceEndpoint).to.equal(updateData.serviceEndpoint);
      expect(updateResponse.body.data.verificationMethods).to.have.length(1);
      
      // Step 4: Issue credential for LABS
      const credentialData = TestData.degreeCredential({
        issuer: createdLABS.LABS,
        subject: createdLABS.LABS
      });
      
      const credentialResponse = await request(app)
        .post('/api/v1/credentials')
        .set('Authorization', `Bearer ${token}`)
        .send(credentialData)
        .expect(201);
      
      expect(credentialResponse.body.success).to.be.true;
      expect(credentialResponse.body.data.issuer).to.equal(createdLABS.LABS);
      expect(credentialResponse.body.data.subject).to.equal(createdLABS.LABS);
      
      const createdCredential = credentialResponse.body.data;
      createdCredentials.push(createdCredential);
      
      // Step 5: Verify credential
      const verifyResponse = await request(app)
        .post(`/api/v1/credentials/${createdCredential.id}/verify`)
        .set('Authorization', `Bearer ${token}`)
        .send({ credential: createdCredential })
        .expect(200);
      
      expect(verifyResponse.body.data.valid).to.be.true;
      
      // Step 6: List user's LABSs and credentials
      const LABSsResponse = await request(app)
        .get(`/api/v1/LABS?owner=${user.walletAddress}`)
        .set('Authorization', `Bearer ${token}`)
        .expect(200);
      
      expect(LABSsResponse.body.data).to.have.length(1);
      expect(LABSsResponse.body.data[0].LABS).to.equal(createdLABS.LABS);
      
      const credentialsResponse = await request(app)
        .get(`/api/v1/credentials?subject=${createdLABS.LABS}`)
        .set('Authorization', `Bearer ${token}`)
        .expect(200);
      
      expect(credentialsResponse.body.data).to.have.length(1);
      expect(credentialsResponse.body.data[0].id).to.equal(createdCredential.id);
      
      // Step 7: Revoke credential
      await request(app)
        .delete(`/api/v1/credentials/${createdCredential.id}`)
        .set('Authorization', `Bearer ${token}`)
        .expect(200);
      
      // Step 8: Deactivate LABS
      await request(app)
        .delete(`/api/v1/LABS/${createdLABS.LABS}`)
        .set('Authorization', `Bearer ${token}`)
        .expect(200);
      
      // Step 9: Verify final state
      const finalLABSResponse = await request(app)
        .get(`/api/v1/LABS/${createdLABS.LABS}`)
        .set('Authorization', `Bearer ${token}`)
        .expect(200);
      
      expect(finalLABSResponse.body.data.active).to.be.false;
      
      const finalCredentialResponse = await request(app)
        .get(`/api/v1/credentials/${createdCredential.id}`)
        .set('Authorization', `Bearer ${token}`)
        .expect(200);
      
      expect(finalCredentialResponse.body.data.revoked).to.be.true;
    });

    it('should handle multi-user credential issuance and verification', async function() {
      const issuer = testUsers[0];
      const subject = testUsers[1];
      const verifier = testUsers[2];
      
      // Create LABSs for issuer and subject
      const issuerLABS = TestData.validLABS({ owner: issuer.walletAddress });
      const subjectLABS = TestData.validLABS({ owner: subject.walletAddress });
      
      const issuerResponse = await request(app)
        .post('/api/v1/LABS')
        .set('Authorization', `Bearer ${authTokens[0]}`)
        .send(issuerLABS)
        .expect(201);
      
      const subjectResponse = await request(app)
        .post('/api/v1/LABS')
        .set('Authorization', `Bearer ${authTokens[1]}`)
        .send(subjectLABS)
        .expect(201);
      
      // Issue credential from issuer to subject
      const credentialData = TestData.employmentCredential({
        issuer: issuerResponse.body.data.LABS,
        subject: subjectResponse.body.data.LABS
      });
      
      const issueResponse = await request(app)
        .post('/api/v1/credentials')
        .set('Authorization', `Bearer ${authTokens[0]}`)
        .send(credentialData)
        .expect(201);
      
      const credential = issueResponse.body.data;
      
      // Subject verifies their credential
      const subjectVerifyResponse = await request(app)
        .post(`/api/v1/credentials/${credential.id}/verify`)
        .set('Authorization', `Bearer ${authTokens[1]}`)
        .send({ credential })
        .expect(200);
      
      expect(subjectVerifyResponse.body.data.valid).to.be.true;
      
      // Third party verifier verifies the credential
      const verifierVerifyResponse = await request(app)
        .post(`/api/v1/credentials/${credential.id}/verify`)
        .set('Authorization', `Bearer ${authTokens[2]}`)
        .send({ credential })
        .expect(200);
      
      expect(verifierVerifyResponse.body.data.valid).to.be.true;
      
      // Check that credential appears in issuer's issued credentials
      const issuerCredentialsResponse = await request(app)
        .get(`/api/v1/credentials?issuer=${issuerResponse.body.data.LABS}`)
        .set('Authorization', `Bearer ${authTokens[0]}`)
        .expect(200);
      
      expect(issuerCredentialsResponse.body.data).to.have.length(1);
      expect(issuerCredentialsResponse.body.data[0].id).to.equal(credential.id);
      
      // Check that credential appears in subject's received credentials
      const subjectCredentialsResponse = await request(app)
        .get(`/api/v1/credentials?subject=${subjectResponse.body.data.LABS}`)
        .set('Authorization', `Bearer ${authTokens[1]}`)
        .expect(200);
      
      expect(subjectCredentialsResponse.body.data).to.have.length(1);
      expect(subjectCredentialsResponse.body.data[0].id).to.equal(credential.id);
    });
  });

  describe('Stellar Integration', function() {
    
    it('should integrate with Stellar network for account operations', async function() {
      const user = testUsers[0];
      const token = authTokens[0];
      const stellarAddress = TestUtils.generateRandomStellarAddress();
      
      // Mock Stellar account data
      TestUtils.mockStellarAccount(stellarAddress);
      
      // Get account information
      const accountResponse = await request(app)
        .get(`/api/v1/stellar/account/${stellarAddress}`)
        .set('Authorization', `Bearer ${token}`)
        .expect(200);
      
      expect(accountResponse.body.data).to.have.property('address', stellarAddress);
      expect(accountResponse.body.data).to.have.property('balance');
      expect(accountResponse.body.data).to.have.property('signers');
      
      // Create LABS linked to Stellar account
      const LABSData = TestData.validLABS({
        owner: stellarAddress,
        publicKey: stellarAddress
      });
      
      const LABSResponse = await request(app)
        .post('/api/v1/LABS')
        .set('Authorization', `Bearer ${token}`)
        .send(LABSData)
        .expect(201);
      
      expect(LABSResponse.body.data.owner).to.equal(stellarAddress);
      
      // Create transaction
      const transactionData = TestData.validStellarTransaction({
        sourceAccount: stellarAddress
      });
      
      TestUtils.mockStellarTransactionSubmission();
      
      const txResponse = await request(app)
        .post('/api/v1/stellar/transaction')
        .set('Authorization', `Bearer ${token}`)
        .send(transactionData)
        .expect(201);
      
      expect(txResponse.body.data).to.have.property('id');
      expect(txResponse.body.data).to.have.property('status', 'pending');
      
      // Get transactions for account
      TestUtils.mockStellarTransactions(stellarAddress);
      
      const transactionsResponse = await request(app)
        .get(`/api/v1/stellar/transactions?account=${stellarAddress}`)
        .set('Authorization', `Bearer ${token}`)
        .expect(200);
      
      expect(transactionsResponse.body.data).to.be.an('array');
    });
  });

  describe('Contract Integration', function() {
    
    it('should integrate with smart contract for LABS operations', async function() {
      const user = testUsers[0];
      const token = authTokens[0];
      
      // Mock contract info
      TestUtils.mockContractInfo();
      
      // Get contract information
      const contractInfoResponse = await request(app)
        .get('/api/v1/contracts/info')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);
      
      expect(contractInfoResponse.body.data).to.have.property('version');
      expect(contractInfoResponse.body.data).to.have.property('address');
      
      // Deploy contract (admin only)
      TestUtils.mockContractDeployment();
      
      const deployResponse = await request(app)
        .post('/api/v1/contracts/deploy')
        .set('Authorization', `Bearer ${authTokens[0]}`) // Admin user
        .send({ deployerSecret: 'test-secret' })
        .expect(201);
      
      expect(deployResponse.body.data).to.have.property('address');
      expect(deployResponse.body.data).to.have.property('transactionHash');
      
      // Create LABS that will be registered on contract
      const LABSData = TestData.validLABS({
        owner: user.walletAddress
      });
      
      const LABSResponse = await request(app)
        .post('/api/v1/LABS')
        .set('Authorization', `Bearer ${token}`)
        .send(LABSData)
        .expect(201);
      
      // Register LABS on contract
      const registerData = {
        LABS: LABSResponse.body.data.LABS,
        owner: user.walletAddress,
        publicKey: LABSData.publicKey
      };
      
      TestUtils.mockContractData(`LABS-${LABSResponse.body.data.LABS}`);
      
      const registerResponse = await request(app)
        .post('/api/v1/contracts/register-LABS')
        .set('Authorization', `Bearer ${token}`)
        .send(registerData)
        .expect(200);
      
      expect(registerResponse.body.success).to.be.true;
      
      // Get contract data for LABS
      const contractDataResponse = await request(app)
        .get(`/api/v1/contracts/data/LABS-${LABSResponse.body.data.LABS}`)
        .set('Authorization', `Bearer ${token}`)
        .expect(200);
      
      expect(contractDataResponse.body.data).to.have.property('key');
      expect(contractDataResponse.body.data).to.have.property('value');
    });
  });

  describe('Cross-Service Integration', function() {
    
    it('should handle LABS creation with automatic credential issuance', async function() {
      const user = testUsers[0];
      const token = authTokens[0];
      
      // Create LABS
      const LABSData = TestData.validLABS({ owner: user.walletAddress });
      
      const LABSResponse = await request(app)
        .post('/api/v1/LABS')
        .set('Authorization', `Bearer ${token}`)
        .send(LABSData)
        .expect(201);
      
      const LABS = LABSResponse.body.data;
      
      // Automatically issue identity credential for new LABS
      const identityCredential = TestData.identityCredential({
        issuer: LABS.LABS,
        subject: LABS.LABS
      });
      
      const credentialResponse = await request(app)
        .post('/api/v1/credentials')
        .set('Authorization', `Bearer ${token}`)
        .send(identityCredential)
        .expect(201);
      
      const credential = credentialResponse.body.data;
      
      // Verify the credential was issued correctly
      const verifyResponse = await request(app)
        .post(`/api/v1/credentials/${credential.id}/verify`)
        .set('Authorization', `Bearer ${token}`)
        .send({ credential })
        .expect(200);
      
      expect(verifyResponse.body.data.valid).to.be.true;
      
      // Check that LABS and credential are linked
      const LABSWithCredentialsResponse = await request(app)
        .get(`/api/v1/LABS/${LABS.LABS}`)
        .set('Authorization', `Bearer ${token}`)
        .expect(200);
      
      expect(LABSWithCredentialsResponse.body.data.LABS).to.equal(LABS.LABS);
      
      const credentialsForLABSResponse = await request(app)
        .get(`/api/v1/credentials?subject=${LABS.LABS}`)
        .set('Authorization', `Bearer ${token}`)
        .expect(200);
      
      expect(credentialsForLABSResponse.body.data).to.have.length(1);
      expect(credentialsForLABSResponse.body.data[0].id).to.equal(credential.id);
    });

    it('should handle batch operations across multiple services', async function() {
      const user = testUsers[0];
      const token = authTokens[0];
      
      // Create multiple LABSs
      const LABSs = [];
      for (let i = 0; i < 3; i++) {
        const LABSData = TestData.validLABS({
          owner: user.walletAddress,
          LABS: `LABS:stellar:GABC${i.toString().padStart(54, '0')}`
        });
        
        const response = await request(app)
          .post('/api/v1/LABS')
          .set('Authorization', `Bearer ${token}`)
          .send(LABSData)
          .expect(201);
        
        LABSs.push(response.body.data);
      }
      
      // Issue credentials for all LABSs
      const credentials = [];
      for (let i = 0; i < LABSs.length; i++) {
        const credentialData = TestData.validCredential({
          issuer: LABSs[0].LABS, // First LABS issues credentials
          subject: LABSs[i].LABS,
          credentialType: `TestCredential${i}`
        });
        
        const response = await request(app)
          .post('/api/v1/credentials')
          .set('Authorization', `Bearer ${token}`)
          .send(credentialData)
          .expect(201);
        
        credentials.push(response.body.data);
      }
      
      // Verify all credentials
      const verificationResults = [];
      for (const credential of credentials) {
        const response = await request(app)
          .post(`/api/v1/credentials/${credential.id}/verify`)
          .set('Authorization', `Bearer ${token}`)
          .send({ credential })
          .expect(200);
        
        verificationResults.push(response.body.data);
      }
      
      // All verifications should be valid
      verificationResults.forEach(result => {
        expect(result.valid).to.be.true;
      });
      
      // Batch revoke credentials
      const credentialIds = credentials.map(c => c.id);
      
      const batchRevokeResponse = await request(app)
        .post('/api/v1/credentials/batch-revoke')
        .set('Authorization', `Bearer ${token}`)
        .send({ ids: credentialIds })
        .expect(200);
      
      expect(batchRevokeResponse.body.data.successful).to.equal(credentialIds.length);
      
      // Verify all credentials are revoked
      for (const credential of credentials) {
        const response = await request(app)
          .get(`/api/v1/credentials/${credential.id}`)
          .set('Authorization', `Bearer ${token}`)
          .expect(200);
        
        expect(response.body.data.revoked).to.be.true;
      }
      
      // Deactivate all LABSs
      for (const LABS of LABSs) {
        await request(app)
          .delete(`/api/v1/LABS/${LABS.LABS}`)
          .set('Authorization', `Bearer ${token}`)
          .expect(200);
      }
      
      // Verify all LABSs are deactivated
      for (const LABS of LABSs) {
        const response = await request(app)
          .get(`/api/v1/LABS/${LABS.LABS}`)
          .set('Authorization', `Bearer ${token}`)
          .expect(200);
        
        expect(response.body.data.active).to.be.false;
      }
    });
  });

  describe('Error Handling Integration', function() {
    
    it('should handle cascading failures gracefully', async function() {
      const user = testUsers[0];
      const token = authTokens[0];
      
      // Try to create LABS with invalid data
      const invalidLABSData = {
        LABS: 'invalid-LABS',
        publicKey: 'invalid-key'
      };
      
      const createResponse = await request(app)
        .post('/api/v1/LABS')
        .set('Authorization', `Bearer ${token}`)
        .send(invalidLABSData)
        .expect(400);
      
      expect(createResponse.body.error.code).to.equal('VALIDATION_ERROR');
      
      // Try to issue credential with non-existent LABS
      const credentialData = TestData.validCredential({
        issuer: 'LABS:stellar:NONEXISTENT',
        subject: 'LABS:stellar:NONEXISTENT'
      });
      
      const issueResponse = await request(app)
        .post('/api/v1/credentials')
        .set('Authorization', `Bearer ${token}`)
        .send(credentialData)
        .expect(400);
      
      expect(issueResponse.body.error.code).to.equal('VALIDATION_ERROR');
      
      // Try to revoke non-existent credential
      const revokeResponse = await request(app)
        .delete('/api/v1/credentials/non-existent-id')
        .set('Authorization', `Bearer ${token}`)
        .expect(404);
      
      expect(revokeResponse.body.error.code).to.equal('NOT_FOUND');
      
      // System should still be functional for valid operations
      const validLABSData = TestData.validLABS();
      
      const validCreateResponse = await request(app)
        .post('/api/v1/LABS')
        .set('Authorization', `Bearer ${token}`)
        .send(validLABSData)
        .expect(201);
      
      expect(validCreateResponse.body.success).to.be.true;
    });

    it('should handle service unavailability with fallbacks', async function() {
      const user = testUsers[0];
      const token = authTokens[0];
      
      // Mock Stellar service unavailability
      TestUtils.mockServerError('/api/v1/stellar/account', 'GET');
      
      // Try to get Stellar account (should fail gracefully)
      const stellarResponse = await request(app)
        .get('/api/v1/stellar/account/GABC1234567890ABCDEF1234567890ABCDEF1234567890')
        .set('Authorization', `Bearer ${token}`)
        .expect(502);
      
      expect(stellarResponse.body.error.code).to.equal('STELLAR_ERROR');
      
      // LABS operations should still work
      const LABSData = TestData.validLABS();
      
      const LABSResponse = await request(app)
        .post('/api/v1/LABS')
        .set('Authorization', `Bearer ${token}`)
        .send(LABSData)
        .expect(201);
      
      expect(LABSResponse.body.success).to.be.true;
    });
  });

  describe('Data Consistency Integration', function() {
    
    it('should maintain data consistency across operations', async function() {
      const user = testUsers[0];
      const token = authTokens[0];
      
      // Create LABS
      const LABSData = TestData.validLABS();
      
      const createResponse = await request(app)
        .post('/api/v1/LABS')
        .set('Authorization', `Bearer ${token}`)
        .send(LABSData)
        .expect(201);
      
      const LABS = createResponse.body.data;
      
      // Issue multiple credentials
      const credentials = [];
      for (let i = 0; i < 5; i++) {
        const credentialData = TestData.validCredential({
          issuer: LABS.LABS,
          subject: LABS.LABS,
          credentialType: `ConsistencyTest${i}`
        });
        
        const response = await request(app)
          .post('/api/v1/credentials')
          .set('Authorization', `Bearer ${token}`)
          .send(credentialData)
          .expect(201);
        
        credentials.push(response.body.data);
      }
      
      // Verify consistent state
      const LABSResponse = await request(app)
        .get(`/api/v1/LABS/${LABS.LABS}`)
        .set('Authorization', `Bearer ${token}`)
        .expect(200);
      
      expect(LABSResponse.body.data.LABS).to.equal(LABS.LABS);
      expect(LABSResponse.body.data.active).to.be.true;
      
      const credentialsResponse = await request(app)
        .get(`/api/v1/credentials?subject=${LABS.LABS}`)
        .set('Authorization', `Bearer ${token}`)
        .expect(200);
      
      expect(credentialsResponse.body.data).to.have.length(5);
      
      // Revoke some credentials
      const revokeIds = credentials.slice(0, 3).map(c => c.id);
      
      for (const id of revokeIds) {
        await request(app)
          .delete(`/api/v1/credentials/${id}`)
          .set('Authorization', `Bearer ${token}`)
          .expect(200);
      }
      
      // Verify consistent state after partial revocation
      const updatedCredentialsResponse = await request(app)
        .get(`/api/v1/credentials?subject=${LABS.LABS}`)
        .set('Authorization', `Bearer ${token}`)
        .expect(200);
      
      const activeCredentials = updatedCredentialsResponse.body.data.filter(c => !c.revoked);
      const revokedCredentials = updatedCredentialsResponse.body.data.filter(c => c.revoked);
      
      expect(activeCredentials).to.have.length(2);
      expect(revokedCredentials).to.have.length(3);
      
      // Verify individual credential states
      for (const credential of credentials) {
        const response = await request(app)
          .get(`/api/v1/credentials/${credential.id}`)
          .set('Authorization', `Bearer ${token}`)
          .expect(200);
        
        const expectedRevoked = revokeIds.includes(credential.id);
        expect(response.body.data.revoked).to.equal(expectedRevoked);
      }
    });
  });

  describe('Performance Integration', function() {
    
    it('should maintain performance under concurrent load', async function() {
      const user = testUsers[0];
      const token = authTokens[0];
      
      // Create multiple LABSs concurrently
      const LABSCreationPromises = [];
      for (let i = 0; i < 10; i++) {
        const LABSData = TestData.validLABS({
          LABS: `LABS:stellar:GABC${i.toString().padStart(54, '0')}`
        });
        
        LABSCreationPromises.push(
          request(app)
            .post('/api/v1/LABS')
            .set('Authorization', `Bearer ${token}`)
            .send(LABSData)
        );
      }
      
      const startTime = Date.now();
      const LABSResponses = await Promise.all(LABSCreationPromises);
      const LABSCreationTime = Date.now() - startTime;
      
      // All LABS creations should succeed
      LABSResponses.forEach(response => {
        expect(response.status).to.equal(201);
        expect(response.body.success).to.be.true;
      });
      
      // Should complete within reasonable time
      expect(LABSCreationTime).to.be.lessThan(5000);
      
      // Issue credentials for all LABSs concurrently
      const credentialPromises = LABSResponses.map(response => {
        const credentialData = TestData.validCredential({
          issuer: response.body.data.LABS,
          subject: response.body.data.LABS
        });
        
        return request(app)
          .post('/api/v1/credentials')
          .set('Authorization', `Bearer ${token}`)
          .send(credentialData);
      });
      
      const credentialStartTime = Date.now();
      const credentialResponses = await Promise.all(credentialPromises);
      const credentialCreationTime = Date.now() - credentialStartTime;
      
      // All credential creations should succeed
      credentialResponses.forEach(response => {
        expect(response.status).to.equal(201);
        expect(response.body.success).to.be.true;
      });
      
      // Should complete within reasonable time
      expect(credentialCreationTime).to.be.lessThan(5000);
      
      // Verify all data is consistent
      const LABSs = LABSResponses.map(r => r.body.data);
      const credentials = credentialResponses.map(r => r.body.data);
      
      expect(LABSs).to.have.length(10);
      expect(credentials).to.have.length(10);
      
      // List all LABSs and verify count
      const listResponse = await request(app)
        .get('/api/v1/LABS')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);
      
      expect(listResponse.body.data).to.have.length(10);
      
      // List all credentials and verify count
      const credentialListResponse = await request(app)
        .get('/api/v1/credentials')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);
      
      expect(credentialListResponse.body.data).to.have.length(10);
    });
  });

  describe('Security Integration', function() {
    
    it('should enforce security boundaries across services', async function() {
      const user1 = testUsers[0];
      const user2 = testUsers[1];
      const token1 = authTokens[0];
      const token2 = authTokens[1];
      
      // User 1 creates LABS
      const LABSData1 = TestData.validLABS({ owner: user1.walletAddress });
      
      const LABSResponse1 = await request(app)
        .post('/api/v1/LABS')
        .set('Authorization', `Bearer ${token1}`)
        .send(LABSData1)
        .expect(201);
      
      const LABS1 = LABSResponse1.body.data;
      
      // User 2 creates LABS
      const LABSData2 = TestData.validLABS({ owner: user2.walletAddress });
      
      const LABSResponse2 = await request(app)
        .post('/api/v1/LABS')
        .set('Authorization', `Bearer ${token2}`)
        .send(LABSData2)
        .expect(201);
      
      const LABS2 = LABSResponse2.body.data;
      
      // User 1 should not be able to update User 2's LABS
      const updateResponse = await request(app)
        .put(`/api/v1/LABS/${LABS2.LABS}`)
        .set('Authorization', `Bearer ${token1}`)
        .send({ serviceEndpoint: 'https://malicious.example.com' })
        .expect(403);
      
      expect(updateResponse.body.error.code).to.equal('FORBIDDEN');
      
      // User 1 should not be able to deactivate User 2's LABS
      const deactivateResponse = await request(app)
        .delete(`/api/v1/LABS/${LABS2.LABS}`)
        .set('Authorization', `Bearer ${token1}`)
        .expect(403);
      
      expect(deactivateResponse.body.error.code).to.equal('FORBIDDEN');
      
      // User 1 issues credential for their own LABS
      const credentialData = TestData.validCredential({
        issuer: LABS1.LABS,
        subject: LABS1.LABS
      });
      
      const credentialResponse = await request(app)
        .post('/api/v1/credentials')
        .set('Authorization', `Bearer ${token1}`)
        .send(credentialData)
        .expect(201);
      
      const credential = credentialResponse.body.data;
      
      // User 2 should not be able to revoke User 1's credential
      const revokeResponse = await request(app)
        .delete(`/api/v1/credentials/${credential.id}`)
        .set('Authorization', `Bearer ${token2}`)
        .expect(403);
      
      expect(revokeResponse.body.error.code).to.equal('FORBIDDEN');
      
      // Verify original states are maintained
      const LABS2CheckResponse = await request(app)
        .get(`/api/v1/LABS/${LABS2.LABS}`)
        .set('Authorization', `Bearer ${token2}`)
        .expect(200);
      
      expect(LABS2CheckResponse.body.data.active).to.be.true;
      expect(LABS2CheckResponse.body.data.serviceEndpoint).to.not.equal('https://malicious.example.com');
      
      const credentialCheckResponse = await request(app)
        .get(`/api/v1/credentials/${credential.id}`)
        .set('Authorization', `Bearer ${token1}`)
        .expect(200);
      
      expect(credentialCheckResponse.body.data.revoked).to.be.false;
    });
  });
});
