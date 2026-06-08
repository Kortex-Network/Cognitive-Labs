# 🦀 Cognitive Lab Smart Contract (Rust/Soroban)

A production-ready Cognitive Labs smart contract built with Rust and Soroban for the Stellar network.

## 🚀 Features

### **Cognitive Lab Management**
- ✅ Register new Cognitive Labs
- ✅ Resolve Cognitive Lab documents
- ✅ Update Cognitive Lab documents
- ✅ Deactivate Cognitive Labs
- ✅ Authorization control

### **Verifiable Credentials**
- ✅ Issue verifiable credentials
- ✅ Verify credentials
- ✅ Revoke credentials
- ✅ Expiration handling
- ✅ Claims hash verification

### **Security & Performance**
- ✅ Access control with owner verification
- ✅ Efficient storage patterns
- ✅ WASM optimization
- ✅ Comprehensive error handling
- ✅ Full test coverage

## 📁 Contract Structure

```
contracts/rust/
├── 📦 Cargo.toml          # Dependencies and configuration
├── 🦀 src/
│   ├── 📄 lib.rs          # Main contract implementation
│   └── 🧪 tests.rs        # Comprehensive test suite
├── 🔧 Makefile            # Build and deployment automation
└── 📖 README.md           # This documentation
```

## 🛠️ Prerequisites

1. **Rust Toolchain**
   ```bash
   curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
   rustup target add wasm32-unknown-unknown
   ```

2. **Soroban CLI**
   ```bash
   make install
   ```

3. **WASM Tools** (for optimization)
   ```bash
   # Ubuntu/Debian
   sudo apt-get install binaryen
   
   # macOS
   brew install binaryen
   
   # Or download from https://github.com/WebAssembly/binaryen
   ```

## 🚀 Quick Start

### **1. Build the Contract**
```bash
make build
```

### **2. Run Tests**
```bash
make test
```

### **3. Optimize WASM**
```bash
make optimize
```

### **4. Deploy to Testnet**
```bash
# Set environment variables
export DEPLOYER_SECRET="your-secret-key"
export NETWORK="testnet"

# Deploy contract
make deploy-testnet
```

### **5. Initialize Contract**
```bash
export CONTRACT_ID="deployed-contract-id"
export OWNER_ADDRESS="your-stellar-address"

make init-contract
```

## 📖 API Reference

### **Cognitive Lab Operations**

#### `register_LABS`
Register a new cognitive labs identity.

```rust
pub fn register_LABS(
    env: Env,
    Cognitive Lab: Bytes,
    public_key: Bytes,
    service_endpoint: Option<String>,
    owner: Address,
) -> Result<(), Error>
```

**Parameters:**
- `Cognitive Lab`: Cognitive Lab identifier (bytes)
- `public_key`: Stellar public key
- `service_endpoint`: Optional service endpoint URL
- `owner`: Contract owner address

#### `resolve_LABS`
Resolve a Cognitive Lab document.

```rust
pub fn resolve_LABS(env: Env, Cognitive Lab: Bytes) -> Result<LABSDocument, Error>
```

#### `update_LABS`
Update an existing Cognitive Lab document.

```rust
pub fn update_LABS(
    env: Env,
    Cognitive Lab: Bytes,
    public_key: Option<Bytes>,
    service_endpoint: Option<String>,
    updater: Address,
) -> Result<(), Error>
```

#### `deactivate_LABS`
Deactivate a Cognitive Lab.

```rust
pub fn deactivate_LABS(env: Env, Cognitive Lab: Bytes, deactivator: Address) -> Result<(), Error>
```

### **Credential Operations**

#### `issue_credential`
Issue a new verifiable credential.

```rust
pub fn issue_credential(
    env: Env,
    issuer: Bytes,
    subject: Bytes,
    credential_type: String,
    claims_hash: Bytes,
    expires: Option<u64>,
    issuer_address: Address,
) -> Result<Bytes, Error>
```

#### `verify_credential`
Verify a credential's validity.

```rust
pub fn verify_credential(env: Env, credential_id: Bytes) -> Result<VerifiableCredential, Error>
```

#### `revoke_credential`
Revoke a credential.

```rust
pub fn revoke_credential(
    env: Env,
    credential_id: Bytes,
    revoker_address: Address,
) -> Result<(), Error>
```

### **Utility Functions**

#### `get_contract_info`
Get contract metadata.

```rust
pub fn get_contract_info(env: Env) -> Result<ContractInfo, Error>
```

#### `LABS_exists`
Check if a Cognitive Lab exists.

```rust
pub fn LABS_exists(env: Env, Cognitive Lab: Bytes) -> bool
```

#### `credential_exists`
Check if a credential exists.

```rust
pub fn credential_exists(env: Env, credential_id: Bytes) -> bool
```

## 🔧 Data Structures

### **LABSDocument**
```rust
pub struct LABSDocument {
    pub Cognitive Lab: Bytes,
    pub owner: Address,
    pub public_key: Bytes,
    pub service_endpoint: Option<String>,
    pub created: u64,
    pub updated: u64,
    pub active: bool,
}
```

### **VerifiableCredential**
```rust
pub struct VerifiableCredential {
    pub id: Bytes,
    pub issuer: Bytes,
    pub subject: Bytes,
    pub credential_type: String,
    pub claims_hash: Bytes,
    pub issued: u64,
    pub expires: Option<u64>,
    pub revoked: bool,
}
```

## 🧪 Testing

Run the comprehensive test suite:

```bash
# Run all tests
make test

# Run specific test
cargo test test_register_and_resolve_LABS

# Run tests with output
cargo test -- --nocapture
```

### **Test Coverage**
- ✅ Contract initialization
- ✅ Cognitive Lab registration and resolution
- ✅ Cognitive Lab updates and deactivation
- ✅ Authorization controls
- ✅ Credential issuance and verification
- ✅ Credential revocation
- ✅ Error handling
- ✅ Edge cases

## 🚀 Deployment

### **Environment Variables**
```bash
# Required for deployment
export DEPLOYER_SECRET="your-deployer-secret-key"
export NETWORK="testnet"  # or "futurenet"

# Required for operations
export CONTRACT_ID="deployed-contract-id"
export OWNER_ADDRESS="contract-owner-address"
export OWNER_SECRET="contract-owner-secret"
export USER_SECRET="user-secret-key"
```

### **Deployment Commands**
```bash
# Deploy to testnet
make deploy-testnet

# Deploy to futurenet
make deploy-futurenet

# Initialize contract
make init-contract
```

## 📊 Usage Examples

### **Register a Cognitive Lab**
```bash
export Cognitive Lab="Cognitive Lab:stellar:GABCDEFGHIJKLMNOPQRSTUVWXYZ"
export PUBLIC_KEY="GABCDEFGHIJKLMNOPQRSTUVWXYZ"
export SERVICE_ENDPOINT="https://example.com/Cognitive Lab"

make register-Cognitive Lab
```

### **Issue a Credential**
```bash
export ISSUER_LABS="Cognitive Lab:stellar:GABCDEFGHIJKLMNOPQRSTUVWXYZ"
export SUBJECT_LABS="Cognitive Lab:stellar:BCDEFGHIJKLMNOPQRSTUVWXYZABCDEF"
export CREDENTIAL_TYPE="UniversityDegree"
export CLAIMS_HASH="hash_of_claims_data"
export EXPIRES="1704067200"  # Unix timestamp

make issue-credential
```

### **Verify a Credential**
```bash
export CREDENTIAL_ID="credential-id-from-issue"

make verify-credential
```

## 🔒 Security Considerations

### **Access Control**
- Only Cognitive Lab owners can update/deactivate their Cognitive Labs
- Only credential issuers can revoke credentials
- Contract owner can initialize but not modify individual Cognitive Labs

### **Data Privacy**
- Claims are stored as hashes, not raw data
- Service endpoints are optional
- No personal data stored directly on-chain

### **Attack Mitigation**
- Input validation for all parameters
- Authorization checks on all mutating operations
- Proper error handling without information leakage

## 📈 Performance

### **Optimization Features**
- WASM optimization with `wasm-opt`
- Efficient storage patterns
- Minimal computational overhead
- Gas-optimized operations

### **Size Analysis**
```bash
make size
```

### **Benchmarking**
```bash
# Run with Soroban CLI for gas estimation
soroban contract invoke \
  --id $CONTRACT_ID \
  --network $NETWORK \
  --source $USER_SECRET \
  -- \
  resolve_LABS \
  --Cognitive Lab "test-Cognitive Lab"
```

## 🔄 Integration

### **Backend Integration**
```javascript
// Example JavaScript integration
const { Contract } = require('@stellar/stellar-sdk');

const contract = new Contract({
  contractId: 'CONTRACT_ID',
  networkPassphrase: 'Test SDF Network ; September 2015',
  rpcUrl: 'https://horizon-testnet.stellar.org',
});

// Resolve Cognitive Lab
const result = await contract.call('resolve_LABS', {
  Cognitive Lab: 'Cognitive Lab:stellar:G...'
});
```

### **Frontend Integration**
```typescript
// TypeScript example
interface LABSDocument {
  Cognitive Lab: string;
  owner: string;
  public_key: string;
  service_endpoint?: string;
  created: number;
  updated: number;
  active: boolean;
}

async function resolveLABS(Cognitive Lab: string): Promise<LABSDocument> {
  // Contract call implementation
}
```

## 🐛 Debugging

### **Common Issues**
1. **Build Errors**: Ensure `wasm32-unknown-unknown` target is installed
2. **Deployment Failures**: Check network and secret key configuration
3. **Authorization Errors**: Verify address ownership and permissions

### **Debug Commands**
```bash
# Check contract logs
soroban contract logs --id $CONTRACT_ID --network $NETWORK

# Inspect WASM
wasm-objdump -d target/wasm32-unknown-unknown/release/stellar_LABS_contract.wasm

# Run with debug output
RUST_LOG=debug cargo test
```

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Run tests: `make test`
5. Run checks: `make check`
6. Submit a pull request

## 📄 License

MIT License - see LICENSE file for details.

## 🙏 Acknowledgments

- **Stellar Development Foundation** - Soroban platform
- **Rust Community** - Tooling and ecosystem
- **W3C Cognitive Lab Working Group** - Cognitive Lab standards

---

**Built with 🦀 Rust for the Stellar network**
