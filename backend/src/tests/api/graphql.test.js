const { ApolloServer, gql } = require('apollo-server-express');
const { createTestClient } = require('apollo-server-testing');
const { expect } = require('chai');
const TestUtils = require('../utils/testUtils');
const TestData = require('../utils/testData');
const typeDefs = require('../../graphql/schema');
const resolvers = require('../../graphql/resolvers');

describe('GraphQL API Test Suite', function() {
  this.timeout(30000);

  let testServer;
  let server;
  let testUser;
  let authToken;
  let context;

  before(async function() {
    // Setup test environment
    await TestUtils.setupTestEnvironment();
    
    // Create test user and token
    testUser = await TestUtils.createTestUser();
    authToken = TestUtils.generateAuthToken(testUser);
    
    // Setup GraphQL context
    context = {
      user: testUser,
      logger: { info: () => {}, error: () => {} },
      req: { headers: { authorization: `Bearer ${authToken}` } },
      res: {}
    };
    
    // Create test server
    server = new ApolloServer({
      typeDefs,
      resolvers,
      context: () => context
    });
    
    testServer = createTestClient(server);
    
    console.log('GraphQL test suite setup completed');
  });

  after(async function() {
    await TestUtils.cleanup();
    console.log('GraphQL test suite cleanup completed');
  });

  describe('LABS Queries', function() {
    
    it('should fetch a single LABS', async function() {
      const LABSData = TestData.validLABS();
      
      // Mock LABS service
      TestUtils.mockLABSService('getLABS', LABSData);
      
      const GET_LABS = gql`
        query GetLABS($LABS: String!) {
          LABS(LABS: $LABS) {
            id
            LABS
            owner
            publicKey
            created
            updated
            active
            serviceEndpoint
            verificationMethods {
              id
              type
              publicKeyBase58
            }
            services {
              id
              type
              serviceEndpoint
            }
          }
        }
      `;

      const response = await testServer.query({
        query: GET_LABS,
        variables: { LABS: LABSData.LABS }
      });

      expect(response.errors).to.be.undefined;
      expect(response.data).to.have.property('LABS');
      expect(response.data.LABS).to.deep.include({
        id: LABSData.LABS,
        LABS: LABSData.LABS,
        owner: LABSData.owner || testUser.walletAddress,
        publicKey: LABSData.publicKey,
        active: true
      });
      expect(response.data.LABS.verificationMethods).to.be.an('array');
      expect(response.data.LABS.services).to.be.an('array');
    });

    it('should handle LABS not found error', async function() {
      // Mock LABS service to throw error
      TestUtils.mockLABSService('getLABS', null, new Error('LABS not found'));
      
      const GET_LABS = gql`
        query GetLABS($LABS: String!) {
          LABS(LABS: $LABS) {
            id
            LABS
          }
        }
      `;

      const response = await testServer.query({
        query: GET_LABS,
        variables: { LABS: 'LABS:stellar:NONEXISTENT' }
      });

      expect(response.errors).to.exist;
      expect(response.errors[0].message).to.include('Failed to fetch LABS');
      expect(response.data).to.have.property('LABS', null);
    });

    it('should fetch multiple LABSs with filters', async function() {
      const mockLABSs = [
        TestData.validLABS({ LABS: 'LABS:stellar:GABC111111111111111111111111111111111111111' }),
        TestData.validLABS({ LABS: 'LABS:stellar:GABC222222222222222222222222222222222222222' }),
        TestData.validLABS({ LABS: 'LABS:stellar:GABC333333333333333333333333333333333333333' })
      ];
      
      // Mock LABS service
      TestUtils.mockLABSService('getLABSs', mockLABSs);
      TestUtils.mockLABSService('getLABSCount', 3);
      
      const LIST_LABSS = gql`
        query ListLABSs($owner: String, $active: Boolean, $limit: Int, $offset: Int) {
          LABSs(owner: $owner, active: $active, limit: $limit, offset: $offset) {
            id
            LABS
            owner
            created
            active
          }
          LABSCount(active: $active)
        }
      `;

      const response = await testServer.query({
        query: LIST_LABSS,
        variables: { active: true, limit: 10, offset: 0 }
      });

      expect(response.errors).to.be.undefined;
      expect(response.data.LABSs).to.be.an('array').with.length(3);
      expect(response.data.LABSCount).to.equal(3);
      
      response.data.LABSs.forEach(LABS => {
        expect(LABS).to.have.property('id');
        expect(LABS).to.have.property('LABS');
        expect(LABS).to.have.property('active', true);
      });
    });

    it('should search LABSs', async function() {
      const mockResults = [
        TestData.validLABS({ 
          LABS: 'LABS:stellar:GABC111111111111111111111111111111111111111',
          serviceEndpoint: 'https://university.example.com'
        }),
        TestData.validLABS({ 
          LABS: 'LABS:stellar:GABC222222222222222222222222222222222222222',
          serviceEndpoint: 'https://education.example.com'
        })
      ];
      
      // Mock LABS service
      TestUtils.mockLABSService('searchLABSs', mockResults);
      
      const SEARCH_LABSS = gql`
        query SearchLABSs($query: String!, $limit: Int) {
          searchLABSs(query: $query, limit: $limit) {
            id
            LABS
            owner
            serviceEndpoint
          }
        }
      `;

      const response = await testServer.query({
        query: SEARCH_LABSS,
        variables: { query: 'university', limit: 10 }
      });

      expect(response.errors).to.be.undefined;
      expect(response.data.searchLABSs).to.be.an('array').with.length(2);
      
      response.data.searchLABSs.forEach(LABS => {
        expect(LABS).to.have.property('id');
        expect(LABS).to.have.property('LABS');
        expect(LABS).to.have.property('serviceEndpoint');
      });
    });

    it('should handle invalid LABS format', async function() {
      const GET_LABS = gql`
        query GetLABS($LABS: String!) {
          LABS(LABS: $LABS) {
            id
            LABS
          }
        }
      `;

      const response = await testServer.query({
        query: GET_LABS,
        variables: { LABS: 'invalid-LABS-format' }
      });

      expect(response.errors).to.exist;
      expect(response.errors[0].message).to.include('Invalid LABS format');
    });
  });

  describe('Credential Queries', function() {
    
    it('should fetch a single credential', async function() {
      const credentialData = TestData.validCredential();
      
      // Mock credential service
      TestUtils.mockCredentialService('getCredential', credentialData);
      
      const GET_CREDENTIAL = gql`
        query GetCredential($id: ID!) {
          credential(id: $id) {
            id
            issuer
            subject
            credentialType
            issued
            expires
            dataHash
            revoked
            claims
          }
        }
      `;

      const response = await testServer.query({
        query: GET_CREDENTIAL,
        variables: { id: 'test-credential-id' }
      });

      expect(response.errors).to.be.undefined;
      expect(response.data).to.have.property('credential');
      expect(response.data.credential).to.deep.include({
        id: 'test-credential-id',
        issuer: credentialData.issuer,
        subject: credentialData.subject,
        credentialType: credentialData.credentialType,
        revoked: false
      });
      expect(response.data.credential).to.have.property('claims');
      expect(response.data.credential).to.have.property('issued');
    });

    it('should fetch credentials with filters', async function() {
      const mockCredentials = [
        TestData.validCredential({ 
          issuer: 'LABS:stellar:GABC111111111111111111111111111111111111111',
          revoked: false
        }),
        TestData.validCredential({ 
          issuer: 'LABS:stellar:GABC222222222222222222222222222222222222222',
          revoked: false
        })
      ];
      
      // Mock credential service
      TestUtils.mockCredentialService('getCredentials', mockCredentials);
      TestUtils.mockCredentialService('getCredentialCount', 2);
      
      const LIST_CREDENTIALS = gql`
        query ListCredentials($issuer: String, $revoked: Boolean, $limit: Int) {
          credentials(issuer: $issuer, revoked: $revoked, limit: $limit) {
            id
            issuer
            subject
            credentialType
            issued
            revoked
          }
          credentialCount(issuer: $issuer, revoked: $revoked)
        }
      `;

      const response = await testServer.query({
        query: LIST_CREDENTIALS,
        variables: { revoked: false, limit: 10 }
      });

      expect(response.errors).to.be.undefined;
      expect(response.data.credentials).to.be.an('array').with.length(2);
      expect(response.data.credentialCount).to.equal(2);
      
      response.data.credentials.forEach(credential => {
        expect(credential).to.have.property('id');
        expect(credential).to.have.property('issuer');
        expect(credential).to.have.property('revoked', false);
      });
    });

    it('should handle credential not found', async function() {
      // Mock credential service to throw error
      TestUtils.mockCredentialService('getCredential', null, new Error('Credential not found'));
      
      const GET_CREDENTIAL = gql`
        query GetCredential($id: ID!) {
          credential(id: $id) {
            id
            issuer
          }
        }
      `;

      const response = await testServer.query({
        query: GET_CREDENTIAL,
        variables: { id: 'non-existent-credential' }
      });

      expect(response.errors).to.exist;
      expect(response.errors[0].message).to.include('Failed to fetch credential');
      expect(response.data).to.have.property('credential', null);
    });
  });

  describe('Stellar Queries', function() {
    
    it('should fetch Stellar account', async function() {
      const mockAccount = {
        address: 'GABC1234567890ABCDEF1234567890ABCDEF1234567890',
        publicKey: 'GABC1234567890ABCDEF1234567890ABCDEF1234567890',
        balance: '1000.0000000',
        sequence: '123456789',
        signers: [
          {
            key: 'GABC1234567890ABCDEF1234567890ABCDEF1234567890',
            weight: 1,
            type: 'ed25519_public_key'
          }
        ],
        thresholds: {
          lowThreshold: 1,
          medThreshold: 2,
          highThreshold: 3
        },
        flags: {
          authRequired: false,
          authRevocable: false,
          authImmutable: false
        }
      };
      
      // Mock Stellar service
      TestUtils.mockStellarService('getAccount', mockAccount);
      
      const GET_ACCOUNT = gql`
        query GetStellarAccount($address: String!) {
          stellarAccount(address: $address) {
            address
            publicKey
            balance
            sequence
            signers {
              key
              weight
              type
            }
            thresholds {
              lowThreshold
              medThreshold
              highThreshold
            }
            flags {
              authRequired
              authRevocable
              authImmutable
            }
          }
        }
      `;

      const response = await testServer.query({
        query: GET_ACCOUNT,
        variables: { address: 'GABC1234567890ABCDEF1234567890ABCDEF1234567890' }
      });

      expect(response.errors).to.be.undefined;
      expect(response.data).to.have.property('stellarAccount');
      expect(response.data.stellarAccount).to.deep.include({
        address: mockAccount.address,
        publicKey: mockAccount.publicKey,
        balance: mockAccount.balance,
        sequence: mockAccount.sequence
      });
      expect(response.data.stellarAccount.signers).to.be.an('array');
      expect(response.data.stellarAccount.thresholds).to.be.an('object');
      expect(response.data.stellarAccount.flags).to.be.an('object');
    });

    it('should handle invalid Stellar address', async function() {
      const GET_ACCOUNT = gql`
        query GetStellarAccount($address: String!) {
          stellarAccount(address: $address) {
            address
            balance
          }
        }
      `;

      const response = await testServer.query({
        query: GET_ACCOUNT,
        variables: { address: 'invalid-address' }
      });

      expect(response.errors).to.exist;
      expect(response.errors[0].message).to.include('Invalid Stellar address');
    });

    it('should fetch transactions', async function() {
      const mockTransactions = [
        {
          id: 'tx-1',
          hash: 'hash-1',
          sourceAccount: 'GABC1234567890ABCDEF1234567890ABCDEF1234567890',
          successful: true,
          status: 'success',
          createdAt: '2023-01-01T00:00:00.000Z',
          operations: [
            {
              type: 'payment',
              destination: 'GDEF1234567890ABCDEF1234567890ABCDEF1234567890',
              amount: '10.0000000',
              asset: 'native'
            }
          ]
        }
      ];
      
      // Mock Stellar service
      TestUtils.mockStellarService('getTransactions', mockTransactions);
      
      const GET_TRANSACTIONS = gql`
        query GetTransactions($account: String, $limit: Int, $status: String) {
          transactions(account: $account, limit: $limit, status: $status) {
            id
            hash
            sourceAccount
            successful
            status
            createdAt
            operations {
              type
              destination
              amount
              asset
            }
          }
        }
      `;

      const response = await testServer.query({
        query: GET_TRANSACTIONS,
        variables: { 
          account: 'GABC1234567890ABCDEF1234567890ABCDEF1234567890',
          limit: 10,
          status: 'success'
        }
      });

      expect(response.errors).to.be.undefined;
      expect(response.data.transactions).to.be.an('array').with.length(1);
      expect(response.data.transactions[0]).to.deep.include({
        id: 'tx-1',
        hash: 'hash-1',
        sourceAccount: 'GABC1234567890ABCDEF1234567890ABCDEF1234567890',
        successful: true,
        status: 'success'
      });
      expect(response.data.transactions[0].operations).to.be.an('array');
    });
  });

  describe('LABS Mutations', function() {
    
    it('should create a new LABS', async function() {
      const LABSData = TestData.validLABS();
      
      // Mock LABS service
      TestUtils.mockLABSService('createLABS', LABSData);
      
      const CREATE_LABS = gql`
        mutation CreateLABS($input: CreateLABSInput!) {
          createLABS(
            LABS: $input.LABS
            publicKey: $input.publicKey
            serviceEndpoint: $input.serviceEndpoint
            verificationMethods: $input.verificationMethods
            services: $input.services
          ) {
            id
            LABS
            owner
            publicKey
            created
            active
          }
        }
      `;

      const response = await testServer.mutate({
        mutation: CREATE_LABS,
        variables: {
          input: {
            LABS: LABSData.LABS,
            publicKey: LABSData.publicKey,
            serviceEndpoint: LABSData.serviceEndpoint,
            verificationMethods: LABSData.verificationMethods,
            services: LABSData.services
          }
        }
      });

      expect(response.errors).to.be.undefined;
      expect(response.data).to.have.property('createLABS');
      expect(response.data.createLABS).to.deep.include({
        id: LABSData.LABS,
        LABS: LABSData.LABS,
        owner: LABSData.owner || testUser.walletAddress,
        publicKey: LABSData.publicKey,
        active: true
      });
      expect(response.data.createLABS).to.have.property('created');
    });

    it('should update an existing LABS', async function() {
      const updatedLABS = TestData.validLABS({
        serviceEndpoint: 'https://updated.example.com',
        publicKey: 'GDEF1234567890ABCDEF1234567890ABCDEF1234567890'
      });
      
      // Mock LABS service
      TestUtils.mockLABSService('updateLABS', updatedLABS);
      
      const UPDATE_LABS = gql`
        mutation UpdateLABS($LABS: String!, $input: UpdateLABSInput!) {
          updateLABS(LABS: $LABS, input: $input) {
            id
            LABS
            publicKey
            serviceEndpoint
            updated
            active
          }
        }
      `;

      const response = await testServer.mutate({
        mutation: UPDATE_LABS,
        variables: {
          LABS: 'LABS:stellar:GABC1234567890ABCDEF1234567890ABCDEF1234567890',
          input: {
            publicKey: 'GDEF1234567890ABCDEF1234567890ABCDEF1234567890',
            serviceEndpoint: 'https://updated.example.com'
          }
        }
      });

      expect(response.errors).to.be.undefined;
      expect(response.data).to.have.property('updateLABS');
      expect(response.data.updateLABS).to.deep.include({
        publicKey: 'GDEF1234567890ABCDEF1234567890ABCDEF1234567890',
        serviceEndpoint: 'https://updated.example.com',
        active: true
      });
      expect(response.data.updateLABS).to.have.property('updated');
    });

    it('should deactivate a LABS', async function() {
      const deactivatedLABS = TestData.validLABS({ active: false });
      
      // Mock LABS service
      TestUtils.mockLABSService('deactivateLABS', deactivatedLABS);
      
      const DEACTIVATE_LABS = gql`
        mutation DeactivateLABS($LABS: String!) {
          deactivateLABS(LABS: $LABS) {
            id
            LABS
            active
            deactivatedAt
          }
        }
      `;

      const response = await testServer.mutate({
        mutation: DEACTIVATE_LABS,
        variables: {
          LABS: 'LABS:stellar:GABC1234567890ABCDEF1234567890ABCDEF1234567890'
        }
      });

      expect(response.errors).to.be.undefined;
      expect(response.data).to.have.property('deactivateLABS');
      expect(response.data.deactivateLABS).to.deep.include({
        active: false
      });
      expect(response.data.deactivateLABS).to.have.property('deactivatedAt');
    });

    it('should handle LABS creation with invalid data', async function() {
      // Mock LABS service to throw validation error
      TestUtils.mockLABSService('createLABS', null, new Error('Invalid LABS format'));
      
      const CREATE_LABS = gql`
        mutation CreateLABS($input: CreateLABSInput!) {
          createLABS(
            LABS: $input.LABS
            publicKey: $input.publicKey
            serviceEndpoint: $input.serviceEndpoint
          ) {
            id
            LABS
          }
        }
      `;

      const response = await testServer.mutate({
        mutation: CREATE_LABS,
        variables: {
          input: {
            LABS: 'invalid-LABS',
            publicKey: 'invalid-key',
            serviceEndpoint: 'not-a-url'
          }
        }
      });

      expect(response.errors).to.exist;
      expect(response.errors[0].message).to.include('Failed to create LABS');
    });
  });

  describe('Credential Mutations', function() {
    
    it('should issue a new credential', async function() {
      const credentialData = TestData.validCredential();
      
      // Mock credential service
      TestUtils.mockCredentialService('issueCredential', credentialData);
      
      const ISSUE_CREDENTIAL = gql`
        mutation IssueCredential($input: IssueCredentialInput!) {
          issueCredential(
            issuer: $input.issuer
            subject: $input.subject
            credentialType: $input.credentialType
            claims: $input.claims
            expires: $input.expires
          ) {
            id
            issuer
            subject
            credentialType
            issued
            expires
            dataHash
            revoked
          }
        }
      `;

      const response = await testServer.mutate({
        mutation: ISSUE_CREDENTIAL,
        variables: {
          input: {
            issuer: credentialData.issuer,
            subject: credentialData.subject,
            credentialType: credentialData.credentialType,
            claims: credentialData.claims,
            expires: credentialData.expires
          }
        }
      });

      expect(response.errors).to.be.undefined;
      expect(response.data).to.have.property('issueCredential');
      expect(response.data.issueCredential).to.deep.include({
        issuer: credentialData.issuer,
        subject: credentialData.subject,
        credentialType: credentialData.credentialType,
        revoked: false
      });
      expect(response.data.issueCredential).to.have.property('issued');
      expect(response.data.issueCredential).to.have.property('dataHash');
    });

    it('should revoke a credential', async function() {
      const revokedCredential = TestData.validCredential({ revoked: true });
      
      // Mock credential service
      TestUtils.mockCredentialService('revokeCredential', revokedCredential);
      
      const REVOKE_CREDENTIAL = gql`
        mutation RevokeCredential($id: ID!) {
          revokeCredential(id: $id) {
            id
            revoked
            revokedAt
          }
        }
      `;

      const response = await testServer.mutate({
        mutation: REVOKE_CREDENTIAL,
        variables: { id: 'test-credential-id' }
      });

      expect(response.errors).to.be.undefined;
      expect(response.data).to.have.property('revokeCredential');
      expect(response.data.revokeCredential).to.deep.include({
        revoked: true
      });
      expect(response.data.revokeCredential).to.have.property('revokedAt');
    });

    it('should batch revoke credentials', async function() {
      const batchResult = {
        successful: 3,
        failed: 0,
        errors: []
      };
      
      // Mock credential service
      TestUtils.mockCredentialService('batchRevokeCredentials', batchResult);
      
      const BATCH_REVOKE = gql`
        mutation BatchRevokeCredentials($ids: [ID!]!) {
          batchRevokeCredentials(ids: $ids) {
            successful
            failed
            errors
          }
        }
      `;

      const response = await testServer.mutate({
        mutation: BATCH_REVOKE,
        variables: {
          ids: [
            'credential-1',
            'credential-2',
            'credential-3'
          ]
        }
      });

      expect(response.errors).to.be.undefined;
      expect(response.data).to.have.property('batchRevokeCredentials');
      expect(response.data.batchRevokeCredentials).to.deep.include({
        successful: 3,
        failed: 0,
        errors: []
      });
    });

    it('should verify a credential', async function() {
      const verificationResult = {
        valid: true,
        verifiedAt: new Date().toISOString(),
        checks: {
          signature: true,
          expiration: true,
          revocation: true,
          issuer: true
        }
      };
      
      // Mock credential service
      TestUtils.mockCredentialService('verifyCredential', verificationResult);
      
      const VERIFY_CREDENTIAL = gql`
        mutation VerifyCredential($credential: JSON!) {
          verifyCredential(credential: $credential) {
            valid
            verifiedAt
            checks {
              signature
              expiration
              revocation
              issuer
            }
            reason
          }
        }
      `;

      const response = await testServer.mutate({
        mutation: VERIFY_CREDENTIAL,
        variables: {
          credential: TestData.validCredential()
        }
      });

      expect(response.errors).to.be.undefined;
      expect(response.data).to.have.property('verifyCredential');
      expect(response.data.verifyCredential).to.deep.include({
        valid: true
      });
      expect(response.data.verifyCredential).to.have.property('verifiedAt');
      expect(response.data.verifyCredential.checks).to.be.an('object');
    });
  });

  describe('Stellar Mutations', function() {
    
    it('should create a transaction', async function() {
      const transactionData = TestData.validStellarTransaction();
      
      // Mock Stellar service
      TestUtils.mockStellarService('createTransaction', transactionData);
      
      const CREATE_TRANSACTION = gql`
        mutation CreateTransaction($input: CreateTransactionInput!) {
          createTransaction(
            sourceAccount: $input.sourceAccount
            operations: $input.operations
            memo: $input.memo
            fee: $input.fee
          ) {
            id
            sourceAccount
            fee
            operations {
              type
              details
            }
            status
            xdr
          }
        }
      `;

      const response = await testServer.mutate({
        mutation: CREATE_TRANSACTION,
        variables: {
          input: {
            sourceAccount: transactionData.sourceAccount,
            operations: transactionData.operations,
            memo: transactionData.memo,
            fee: transactionData.fee
          }
        }
      });

      expect(response.errors).to.be.undefined;
      expect(response.data).to.have.property('createTransaction');
      expect(response.data.createTransaction).to.deep.include({
        sourceAccount: transactionData.sourceAccount,
        fee: transactionData.fee,
        status: 'pending'
      });
      expect(response.data.createTransaction).to.have.property('id');
      expect(response.data.createTransaction).to.have.property('xdr');
      expect(response.data.createTransaction.operations).to.be.an('array');
    });

    it('should submit a transaction', async function() {
      const submissionResult = {
        id: 'submitted-tx-id',
        hash: 'submitted-tx-hash',
        status: 'submitted',
        submittedAt: new Date().toISOString()
      };
      
      // Mock Stellar service
      TestUtils.mockStellarService('submitTransaction', submissionResult);
      
      const SUBMIT_TRANSACTION = gql`
        mutation SubmitTransaction($xdr: String!) {
          submitTransaction(xdr: $xdr) {
            id
            hash
            status
            submittedAt
          }
        }
      `;

      const response = await testServer.mutate({
        mutation: SUBMIT_TRANSACTION,
        variables: {
          xdr: 'AAAAAgAAAAB...'
        }
      });

      expect(response.errors).to.be.undefined;
      expect(response.data).to.have.property('submitTransaction');
      expect(response.data.submitTransaction).to.deep.include({
        status: 'submitted'
      });
      expect(response.data.submitTransaction).to.have.property('id');
      expect(response.data.submitTransaction).to.have.property('hash');
      expect(response.data.submitTransaction).to.have.property('submittedAt');
    });
  });

  describe('Subscriptions', function() {
    
    it('should subscribe to LABS creation events', async function() {
      const mockLABS = TestData.validLABS();
      
      // Mock subscription
      TestUtils.mockSubscription('LABSCreated', mockLABS);
      
      const LABS_CREATED_SUBSCRIPTION = gql`
        subscription LABSCreated($owner: String) {
          LABSCreated(owner: $owner) {
            id
            LABS
            owner
            created
            active
          }
        }
      `;

      // Note: In a real test environment, you'd need to set up WebSocket connections
      // For this test, we'll verify the subscription query is valid
      const subscription = testServer.subscribe({
        query: LABS_CREATED_SUBSCRIPTION,
        variables: { owner: testUser.walletAddress }
      });

      // Verify subscription was created successfully
      expect(subscription).to.exist;
    });

    it('should subscribe to credential issuance events', async function() {
      const mockCredential = TestData.validCredential();
      
      // Mock subscription
      TestUtils.mockSubscription('credentialIssued', mockCredential);
      
      const CREDENTIAL_ISSUED_SUBSCRIPTION = gql`
        subscription CredentialIssued($issuer: String, $subject: String) {
          credentialIssued(issuer: $issuer, subject: $subject) {
            id
            issuer
            subject
            credentialType
            issued
          }
        }
      `;

      const subscription = testServer.subscribe({
        query: CREDENTIAL_ISSUED_SUBSCRIPTION,
        variables: { 
          issuer: mockCredential.issuer,
          subject: mockCredential.subject
        }
      });

      expect(subscription).to.exist;
    });

    it('should subscribe to transaction events', async function() {
      const mockTransaction = TestData.validStellarTransaction();
      
      // Mock subscription
      TestUtils.mockSubscription('transactionCreated', mockTransaction);
      
      const TRANSACTION_CREATED_SUBSCRIPTION = gql`
        subscription TransactionCreated($sourceAccount: String) {
          transactionCreated(sourceAccount: $sourceAccount) {
            id
            hash
            sourceAccount
            successful
            status
            createdAt
          }
        }
      `;

      const subscription = testServer.subscribe({
        query: TRANSACTION_CREATED_SUBSCRIPTION,
        variables: { sourceAccount: mockTransaction.sourceAccount }
      });

      expect(subscription).to.exist;
    });
  });

  describe('Error Handling', function() {
    
    it('should handle GraphQL validation errors', async function() {
      const INVALID_QUERY = gql`
        query InvalidQuery {
          LABS(LABS: $invalidVariable) {
            id
            LABS
          }
        }
      `;

      const response = await testServer.query({
        query: INVALID_QUERY
      });

      expect(response.errors).to.exist;
      expect(response.errors[0].message).to.include('Variable "$invalidVariable" is not defined');
    });

    it('should handle GraphQL syntax errors', async function() {
      const response = await testServer.query({
        query: '{ invalid { syntax }'
      });

      expect(response.errors).to.exist;
      expect(response.errors[0].message).to.include('Syntax Error');
    });

    it('should handle resolver errors gracefully', async function() {
      // Mock service to throw error
      TestUtils.mockLABSService('getLABS', null, new Error('Service unavailable'));
      
      const GET_LABS = gql`
        query GetLABS($LABS: String!) {
          LABS(LABS: $LABS) {
            id
            LABS
          }
        }
      `;

      const response = await testServer.query({
        query: GET_LABS,
        variables: { LABS: 'LABS:stellar:TEST' }
      });

      expect(response.errors).to.exist;
      expect(response.errors[0].message).to.include('Failed to fetch LABS');
      expect(response.errors[0]).to.have.property('path');
      expect(response.data).to.have.property('LABS', null);
    });

    it('should handle authentication errors in GraphQL', async function() {
      // Create server without authentication context
      const unauthenticatedServer = new ApolloServer({
        typeDefs,
        resolvers,
        context: () => ({
          user: null,
          logger: { info: () => {}, error: () => {} }
        })
      });
      
      const unauthenticatedClient = createTestClient(unauthenticatedServer);
      
      const GET_LABS = gql`
        query GetLABS($LABS: String!) {
          LABS(LABS: $LABS) {
            id
            LABS
          }
        }
      `;

      const response = await unauthenticatedClient.query({
        query: GET_LABS,
        variables: { LABS: 'LABS:stellar:TEST' }
      });

      expect(response.errors).to.exist;
      expect(response.errors[0].message).to.include('Authentication required');
    });
  });

  describe('Performance Tests', function() {
    
    it('should handle concurrent GraphQL requests', async function() {
      const concurrentRequests = 20;
      const promises = [];
      
      // Mock LABS service
      TestUtils.mockLABSService('getLABSs', TestData.generateBatch(TestData.validLABS, 10));
      TestUtils.mockLABSService('getLABSCount', 10);
      
      const LIST_LABSS = gql`
        query ListLABSs($limit: Int) {
          LABSs(limit: $limit) {
            id
            LABS
            active
          }
          LABSCount
        }
      `;

      for (let i = 0; i < concurrentRequests; i++) {
        promises.push(
          testServer.query({
            query: LIST_LABSS,
            variables: { limit: 10 }
          })
        );
      }
      
      const startTime = Date.now();
      const responses = await Promise.all(promises);
      const endTime = Date.now();
      
      // All requests should succeed
      responses.forEach(response => {
        expect(response.errors).to.be.undefined;
        expect(response.data).to.have.property('LABSs');
      });
      
      // Should complete within reasonable time (3 seconds for 20 requests)
      expect(endTime - startTime).to.be.lessThan(3000);
    });

    it('should maintain performance with complex queries', async function() {
      // Mock services
      TestUtils.mockLABSService('getLABS', TestData.validLABSWithVerificationMethods());
      TestUtils.mockCredentialService('getCredentials', TestData.generateBatch(TestData.validCredential, 5));
      
      const COMPLEX_QUERY = gql`
        query ComplexQuery($LABS: String!) {
          LABS(LABS: $LABS) {
            id
            LABS
            owner
            publicKey
            created
            active
            verificationMethods {
              id
              type
              publicKeyBase58
            }
            services {
              id
              type
              serviceEndpoint
            }
          }
          credentials(subject: $LABS, revoked: false) {
            id
            issuer
            credentialType
            issued
            expires
            claims
          }
        }
      `;

      const performance = await TestUtils.measurePerformance(async () => {
        const response = await testServer.query({
          query: COMPLEX_QUERY,
          variables: { LABS: 'LABS:stellar:TEST' }
        });
        
        expect(response.errors).to.be.undefined;
        expect(response.data).to.have.property('LABS');
        expect(response.data).to.have.property('credentials');
      }, 10);
      
      // Average response time should be under 500ms
      expect(performance.average).to.be.lessThan(500);
      expect(performance.max).to.be.lessThan(1000);
    });
  });

  describe('Integration Tests', function() {
    
    it('should handle complete LABS and credential lifecycle', async function() {
      // Mock services
      const LABSData = TestData.validLABS();
      const credentialData = TestData.validCredential({ subject: LABSData.LABS });
      
      TestUtils.mockLABSService('createLABS', LABSData);
      TestUtils.mockCredentialService('issueCredential', credentialData);
      TestUtils.mockCredentialService('verifyCredential', { valid: true });
      TestUtils.mockCredentialService('revokeCredential', { ...credentialData, revoked: true });
      
      // Create LABS
      const createLABSResponse = await testServer.mutate({
        query: gql`
          mutation CreateLABS($input: CreateLABSInput!) {
            createLABS(
              LABS: $input.LABS
              publicKey: $input.publicKey
              serviceEndpoint: $input.serviceEndpoint
            ) {
              id
              LABS
              active
            }
          }
        `,
        variables: {
          input: {
            LABS: LABSData.LABS,
            publicKey: LABSData.publicKey,
            serviceEndpoint: LABSData.serviceEndpoint
          }
        }
      });

      expect(createLABSResponse.errors).to.be.undefined;
      expect(createLABSResponse.data.createLABS.active).to.be.true;
      
      // Issue credential
      const issueCredentialResponse = await testServer.mutate({
        query: gql`
          mutation IssueCredential($input: IssueCredentialInput!) {
            issueCredential(
              issuer: $input.issuer
              subject: $input.subject
              credentialType: $input.credentialType
              claims: $input.claims
            ) {
              id
              issuer
              subject
              revoked
            }
          }
        `,
        variables: {
          input: {
            issuer: credentialData.issuer,
            subject: credentialData.subject,
            credentialType: credentialData.credentialType,
            claims: credentialData.claims
          }
        }
      });

      expect(issueCredentialResponse.errors).to.be.undefined;
      expect(issueCredentialResponse.data.issueCredential.revoked).to.be.false;
      
      // Verify credential
      const verifyResponse = await testServer.mutate({
        query: gql`
          mutation VerifyCredential($credential: JSON!) {
            verifyCredential(credential: $credential) {
              valid
            }
          }
        `,
        variables: {
          credential: credentialData
        }
      });

      expect(verifyResponse.errors).to.be.undefined;
      expect(verifyResponse.data.verifyCredential.valid).to.be.true;
      
      // Revoke credential
      const revokeResponse = await testServer.mutate({
        query: gql`
          mutation RevokeCredential($id: ID!) {
            revokeCredential(id: $id) {
              id
              revoked
            }
          }
        `,
        variables: {
          id: issueCredentialResponse.data.issueCredential.id
        }
      });

      expect(revokeResponse.errors).to.be.undefined;
      expect(revokeResponse.data.revokeCredential.revoked).to.be.true;
    });
  });
});

// Mock helper functions for GraphQL tests
TestUtils.mockLABSService = function(method, returnValue, error = null) {
  // This would integrate with actual mocking library
  // For now, we'll store the mock for reference
  this._mocks = this._mocks || {};
  this._mocks[`LABSService-${method}`] = { returnValue, error };
};

TestUtils.mockCredentialService = function(method, returnValue, error = null) {
  this._mocks = this._mocks || {};
  this._mocks[`credentialService-${method}`] = { returnValue, error };
};

TestUtils.mockStellarService = function(method, returnValue, error = null) {
  this._mocks = this._mocks || {};
  this._mocks[`stellarService-${method}`] = { returnValue, error };
};

TestUtils.mockSubscription = function(event, data) {
  this._mocks = this._mocks || {};
  this._mocks[`subscription-${event}`] = data;
};
