const { ApolloServer, gql } = require('apollo-server-express');
const { createTestClient } = require('apollo-server-testing');
const typeDefs = require('../schema');
const resolvers = require('../resolvers');

// Mock services
jest.mock('../../services/LABSService');
jest.mock('../../services/credentialService');
jest.mock('../../services/stellarService');
jest.mock('../../services/contractService');

const LABSService = require('../../services/LABSService');
const CredentialService = require('../../services/credentialService');
const StellarService = require('../../services/stellarService');
const ContractService = require('../../services/contractService');

describe('GraphQL API', () => {
  let testServer;
  let server;

  beforeAll(() => {
    server = new ApolloServer({
      typeDefs,
      resolvers,
      context: () => ({
        logger: { info: jest.fn(), error: jest.fn() },
        req: { headers: {} },
        res: {}
      })
    });
    testServer = createTestClient(server);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('LABS Queries', () => {
    it('should fetch a single LABS', async () => {
      const mockLABS = {
        id: 'LABS:stellar:GABC1234567890ABCDEF1234567890ABCDEF1234567890',
        LABS: 'LABS:stellar:GABC1234567890ABCDEF1234567890ABCDEF1234567890',
        owner: 'GABC1234567890ABCDEF1234567890ABCDEF1234567890',
        publicKey: 'GABC1234567890ABCDEF1234567890ABCDEF1234567890',
        created: new Date('2023-01-01'),
        updated: new Date('2023-01-01'),
        active: true,
        serviceEndpoint: 'https://example.com',
        verificationMethods: [],
        services: []
      };

      LABSService.getLABS.mockResolvedValue(mockLABS);

      const GET_LABS = gql`
        query GetLABS($LABS: String!) {
          LABS(LABS: $LABS) {
            id
            LABS
            owner
            publicKey
            created
            active
            serviceEndpoint
          }
        }
      `;

      const response = await testServer.query({
        query: GET_LABS,
        variables: { LABS: 'LABS:stellar:GABC1234567890ABCDEF1234567890ABCDEF1234567890' }
      });

      expect(response.errors).toBeUndefined();
      expect(response.data.LABS).toEqual({
        id: mockLABS.id,
        LABS: mockLABS.LABS,
        owner: mockLABS.owner,
        publicKey: mockLABS.publicKey,
        created: mockLABS.created.toISOString(),
        active: mockLABS.active,
        serviceEndpoint: mockLABS.serviceEndpoint
      });
      expect(LABSService.getLABS).toHaveBeenCalledWith('LABS:stellar:GABC1234567890ABCDEF1234567890ABCDEF1234567890');
    });

    it('should handle LABS not found error', async () => {
      LABSService.getLABS.mockRejectedValue(new Error('LABS not found'));

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
        variables: { LABS: 'LABS:stellar:INVALID' }
      });

      expect(response.errors).toBeDefined();
      expect(response.errors[0].message).toBe('Failed to fetch LABS');
    });

    it('should fetch multiple LABSs with filters', async () => {
      const mockLABSs = [
        {
          id: 'LABS:stellar:GABC1234567890ABCDEF1234567890ABCDEF1234567890',
          LABS: 'LABS:stellar:GABC1234567890ABCDEF1234567890ABCDEF1234567890',
          owner: 'GABC1234567890ABCDEF1234567890ABCDEF1234567890',
          active: true,
          created: new Date('2023-01-01'),
          verificationMethods: [],
          services: []
        }
      ];

      LABSService.getLABSs.mockResolvedValue(mockLABSs);
      LABSService.getLABSCount.mockResolvedValue(1);

      const LIST_LABSS = gql`
        query ListLABSs($owner: String, $active: Boolean, $limit: Int) {
          LABSs(owner: $owner, active: $active, limit: $limit) {
            id
            LABS
            owner
            active
            created
          }
          LABSCount(active: $active)
        }
      `;

      const response = await testServer.query({
        query: LIST_LABSS,
        variables: { owner: 'GABC1234567890ABCDEF1234567890ABCDEF1234567890', active: true, limit: 10 }
      });

      expect(response.errors).toBeUndefined();
      expect(response.data.LABSs).toHaveLength(1);
      expect(response.data.LABSCount).toBe(1);
      expect(LABSService.getLABSs).toHaveBeenCalledWith(
        { owner: 'GABC1234567890ABCDEF1234567890ABCDEF1234567890', active: true },
        { limit: 10, offset: 0, sortBy: 'created', sortOrder: 'desc' }
      );
    });

    it('should search LABSs', async () => {
      const mockResults = [
        {
          id: 'LABS:stellar:GABC1234567890ABCDEF1234567890ABCDEF1234567890',
          LABS: 'LABS:stellar:GABC1234567890ABCDEF1234567890ABCDEF1234567890',
          owner: 'GABC1234567890ABCDEF1234567890ABCDEF1234567890',
          serviceEndpoint: 'https://example.com',
          verificationMethods: [],
          services: []
        }
      ];

      LABSService.searchLABSs.mockResolvedValue(mockResults);

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
        variables: { query: 'example', limit: 10 }
      });

      expect(response.errors).toBeUndefined();
      expect(response.data.searchLABSs).toHaveLength(1);
      expect(LABSService.searchLABSs).toHaveBeenCalledWith('example', 10);
    });
  });

  describe('Credential Queries', () => {
    it('should fetch a single credential', async () => {
      const mockCredential = {
        id: 'urn:uuid:12345678-1234-1234-1234-123456789012',
        issuer: 'LABS:stellar:GABC1234567890ABCDEF1234567890ABCDEF1234567890',
        subject: 'LABS:stellar:GDEF1234567890ABCDEF1234567890ABCDEF1234567890',
        credentialType: 'Degree',
        issued: new Date('2023-01-01'),
        expires: new Date('2024-01-01'),
        dataHash: 'abc123',
        revoked: false
      };

      CredentialService.getCredential.mockResolvedValue(mockCredential);

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
          }
        }
      `;

      const response = await testServer.query({
        query: GET_CREDENTIAL,
        variables: { id: 'urn:uuid:12345678-1234-1234-1234-123456789012' }
      });

      expect(response.errors).toBeUndefined();
      expect(response.data.credential).toEqual({
        id: mockCredential.id,
        issuer: mockCredential.issuer,
        subject: mockCredential.subject,
        credentialType: mockCredential.credentialType,
        issued: mockCredential.issued.toISOString(),
        expires: mockCredential.expires.toISOString(),
        dataHash: mockCredential.dataHash,
        revoked: mockCredential.revoked
      });
    });

    it('should fetch credentials with filters', async () => {
      const mockCredentials = [
        {
          id: 'urn:uuid:12345678-1234-1234-1234-123456789012',
          issuer: 'LABS:stellar:GABC1234567890ABCDEF1234567890ABCDEF1234567890',
          subject: 'LABS:stellar:GDEF1234567890ABCDEF1234567890ABCDEF1234567890',
          credentialType: 'Degree',
          issued: new Date('2023-01-01'),
          revoked: false
        }
      ];

      CredentialService.getCredentials.mockResolvedValue(mockCredentials);
      CredentialService.getCredentialCount.mockResolvedValue(1);

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
        variables: { 
          issuer: 'LABS:stellar:GABC1234567890ABCDEF1234567890ABCDEF1234567890', 
          revoked: false, 
          limit: 10 
        }
      });

      expect(response.errors).toBeUndefined();
      expect(response.data.credentials).toHaveLength(1);
      expect(response.data.credentialCount).toBe(1);
    });
  });

  describe('Stellar Queries', () => {
    it('should fetch Stellar account', async () => {
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

      StellarService.getAccount.mockResolvedValue(mockAccount);

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

      expect(response.errors).toBeUndefined();
      expect(response.data.stellarAccount).toEqual(mockAccount);
    });
  });

  describe('Mutations', () => {
    it('should create a LABS', async () => {
      const mockLABS = {
        id: 'LABS:stellar:GABC1234567890ABCDEF1234567890ABCDEF1234567890',
        LABS: 'LABS:stellar:GABC1234567890ABCDEF1234567890ABCDEF1234567890',
        owner: 'GABC1234567890ABCDEF1234567890ABCDEF1234567890',
        publicKey: 'GABC1234567890ABCDEF1234567890ABCDEF1234567890',
        created: new Date('2023-01-01'),
        active: true
      };

      LABSService.createLABS.mockResolvedValue(mockLABS);

      const CREATE_LABS = gql`
        mutation CreateLABS($LABS: String!, $publicKey: String!, $serviceEndpoint: String) {
          createLABS(LABS: $LABS, publicKey: $publicKey, serviceEndpoint: $serviceEndpoint) {
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
          LABS: 'LABS:stellar:GABC1234567890ABCDEF1234567890ABCDEF1234567890',
          publicKey: 'GABC1234567890ABCDEF1234567890ABCDEF1234567890',
          serviceEndpoint: 'https://example.com'
        }
      });

      expect(response.errors).toBeUndefined();
      expect(response.data.createLABS).toEqual({
        id: mockLABS.id,
        LABS: mockLABS.LABS,
        owner: mockLABS.owner,
        publicKey: mockLABS.publicKey,
        created: mockLABS.created.toISOString(),
        active: mockLABS.active
      });
    });

    it('should issue a credential', async () => {
      const mockCredential = {
        id: 'urn:uuid:12345678-1234-1234-1234-123456789012',
        issuer: 'LABS:stellar:GABC1234567890ABCDEF1234567890ABCDEF1234567890',
        subject: 'LABS:stellar:GDEF1234567890ABCDEF1234567890ABCDEF1234567890',
        credentialType: 'Degree',
        issued: new Date('2023-01-01'),
        dataHash: 'abc123',
        revoked: false
      };

      CredentialService.issueCredential.mockResolvedValue(mockCredential);

      const ISSUE_CREDENTIAL = gql`
        mutation IssueCredential($issuer: String!, $subject: String!, $credentialType: String!, $claims: JSON!) {
          issueCredential(issuer: $issuer, subject: $subject, credentialType: $credentialType, claims: $claims) {
            id
            issuer
            subject
            credentialType
            issued
            dataHash
            revoked
          }
        }
      `;

      const response = await testServer.mutate({
        mutation: ISSUE_CREDENTIAL,
        variables: {
          issuer: 'LABS:stellar:GABC1234567890ABCDEF1234567890ABCDEF1234567890',
          subject: 'LABS:stellar:GDEF1234567890ABCDEF1234567890ABCDEF1234567890',
          credentialType: 'Degree',
          claims: { degree: 'Bachelor of Science', university: 'Example University' }
        }
      });

      expect(response.errors).toBeUndefined();
      expect(response.data.issueCredential).toEqual({
        id: mockCredential.id,
        issuer: mockCredential.issuer,
        subject: mockCredential.subject,
        credentialType: mockCredential.credentialType,
        issued: mockCredential.issued.toISOString(),
        dataHash: mockCredential.dataHash,
        revoked: mockCredential.revoked
      });
    });

    it('should batch revoke credentials', async () => {
      const mockResult = {
        successful: 2,
        failed: 0,
        errors: []
      };

      CredentialService.batchRevokeCredentials.mockResolvedValue(mockResult);

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
            'urn:uuid:12345678-1234-1234-1234-123456789012',
            'urn:uuid:12345678-1234-1234-1234-123456789013'
          ]
        }
      });

      expect(response.errors).toBeUndefined();
      expect(response.data.batchRevokeCredentials).toEqual(mockResult);
    });
  });

  describe('Network Statistics', () => {
    it('should fetch network statistics', async () => {
      const mockStats = {
        totalLABSs: 100,
        activeLABSs: 80,
        totalCredentials: 250,
        activeCredentials: 200,
        totalTransactions: 500,
        network: 'TESTNET',
        lastUpdated: new Date('2023-01-01')
      };

      // Mock all the service calls
      LABSService.getLABSCount.mockResolvedValue(100);
      LABSService.getLABSCount.mockResolvedValue(80);
      CredentialService.getCredentialCount.mockResolvedValue(250);
      CredentialService.getCredentialCount.mockResolvedValue(200);
      StellarService.getTransactionCount.mockResolvedValue(500);

      const GET_STATS = gql`
        query GetNetworkStats {
          networkStats {
            totalLABSs
            activeLABSs
            totalCredentials
            activeCredentials
            totalTransactions
            network
            lastUpdated
          }
        }
      `;

      const response = await testServer.query({ query: GET_STATS });

      expect(response.errors).toBeUndefined();
      expect(response.data.networkStats).toEqual({
        totalLABSs: 100,
        activeLABSs: 80,
        totalCredentials: 250,
        activeCredentials: 200,
        totalTransactions: 500,
        network: 'TESTNET',
        lastUpdated: expect.any(String)
      });
    });
  });

  describe('Error Handling', () => {
    it('should handle service errors gracefully', async () => {
      LABSService.getLABS.mockRejectedValue(new Error('Service unavailable'));

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
        variables: { LABS: 'LABS:stellar:GABC1234567890ABCDEF1234567890ABCDEF1234567890' }
      });

      expect(response.errors).toBeDefined();
      expect(response.errors[0].message).toBe('Failed to fetch LABS');
      expect(response.data).toEqual({ LABS: null });
    });
  });
});
