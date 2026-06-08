const StellarSDK = require('stellar-sdk');
const dotenv = require('dotenv');

dotenv.config();

class StellarService {
  constructor() {
    this.server = new StellarSDK.Horizon.Server(
      process.env.STELLAR_HORIZON_URL || 'https://horizon-testnet.stellar.org'
    );
    
    // Set network
    if (process.env.STELLAR_NETWORK === 'PUBLIC') {
      StellarSDK.Network.usePublicNetwork();
    } else {
      StellarSDK.Network.useTestNetwork();
    }
  }

  /**
   * Create a new Stellar account
   */
  async createAccount() {
    const pair = StellarSDK.Keypair.random();
    return {
      publicKey: pair.publicKey(),
      secretKey: pair.secret(),
      address: pair.publicKey()
    };
  }

  /**
   * Fund a testnet account using friendbot
   */
  async fundTestnetAccount(publicKey) {
    if (process.env.STELLAR_NETWORK !== 'TESTNET') {
      throw new Error('Friendbot only available on testnet');
    }

    try {
      const response = await fetch(`https://friendbot.stellar.org?addr=${publicKey}`);
      const result = await response.json();
      return result;
    } catch (error) {
      throw new Error(`Failed to fund account: ${error.message}`);
    }
  }

  /**
   * Get account information
   */
  async getAccount(publicKey) {
    try {
      const account = await this.server.loadAccount(publicKey);
      return account;
    } catch (error) {
      throw new Error(`Account not found: ${error.message}`);
    }
  }

  /**
   * Create a transaction with LABS document in memo
   */
  async createLABSTransaction(secretKey, LABSDocument) {
    try {
      const keypair = StellarSDK.Keypair.fromSecret(secretKey);
      const account = await this.server.loadAccount(keypair.publicKey());

      // Convert LABS document to JSON string
      const LABSDocumentString = JSON.stringify(LABSDocument);
      
      // Check if document fits in memo (28 bytes max for text memo)
      if (LABSDocumentString.length > 28) {
        // For larger documents, we'll use manage_data operations
        return await this.createLABSWithDataOperation(keypair, LABSDocument);
      }

      const transaction = new StellarSDK.TransactionBuilder(account, {
        fee: StellarSDK.BASE_FEE,
        networkPassphrase: StellarSDK.Network.current().networkPassphrase()
      })
        .addOperation(StellarSDK.Operation.payment({
          destination: keypair.publicKey(), // Self-payment to create transaction
          asset: StellarSDK.Asset.native(),
          amount: '0.00001' // Minimum amount
        }))
        .addMemo(StellarSDK.Memo.text(LABSDocumentString))
        .setTimeout(30)
        .build();

      transaction.sign(keypair);
      return transaction;
    } catch (error) {
      throw new Error(`Failed to create LABS transaction: ${error.message}`);
    }
  }

  /**
   * Store LABS document using manage_data operations
   */
  async createLABSWithDataOperation(keypair, LABSDocument) {
    try {
      const account = await this.server.loadAccount(keypair.publicKey());
      
      // Split LABS document into chunks if needed
      const LABSString = JSON.stringify(LABSDocument);
      const chunks = this.splitIntoChunks(LABSString, 64); // 64 bytes per data entry
      
      let transaction = new StellarSDK.TransactionBuilder(account, {
        fee: StellarSDK.BASE_FEE * chunks.length,
        networkPassphrase: StellarSDK.Network.current().networkPassphrase()
      });

      // Add manage_data operations for each chunk
      chunks.forEach((chunk, index) => {
        transaction = transaction.addOperation(
          StellarSDK.Operation.manageData({
            name: `LABS_${index.toString().padStart(3, '0')}`,
            value: chunk
          })
        );
      });

      // Add a marker operation to indicate this is a LABS document
      transaction = transaction.addOperation(
        StellarSDK.Operation.manageData({
          name: 'LABS_marker',
          value: 'stellar_LABS_v1'
        })
      );

      transaction = transaction.setTimeout(30).build();
      transaction.sign(keypair);
      
      return transaction;
    } catch (error) {
      throw new Error(`Failed to create LABS with data operations: ${error.message}`);
    }
  }

  /**
   * Submit transaction to Stellar network
   */
  async submitTransaction(transaction) {
    try {
      const result = await this.server.submitTransaction(transaction);
      return result;
    } catch (error) {
      throw new Error(`Transaction failed: ${error.message}`);
    }
  }

  /**
   * Resolve LABS document from Stellar account
   */
  async resolveLABS(publicKey) {
    try {
      const account = await this.server.loadAccount(publicKey);
      
      // Check for LABS marker
      const LABSMarker = account.data_attr?.LABS_marker;
      
      if (LABSMarker === 'stellar_LABS_v1') {
        // Reconstruct LABS document from data entries
        return await this.reconstructLABSFromData(account);
      } else {
        // Try to get from transaction memos
        return await this.getLABSFromTransactions(publicKey);
      }
    } catch (error) {
      throw new Error(`Failed to resolve LABS: ${error.message}`);
    }
  }

  /**
   * Reconstruct LABS document from data entries
   */
  async reconstructLABSFromData(account) {
    const dataEntries = account.data_attr || {};
    const chunks = [];
    
    // Collect all LABS chunks
    Object.keys(dataEntries).forEach(key => {
      if (key.startsWith('LABS_') && key !== 'LABS_marker') {
        const index = parseInt(key.replace('LABS_', ''));
        chunks[index] = dataEntries[key];
      }
    });
    
    // Sort and join chunks
    const sortedChunks = chunks.filter(chunk => chunk !== undefined).sort((a, b) => {
      const indexA = Object.keys(dataEntries).find(key => dataEntries[key] === a).replace('LABS_', '');
      const indexB = Object.keys(dataEntries).find(key => dataEntries[key] === b).replace('LABS_', '');
      return parseInt(indexA) - parseInt(indexB);
    });
    
    const LABSString = sortedChunks.join('');
    
    try {
      return JSON.parse(LABSString);
    } catch (error) {
      throw new Error('Invalid LABS document format');
    }
  }

  /**
   * Get LABS document from transaction memos
   */
  async getIDFromTransactions(publicKey) {
    try {
      const transactions = await this.server
        .transactions()
        .forAccount(publicKey)
        .order('desc')
        .limit(10)
        .call();

      for (const tx of transactions.records) {
        if (tx.memo && tx.memo.memo_type === 'text') {
          try {
            const LABSDocument = JSON.parse(tx.memo.memo);
            return LABSDocument;
          } catch (error) {
            // Not a valid JSON, continue searching
            continue;
          }
        }
      }
      
      throw new Error('No LABS document found in transactions');
    } catch (error) {
      throw new Error(`Failed to get LABS from transactions: ${error.message}`);
    }
  }

  /**
   * Split string into chunks of specified size
   */
  splitIntoChunks(str, chunkSize) {
    const chunks = [];
    for (let i = 0; i < str.length; i += chunkSize) {
      chunks.push(str.slice(i, i + chunkSize));
    }
    return chunks;
  }

  /**
   * Verify transaction signature
   */
  verifyTransactionSignature(transaction, publicKey) {
    try {
      return StellarSDK.Keypair.fromPublicKey(publicKey).verify(transaction.hash(), transaction.signature);
    } catch (error) {
      return false;
    }
  }
}

module.exports = StellarService;
