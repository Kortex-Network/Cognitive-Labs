// Unit tests for CrossChainService methods

// Mock ethers
jest.mock('ethers', () => {
  const mockReceipt = { hash: '0xmocktxhash' };
  const mockWait = jest.fn().mockResolvedValue(mockReceipt);
  const mockBridgeLABS = jest.fn().mockResolvedValue({ hash: '0xmocktxhash', wait: mockWait });
  const mockBridgeCredential = jest.fn().mockResolvedValue({ hash: '0xmocktxhash', wait: mockWait });
  const mockGetLABSDocument = jest.fn().mockImplementation((LABS) => {
    if (LABS === 'LABS:stellar:EXISTS') {
      return Promise.resolve({ LABS: 'LABS:stellar:EXISTS', owner: '0xOwner' });
    }
    return Promise.resolve({ LABS: '' }); // not found
  });

  return {
    ethers: {
      JsonRpcProvider: jest.fn().mockImplementation(() => ({})),
      Wallet: jest.fn().mockImplementation(() => ({ provider: {} })),
      Contract: jest.fn().mockImplementation(() => ({
        bridgeLABS: mockBridgeLABS,
        bridgeCredential: mockBridgeCredential,
        getLABSDocument: mockGetLABSDocument
      })),
      id: jest.fn().mockReturnValue('0xmockhash'),
      isHexString: jest.fn().mockReturnValue(false),
    }
  };
});

// Mock ContractService
const mockGetLABS = jest.fn();
const mockGetCredential = jest.fn();
jest.mock('../services/contractService', () => {
  return jest.fn().mockImplementation(() => ({
    getLABS: mockGetLABS,
    getCredential: mockGetCredential
  }));
});

const CrossChainService = require('../services/crossChainService');

describe('CrossChainService', () => {
  let service;

  beforeEach(() => {
    service = new CrossChainService();
    jest.clearAllMocks();
  });

  // ─── bridgeLABSToEthereum ─────────────────────────────────────────────────

  describe('bridgeLABSToEthereum', () => {
    it('throws if LABS not found on Stellar', async () => {
      mockGetLABS.mockResolvedValue(null);

      await expect(
        service.bridgeLABSToEthereum('LABS:stellar:NOTFOUND', '0xOwner')
      ).rejects.toThrow(/not found on Stellar/);
    });

    it('successfully bridges a LABS and returns receipt', async () => {
      mockGetLABS.mockResolvedValue({
        LABS: 'LABS:stellar:GABC123',
        publicKey: 'mockPublicKey',
        serviceEndpoint: 'https://example.com'
      });

      const receipt = await service.bridgeLABSToEthereum('LABS:stellar:GABC123', '0xOwner');
      expect(receipt).toEqual({ hash: '0xmocktxhash' });
    });
  });

  // ─── bridgeCredentialToEthereum ──────────────────────────────────────────

  describe('bridgeCredentialToEthereum', () => {
    it('throws if credential not found on Stellar', async () => {
      mockGetCredential.mockResolvedValue(null);

      await expect(
        service.bridgeCredentialToEthereum('cred-404', '0xdatahash')
      ).rejects.toThrow(/not found on Stellar/);
    });

    it('successfully bridges a credential and returns receipt', async () => {
      mockGetCredential.mockResolvedValue({
        id: 'cred-001',
        issuer: 'LABS:stellar:ISSUER',
        subject: 'LABS:stellar:SUBJECT',
        type: 'IdentityCredential',
        claims: '{"name":"Alice"}',
        revoked: false
      });

      const receipt = await service.bridgeCredentialToEthereum('cred-001', '0xdatahash');
      expect(receipt).toEqual({ hash: '0xmocktxhash' });
    });
  });

  // ─── verifyCrossChainState ───────────────────────────────────────────────

  describe('verifyCrossChainState', () => {
    it('returns synced: false when LABS exists on Stellar but not Ethereum', async () => {
      mockGetLABS.mockResolvedValue({ LABS: 'LABS:stellar:GABC123' });

      const status = await service.verifyCrossChainState('LABS:stellar:NOTBRIDGED');
      expect(status.stellar).toBe(true);
      expect(status.synced).toBe(false);
    });

    it('returns stellar: false when LABS not on Stellar', async () => {
      mockGetLABS.mockResolvedValue(null);

      const status = await service.verifyCrossChainState('LABS:stellar:MISSING');
      expect(status.stellar).toBe(false);
      expect(status.synced).toBe(false);
    });
  });
});
