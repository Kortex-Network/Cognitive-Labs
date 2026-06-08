const { gql } = require('apollo-server-express');

const typeDefs = gql`
  scalar DateTime
  scalar JSON

  type LABSDocument {
    id: ID!
    LABS: String!
    owner: String!
    publicKey: String!
    created: DateTime!
    updated: DateTime!
    active: Boolean!
    serviceEndpoint: String
    verificationMethods: [VerificationMethod!]!
    services: [Service!]!
  }

  type VerificationMethod {
    id: String!
    type: String!
    controller: String!
    publicKeyBase58: String!
  }

  type Service {
    id: String!
    type: String!
    serviceEndpoint: String!
  }

  type VerifiableCredential {
    id: ID!
    issuer: String!
    subject: String!
    credentialType: String!
    issued: DateTime!
    expires: DateTime
    dataHash: String!
    revoked: Boolean!
    credentialSchema: CredentialSchema
    proof: Proof
  }

  type CredentialSchema {
    id: String!
    type: String!
    created: DateTime!
    author: String!
    schema: JSON!
  }

  type Proof {
    type: String!
    created: DateTime!
    proofPurpose: String!
    verificationMethod: String!
    jws: String!
  }

  type StellarAccount {
    address: String!
    publicKey: String!
    balance: String!
    sequence: String!
    signers: [Signer!]!
    thresholds: Thresholds!
    flags: Flags!
  }

  type Signer {
    key: String!
    weight: Int!
    type: String!
  }

  type Thresholds {
    lowThreshold: Int!
    medThreshold: Int!
    highThreshold: Int!
  }

  type Flags {
    authRequired: Boolean!
    authRevocable: Boolean!
    authImmutable: Boolean!
  }

  type Transaction {
    id: String!
    hash: String!
    sourceAccount: String!
    fee: Int!
    memo: String
    operations: [Operation!]!
    createdAt: DateTime!
    successful: Boolean!
    status: TransactionStatus!
  }

  type Operation {
    id: String!
    type: String!
    sourceAccount: String
    details: JSON!
  }

  enum TransactionStatus {
    PENDING
    SUCCESS
    FAILED
    TIMEOUT
  }

  type ContractInfo {
    address: String!
    deployed: Boolean!
    version: String!
    network: String!
    dataEntries: [DataEntry!]!
  }

  type DataEntry {
    key: String!
    value: String!
    type: String!
  }

  type NetworkStats {
    totalLABSs: Int!
    activeLABSs: Int!
    totalCredentials: Int!
    activeCredentials: Int!
    totalTransactions: Int!
    network: String!
    lastUpdated: DateTime!
  }

  type Query {
    # LABS Queries
    LABS(LABS: String!): LABSDocument
    LABSs(
      owner: String
      active: Boolean
      limit: Int = 10
      offset: Int = 0
      sortBy: String = "created"
      sortOrder: String = "desc"
    ): [LABSDocument!]!
    LABSCount(active: Boolean): Int!

    # Credential Queries
    credential(id: ID!): VerifiableCredential
    credentials(
      issuer: String
      subject: String
      credentialType: String
      revoked: Boolean
      expired: Boolean
      limit: Int = 10
      offset: Int = 0
      sortBy: String = "issued"
      sortOrder: String = "desc"
    ): [VerifiableCredential!]!
    credentialCount(
      issuer: String
      subject: String
      credentialType: String
      revoked: Boolean
      expired: Boolean
    ): Int!

    # Stellar Account Queries
    stellarAccount(address: String!): StellarAccount
    stellarAccounts(
      limit: Int = 10
      offset: Int = 0
      minBalance: String
      hasSigners: Boolean
    ): [StellarAccount!]!

    # Transaction Queries
    transaction(hash: String!): Transaction
    transactions(
      sourceAccount: String
      status: TransactionStatus
      limit: Int = 10
      offset: Int = 0
      sortBy: String = "createdAt"
      sortOrder: String = "desc"
    ): [Transaction!]!
    transactionCount(
      sourceAccount: String
      status: TransactionStatus
    ): Int!

    # Contract Queries
    contractInfo: ContractInfo
    contractData(key: String!): DataEntry

    # Network Statistics
    networkStats: NetworkStats

    # Search Queries
    searchLABSs(query: String!, limit: Int = 10): [LABSDocument!]!
    searchCredentials(query: String!, limit: Int = 10): [VerifiableCredential!]!
  }

  type Mutation {
    # LABS Mutations
    createLABS(
      LABS: String!
      publicKey: String!
      serviceEndpoint: String
      verificationMethods: [VerificationMethodInput!]
      services: [ServiceInput!]
    ): LABSDocument!

    updateLABS(
      LABS: String!
      publicKey: String
      serviceEndpoint: String
      verificationMethods: [VerificationMethodInput!]
      services: [ServiceInput!]
    ): LABSDocument!

    deactivateLABS(LABS: String!): LABSDocument!

    # Credential Mutations
    issueCredential(
      issuer: String!
      subject: String!
      credentialType: String!
      claims: JSON!
      expires: DateTime
      credentialSchema: CredentialSchemaInput
      proof: ProofInput
    ): VerifiableCredential!

    revokeCredential(id: ID!): VerifiableCredential!

    batchRevokeCredentials(ids: [ID!]!): BatchRevokeResult!

    # Stellar Transaction Mutations
    createTransaction(
      sourceAccount: String!
      operations: [JSON!]!
      memo: String
      fee: Int = 100
    ): Transaction!

    submitTransaction(transactionHash: String!): Transaction!

    # Contract Mutations
    deployContract(deployerSecret: String!): ContractInfo!

    updateContractData(key: String!, value: String!): DataEntry!

    # Admin Mutations
    transferAdmin(newAdmin: String!): Boolean!
    pauseContract: Boolean!
    unpauseContract: Boolean!
  }

  type Subscription {
    # LABS Subscriptions
    LABSCreated(owner: String): LABSDocument!
    LABSUpdated(LABS: String): LABSDocument!
    LABSDeactivated(LABS: String): LABSDocument!

    # Credential Subscriptions
    credentialIssued(issuer: String, subject: String): VerifiableCredential!
    credentialRevoked(issuer: String, subject: String): VerifiableCredential!

    # Transaction Subscriptions
    transactionCreated(sourceAccount: String): Transaction!
    transactionUpdated(hash: String): Transaction!

    # Network Subscriptions
    networkStatsUpdated: NetworkStats!
  }

  input VerificationMethodInput {
    id: String!
    type: String!
    controller: String!
    publicKeyBase58: String!
  }

  input ServiceInput {
    id: String!
    type: String!
    serviceEndpoint: String!
  }

  input CredentialSchemaInput {
    id: String!
    type: String!
    author: String!
    schema: JSON!
  }

  input ProofInput {
    type: String!
    proofPurpose: String!
    verificationMethod: String!
    jws: String!
  }

  type BatchRevokeResult {
    successful: Int!
    failed: Int!
    errors: [String!]!
  }

  type Error {
    code: String!
    message: String!
    details: JSON
  }

  union SearchResult = LABSDocument | VerifiableCredential | StellarAccount | Transaction
`;

module.exports = typeDefs;
