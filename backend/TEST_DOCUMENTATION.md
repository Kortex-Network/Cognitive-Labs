# Comprehensive API Testing Suite Documentation

## Overview

The Cognitive Lab Platform includes a comprehensive testing suite designed to prevent regression issues, ensure API reliability, and maintain high code quality. This documentation covers the testing architecture, implementation, and usage.

## Table of Contents

1. [Test Architecture](#test-architecture)
2. [Test Suites](#test-suites)
3. [Test Configuration](#test-configuration)
4. [Running Tests](#running-tests)
5. [Test Data Management](#test-data-management)
6. [Performance Testing](#performance-testing)
7. [Security Testing](#security-testing)
8. [Integration Testing](#integration-testing)
9. [Continuous Integration](#continuous-integration)
10. [Troubleshooting](#troubleshooting)

---

## Test Architecture

### Testing Pyramid

```
    E2E Tests (5%)
         ↑
Integration Tests (15%)
         ↑
  API Tests (30%)
         ↑
   Unit Tests (50%)
```

### Test Structure

```
backend/src/tests/
├── api/                    # REST API tests
│   ├── api.test.js        # Core API functionality
│   └── graphql.test.js    # GraphQL API tests
├── integration/            # Integration tests
│   └── integration.test.js # Cross-service integration
├── performance/            # Performance tests
│   └── performance.test.js # Load and stress testing
├── security/               # Security tests
│   ├── auth.test.js       # Authentication tests
│   ├── authorization.test.js # Authorization tests
│   └── vulnerability.test.js # Security vulnerability tests
├── unit/                   # Unit tests
│   ├── services/          # Service layer tests
│   ├── utils/             # Utility function tests
│   └── middleware/        # Middleware tests
├── utils/                  # Test utilities
│   ├── testUtils.js       # Common test helpers
│   ├── testData.js        # Test data generators
│   └── mocks.js           # Mock implementations
├── config/                 # Test configuration
│   └── test-config.js     # Test settings
├── fixtures/               # Test fixtures
│   ├── Cognitive Labs.json          # Sample Cognitive Lab data
│   ├── credentials.json   # Sample credential data
│   └── users.json         # Sample user data
├── runner.js               # Test runner script
└── setup.js                # Test setup file
```

---

## Test Suites

### 1. Unit Tests

**Purpose**: Test individual functions and methods in isolation

**Coverage**:
- Service layer functions
- Utility functions
- Middleware components
- Data validation functions
- Business logic

**Example**:
```javascript
describe('Cognitive Lab Service - createLABS', function() {
  it('should create Cognitive Lab with valid data', async function() {
    const LABSData = TestData.validLABS();
    const result = await LABSService.createLABS(LABSData);
    
    expect(result).to.have.property('id');
    expect(result.Cognitive Lab).to.equal(LABSData.Cognitive Lab);
  });
});
```

### 2. API Tests

**Purpose**: Test REST API endpoints and GraphQL resolvers

**Coverage**:
- All REST API endpoints
- GraphQL queries, mutations, and subscriptions
- Request/response validation
- Error handling
- Authentication and authorization

**REST API Example**:
```javascript
describe('POST /api/v1/Cognitive Lab', function() {
  it('should create Cognitive Lab with valid data', async function() {
    const LABSData = TestData.validLABS();
    
    const response = await request(app)
      .post('/api/v1/Cognitive Lab')
      .set('Authorization', `Bearer ${authToken}`)
      .send(LABSData)
      .expect(201);
    
    expect(response.body.success).to.be.true;
    expect(response.body.data.Cognitive Lab).to.equal(LABSData.Cognitive Lab);
  });
});
```

**GraphQL Example**:
```javascript
describe('Cognitive Lab GraphQL Query', function() {
  it('should fetch Cognitive Lab by ID', async function() {
    const GET_LABS = gql`
      query GetLABS($Cognitive Lab: String!) {
        Cognitive Lab(Cognitive Lab: $Cognitive Lab) {
          id
          Cognitive Lab
          active
        }
      }
    `;
    
    const response = await testServer.query({
      query: GET_LABS,
      variables: { Cognitive Lab: 'test-Cognitive Lab' }
    });
    
    expect(response.errors).to.be.undefined;
    expect(response.data.Cognitive Lab).to.have.property('id');
  });
});
```

### 3. Integration Tests

**Purpose**: Test interactions between multiple services and components

**Coverage**:
- Complete user journeys
- Cross-service data flow
- Database operations
- External service integrations
- End-to-end workflows

**Example**:
```javascript
describe('Complete Cognitive Lab Lifecycle', function() {
  it('should handle full Cognitive Lab creation to deactivation', async function() {
    // Create Cognitive Lab
    const createResponse = await createLABS(LABSData);
    
    // Issue credential
    const credentialResponse = await issueCredential(credentialData);
    
    // Verify credential
    const verifyResponse = await verifyCredential(credentialResponse.body.data);
    
    // Revoke credential
    await revokeCredential(credentialResponse.body.data.id);
    
    // Deactivate Cognitive Lab
    await deactivateLABS(createResponse.body.data.Cognitive Lab);
  });
});
```

### 4. Performance Tests

**Purpose**: Ensure API performance meets requirements and detect regressions

**Coverage**:
- Response time benchmarks
- Concurrent request handling
- Memory usage monitoring
- Database query performance
- Cache effectiveness

**Example**:
```javascript
describe('Cognitive Lab Creation Performance', function() {
  it('should handle 100 concurrent Cognitive Lab creations', async function() {
    const loadTest = await TestUtils.runLoadTest(
      () => createLABS(TestData.validLABS()),
      50,  // concurrency
      10000 // duration (ms)
    );
    
    expect(loadTest.requestsPerSecond).to.be.greaterThan(100);
    expect(loadTest.averageResponseTime).to.be.lessThan(500);
  });
});
```

### 5. Security Tests

**Purpose**: Identify and prevent security vulnerabilities

**Coverage**:
- Authentication bypass attempts
- Authorization boundary testing
- Input validation (SQL injection, XSS, etc.)
- Rate limiting effectiveness
- Data exposure prevention

**Example**:
```javascript
describe('Security - Input Validation', function() {
  it('should prevent SQL injection attempts', async function() {
    const maliciousInput = "'; DROP TABLE users; --";
    
    const response = await request(app)
      .get(`/api/v1/Cognitive Lab?owner=${maliciousInput}`)
      .set('Authorization', `Bearer ${authToken}`)
      .expect(400);
    
    expect(response.body.error.code).to.equal('VALIDATION_ERROR');
  });
});
```

---

## Test Configuration

### Configuration File: `tests/config/test-config.js`

**Key Settings**:

```javascript
const config = {
  timeouts: {
    default: 30000,        // 30 seconds
    integration: 60000,    // 1 minute
    performance: 120000,  // 2 minutes
  },
  thresholds: {
    api: {
      LABS_create: { average: 500, max: 1000 },
      LABS_read: { average: 200, max: 400 },
      // ... other thresholds
    }
  },
  coverage: {
    statements: 80,
    branches: 80,
    functions: 80,
    lines: 80
  }
};
```

### Performance Thresholds

| Operation | Average (ms) | Max (ms) | Description |
|-----------|---------------|----------|-------------|
| Cognitive Lab Create | 500 | 1000 | Create new Cognitive Lab document |
| Cognitive Lab Read | 200 | 400 | Retrieve Cognitive Lab document |
| Cognitive Lab Update | 300 | 600 | Update Cognitive Lab document |
| Credential Issue | 400 | 800 | Issue verifiable credential |
| Credential Verify | 300 | 600 | Verify credential |
| Stellar Account | 300 | 600 | Get Stellar account info |

---

## Running Tests

### Package.json Scripts

```json
{
  "scripts": {
    "test": "node src/tests/runner.js",
    "test:unit": "node src/tests/runner.js --suite unit",
    "test:api": "node src/tests/runner.js --suite api",
    "test:graphql": "node src/tests/runner.js --suite graphql",
    "test:integration": "node src/tests/runner.js --suite integration",
    "test:performance": "node src/tests/runner.js --suite performance",
    "test:security": "node src/tests/runner.js --suite security",
    "test:coverage": "node src/tests/runner.js --coverage",
    "test:watch": "node src/tests/runner.js --watch",
    "test:ci": "npm run test:unit && npm run test:api && npm run test:graphql"
  }
}
```

### Basic Usage

```bash
# Run all tests
npm test

# Run specific test suite
npm run test:unit
npm run test:api
npm run test:graphql

# Run with coverage
npm run test:coverage

# Watch mode for development
npm run test:watch
```

### Advanced Usage

```bash
# Run tests matching specific pattern
node src/tests/runner.js --grep "Cognitive Lab"

# Run specific suite with pattern
node src/tests/runner.js --suite api --grep "create"

# Continue running even if required suites fail
node src/tests/runner.js --continue
```

---

## Test Data Management

### Test Data Generators

**File**: `tests/utils/testData.js`

Provides methods to generate realistic test data:

```javascript
// Generate valid Cognitive Lab data
const LABSData = TestData.validLABS({
  Cognitive Lab: 'Cognitive Lab:stellar:GABC...',
  publicKey: 'GABC...',
  serviceEndpoint: 'https://example.com'
});

// Generate valid credential data
const credentialData = TestData.validCredential({
  issuer: 'Cognitive Lab:stellar:GABC...',
  subject: 'Cognitive Lab:stellar:GDEF...',
  credentialType: 'DegreeCredential'
});

// Generate test scenarios
const scenario = TestData.testScenario('full-LABS-lifecycle');
```

### Test Utilities

**File**: `tests/utils/testUtils.js`

Common testing helpers:

```javascript
// Setup test environment
await TestUtils.setupTestEnvironment();

// Create test user with auth token
const user = await TestUtils.createTestUser();
const token = TestUtils.generateAuthToken(user);

// Measure performance
const performance = await TestUtils.measurePerformance(async () => {
  await someOperation();
}, 10); // 10 iterations

// Run load test
const loadTest = await TestUtils.runLoadTest(
  () => apiCall(),
  50,  // concurrency
  10000 // duration (ms)
);
```

### Mock Services

Comprehensive mocking for external dependencies:

```javascript
// Mock Stellar account
TestUtils.mockStellarAccount('GABC...', mockAccountData);

// Mock contract deployment
TestUtils.mockContractDeployment();

// Mock service errors
TestUtils.mockServerError('/api/v1/stellar/account', 'GET');
```

---

## Performance Testing

### Load Testing

Tests API performance under various load conditions:

```javascript
describe('Load Testing', function() {
  it('should handle 50 concurrent requests', async function() {
    const loadTest = await TestUtils.runLoadTest(
      () => request(app).get('/api/v1/Cognitive Lab'),
      50,  // concurrency
      10000 // duration (ms)
    );
    
    expect(loadTest.requestsPerSecond).to.be.greaterThan(100);
    expect(loadTest.errorRate).to.be.lessThan(0.01);
  });
});
```

### Stress Testing

Tests system limits and recovery:

```javascript
describe('Stress Testing', function() {
  it('should recover from resource exhaustion', async function() {
    // Simulate high load
    await runHighLoad(200, 5000);
    
    // Test recovery
    const recoveryTime = await measureRecovery();
    expect(recoveryTime).to.be.lessThan(5000);
  });
});
```

### Performance Regression Detection

Automatically detects performance regressions:

```javascript
describe('Performance Regression', function() {
  it('should not regress Cognitive Lab creation performance', function() {
    const current = await measureLABSCreationPerformance();
    const baseline = getPerformanceBaseline('LABS_create');
    
    testConfig.checkPerformanceRegression(current.average, baseline.average, 'LABS_create');
  });
});
```

---

## Security Testing

### Authentication Tests

```javascript
describe('Authentication Security', function() {
  it('should reject requests without authentication', async function() {
    const response = await request(app)
      .get('/api/v1/Cognitive Lab')
      .expect(401);
    
    expect(response.body.error.code).to.equal('UNAUTHORIZED');
  });
  
  it('should reject requests with expired tokens', async function() {
    const expiredToken = generateExpiredToken();
    
    const response = await request(app)
      .get('/api/v1/Cognitive Lab')
      .set('Authorization', `Bearer ${expiredToken}`)
      .expect(401);
  });
});
```

### Authorization Tests

```javascript
describe('Authorization Security', function() {
  it('should prevent unauthorized Cognitive Lab access', async function() {
    // User 1 creates Cognitive Lab
    const Cognitive Lab = await createLABS(user1Token);
    
    // User 2 tries to access User 1's Cognitive Lab
    const response = await request(app)
      .put(`/api/v1/Cognitive Lab/${Cognitive Lab.id}`)
      .set('Authorization', `Bearer ${user2Token}`)
      .send({ serviceEndpoint: 'malicious.com' })
      .expect(403);
    
    expect(response.body.error.code).to.equal('FORBIDDEN');
  });
});
```

### Input Validation Tests

```javascript
describe('Input Validation Security', function() {
  it('should prevent SQL injection', async function() {
    const maliciousInput = "'; DROP TABLE users; --";
    
    const response = await request(app)
      .get(`/api/v1/Cognitive Lab?owner=${maliciousInput}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(400);
    
    expect(response.body.error.code).to.equal('VALIDATION_ERROR');
  });
  
  it('should prevent XSS attacks', async function() {
    const xssPayload = '<script>alert("xss")</script>';
    
    const response = await request(app)
      .post('/api/v1/Cognitive Lab')
      .set('Authorization', `Bearer ${token}`)
      .send({
        Cognitive Lab: `Cognitive Lab:stellar:${xssPayload}`,
        publicKey: 'GABC...'
      })
      .expect(400);
  });
});
```

---

## Integration Testing

### Database Integration

```javascript
describe('Database Integration', function() {
  it('should maintain data consistency across operations', async function() {
    // Create Cognitive Lab
    const Cognitive Lab = await createLABS(LABSData);
    
    // Issue credential
    const credential = await issueCredential({
      issuer: Cognitive Lab.id,
      subject: Cognitive Lab.id
    });
    
    // Verify data consistency
    const LABSCheck = await getLABS(Cognitive Lab.id);
    const credentialCheck = await getCredential(credential.id);
    
    expect(LABSCheck.active).to.be.true;
    expect(credentialCheck.revoked).to.be.false;
  });
});
```

### External Service Integration

```javascript
describe('Stellar Integration', function() {
  it('should integrate with Stellar network', async function() {
    // Mock Stellar responses
    TestUtils.mockStellarAccount(testAddress);
    TestUtils.mockStellarTransactions(testAddress);
    
    // Test integration
    const account = await getStellarAccount(testAddress);
    const transactions = await getStellarTransactions(testAddress);
    
    expect(account).to.have.property('address', testAddress);
    expect(transactions).to.be.an('array');
  });
});
```

---

## Continuous Integration

### GitHub Actions Workflow

```yaml
name: Test Suite

on:
  push:
    branches: [ main, develop ]
  pull_request:
    branches: [ main ]

jobs:
  test:
    runs-on: ubuntu-latest
    
    services:
      mongodb:
        image: mongo:5.0
        ports:
          - 27017:27017
      redis:
        image: redis:7
        ports:
          - 6379:6379
    
    steps:
    - uses: actions/checkout@v3
    
    - name: Setup Node.js
      uses: actions/setup-node@v3
      with:
        node-version: '18'
        cache: 'npm'
    
    - name: Install dependencies
      run: npm ci
    
    - name: Run unit tests
      run: npm run test:unit
    
    - name: Run API tests
      run: npm run test:api
    
    - name: Run GraphQL tests
      run: npm run test:graphql
    
    - name: Run integration tests
      run: npm run test:integration
    
    - name: Run security tests
      run: npm run test:security
    
    - name: Generate coverage report
      run: npm run test:coverage
    
    - name: Upload coverage to Codecov
      uses: codecov/codecov-action@v3
```

### Pre-commit Hooks

```json
{
  "husky": {
    "hooks": {
      "pre-commit": "npm run test:unit && npm run lint",
      "pre-push": "npm run test:ci"
    }
  }
}
```

---

## Troubleshooting

### Common Issues

#### 1. Test Database Connection Issues

**Problem**: Tests fail to connect to test database

**Solution**:
```bash
# Ensure MongoDB is running
docker-compose up -d mongodb

# Check connection string
echo $MONGODB_TEST_URI

# Reset test database
npm run test:db:reset
```

#### 2. Redis Connection Issues

**Problem**: Tests fail to connect to Redis

**Solution**:
```bash
# Ensure Redis is running
docker-compose up -d redis

# Test connection
redis-cli ping

# Clear Redis cache
npm run test:redis:clear
```

#### 3. Authentication Token Issues

**Problem**: Tests fail with authentication errors

**Solution**:
```javascript
// Check token generation
const token = TestUtils.generateAuthToken(testUser);
console.log('Token:', token);

// Verify token payload
const decoded = jwt.decode(token);
console.log('Decoded:', decoded);
```

#### 4. Performance Test Failures

**Problem**: Performance tests fail due to slow execution

**Solution**:
```javascript
// Increase timeout for performance tests
this.timeout(120000); // 2 minutes

// Check system resources
console.log('Memory:', process.memoryUsage());
console.log('CPU:', process.cpuUsage());
```

#### 5. Mock Service Issues

**Problem**: Mocked services not working correctly

**Solution**:
```javascript
// Verify mock setup
const mockData = TestUtils.getMockData('stellar-account-GABC...');
console.log('Mock data:', mockData);

// Clear and reset mocks
TestUtils._mocks = {};
```

### Debugging Tips

#### 1. Enable Verbose Logging

```bash
VERBOSE_TESTS=true npm run test:unit
```

#### 2. Run Individual Tests

```bash
# Run specific test file
npx mocha tests/unit/services/LABSService.test.js

# Run specific test case
npx mocha tests/unit/services/LABSService.test.js --grep "createLABS"
```

#### 3. Generate Detailed Reports

```bash
# Generate HTML coverage report
npm run test:coverage

# Generate detailed test report
node tests/runner.js --report json > test-results.json
```

#### 4. Debug with VS Code

```json
// .vscode/launch.json
{
  "type": "node",
  "request": "launch",
  "name": "Debug Tests",
  "program": "${workspaceFolder}/node_modules/.bin/mocha",
  "args": ["--timeout", "30000", "tests/**/*.test.js"],
  "env": {
    "NODE_ENV": "test"
  }
}
```

---

## Best Practices

### 1. Test Organization

- Group related tests in describe blocks
- Use descriptive test names
- Keep tests focused and independent
- Use beforeEach/afterEach for setup/teardown

### 2. Test Data Management

- Use factory functions for test data
- Avoid hardcoded test values
- Generate realistic data variations
- Clean up test data after each test

### 3. Assertion Strategy

- Use specific assertions
- Assert on relevant properties only
- Include helpful error messages
- Test both positive and negative cases

### 4. Mock Management

- Mock external dependencies
- Reset mocks between tests
- Verify mock interactions
- Use realistic mock data

### 5. Performance Considerations

- Set appropriate timeouts
- Avoid unnecessary delays
- Use parallel execution where possible
- Monitor test execution time

---

## Coverage Requirements

### Minimum Coverage Targets

- **Statements**: 80%
- **Branches**: 80%
- **Functions**: 80%
- **Lines**: 80%

### Coverage Exclusions

- Test files
- Configuration files
- Mock/stub files
- Third-party libraries

### Coverage Reports

- Text summary in console
- HTML report for detailed view
- LCOV format for CI integration
- JSON for programmatic analysis

---

## Maintenance

### Regular Tasks

1. **Update Test Data**: Keep test data generators current with API changes
2. **Review Performance Baselines**: Update thresholds based on monitoring data
3. **Add New Tests**: Cover new features and edge cases
4. **Refactor Tests**: Improve test organization and reduce duplication
5. **Update Documentation**: Keep this documentation current

### Monitoring

- Track test execution time trends
- Monitor flaky test patterns
- Analyze coverage gaps
- Review failure patterns

---

## Conclusion

This comprehensive testing suite provides multiple layers of protection against regression issues and ensures the Cognitive Lab Platform API remains reliable, secure, and performant. Regular execution of these tests, combined with continuous integration, helps maintain high code quality and confidence in deployments.

For questions or contributions to the testing suite, please refer to the project's contribution guidelines or contact the development team.
