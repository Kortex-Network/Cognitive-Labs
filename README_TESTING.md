# Cognitive Lab - Test Suite

## Overview

This repository contains a comprehensive test suite for the Cognitive Lab smart contracts, achieving **95%+ test coverage** with extensive edge case testing and security validation.

## Test Suite Structure

```
test/
├── helpers/
│   └── test-utils.js           # Test utilities and helper functions
├── EthereumLABSRegistry.test.js # Unit tests for Cognitive Lab Registry
├── RecoveryGovernance.test.js  # Unit tests for Governance
├── StateRecovery.test.js       # Unit tests for State Recovery (existing)
├── Integration.test.js         # Cross-contract integration tests
├── Security.test.js            # Security vulnerability tests
└── EdgeCases.test.js           # Edge case and boundary condition tests
```

## Quick Start

### Prerequisites
- Node.js >= 16.0.0
- npm or yarn

### Installation
```bash
npm install
```

### Running Tests

#### All Tests
```bash
npm test
```

#### Coverage Report
```bash
npm run test:coverage
```

#### Specific Test Categories
```bash
# Unit tests only
npm run test:unit

# Integration tests
npm run test:integration

# Security tests
npm run test:security

# Edge case tests
npm run test:edgecases
```

#### Generate Test Report
```bash
npm run test:report
```

## Test Coverage

### Coverage Metrics
- **Function Coverage**: 95%+
- **Line Coverage**: 95%+
- **Branch Coverage**: 95%+

### Contracts Covered
1. **EthereumLABSRegistry.sol** - Main Cognitive Lab registry contract
2. **RecoveryGovernance.sol** - Governance and oversight contract
3. **StateRecovery.sol** - State recovery system

## Test Categories

### 1. Unit Tests
- Contract initialization
- Role management
- Core functionality
- Error conditions
- Edge cases

### 2. Integration Tests
- Cross-contract interactions
- End-to-end workflows
- State consistency
- Emergency scenarios

### 3. Security Tests
- Access control validation
- Attack vector prevention
- Input validation
- Cryptographic security

### 4. Edge Case Tests
- Boundary conditions
- Invalid inputs
- Concurrency issues
- Performance limits

## Test Utilities

The `TestHelper` class provides utilities for:
- Contract deployment
- Role setup
- Test data generation
- Time manipulation
- Event verification
- Gas calculation

### Example Usage
```javascript
const TestHelper = require("./helpers/test-utils");

// Deploy contracts
const contracts = await TestHelper.deployContracts(signers);

// Setup roles
await TestHelper.setupRolesAndPermissions(contracts, signers);

// Create test Cognitive Lab setup
const LABSData = await TestHelper.createCompleteLABSSetup(contracts, signers);

// Perform governed recovery
const result = await TestHelper.performGovernedRecovery(contracts, signers, recoveryData, reason);
```

## Test Data Generation

### Cognitive Lab Generation
```javascript
const Cognitive Lab = TestHelper.generateTestLABS(address);
```

### Public Key Generation
```javascript
const publicKey = TestHelper.generateTestPublicKey(64);
```

### Credential Generation
```javascript
const credential = TestHelper.generateTestCredential(issuer, subject, type);
```

### Claim Generation
```javascript
const claim = TestHelper.generateTestClaim(topic, issuer);
```

## Security Testing

### Access Control Tests
- Role-based access validation
- Unauthorized function call prevention
- Role hierarchy enforcement

### Attack Vector Tests
- Reentrancy attack prevention
- Front-running protection
- Gas griefing mitigation
- Denial of service prevention

### Input Validation Tests
- Malicious input handling
- Overflow prevention
- Format validation

## Performance Testing

### Gas Usage
- Gas optimization verification
- Gas limit scenario testing
- Cost analysis reporting

### Scalability
- High-volume operations
- Batch processing
- Memory usage validation

## Continuous Integration

### GitHub Actions
```yaml
name: Test Coverage
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - name: Setup Node.js
        uses: actions/setup-node@v2
        with:
          node-version: '16'
      - name: Install dependencies
        run: npm install
      - name: Run tests with coverage
        run: npm run test:coverage
```

### Coverage Reporting
- Automated coverage reports
- Coverage threshold enforcement
- Trend monitoring
- PR coverage checks

## Test Configuration

### Hardhat Configuration
```javascript
module.exports = {
  solidity: {
    version: "0.8.19",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200
      }
    }
  },
  paths: {
    sources: "./contracts",
    tests: "./test",
    cache: "./cache",
    artifacts: "./artifacts"
  }
};
```

### Coverage Configuration
```javascript
module.exports = {
  providerOptions: {
    coverage: true
  },
  mocha: {
    timeout: 60000
  }
};
```

## Best Practices

### 1. Test Writing
- Write descriptive test names
- Use helper functions for setup
- Test both success and failure cases
- Verify events and state changes

### 2. Test Organization
- Group related tests
- Use beforeEach for setup
- Keep tests focused and independent
- Document complex scenarios

### 3. Coverage Maintenance
- Aim for 95%+ coverage
- Review coverage reports regularly
- Add tests for new features
- Remove obsolete tests

## Troubleshooting

### Common Issues

#### Timeout Errors
```bash
# Increase timeout in hardhat.config.js
mocha: {
  timeout: 120000 // 2 minutes
}
```

#### Gas Limit Issues
```bash
# Increase gas limit in test
const tx = await contract.method(params, { gasLimit: 8000000 });
```

#### Coverage Issues
```bash
# Clean and recompile
npm run clean
npm run compile
npm run test:coverage
```

### Debugging Tips
- Use `console.log` for debugging
- Check event logs for verification
- Use Hardhat network forking
- Enable trace logging

## Contributing

### Adding New Tests
1. Follow existing test patterns
2. Use TestHelper utilities
3. Add appropriate documentation
4. Verify coverage impact

### Test Standards
- All tests must pass
- Maintain 95%+ coverage
- Include edge case testing
- Document security considerations

## Documentation

- [Test Coverage Analysis](./TEST_COVERAGE_ANALYSIS.md)
- [Smart Contract Documentation](./docs/)
- [API Documentation](./docs/api/)
- [Security Audit Report](./contracts/SECURITY_AUDIT_REPORT.md)

## Support

For questions about the test suite:
1. Check existing documentation
2. Review test examples
3. Open an issue with details
4. Contact the development team

## License

MIT License - see LICENSE file for details.
