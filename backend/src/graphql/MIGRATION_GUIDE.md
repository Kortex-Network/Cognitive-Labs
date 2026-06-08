# REST to GraphQL Migration Guide

## Overview

This guide helps developers migrate from the REST API to the new GraphQL API, providing step-by-step instructions and code examples for a smooth transition.

## Why Migrate to GraphQL?

### Benefits Over REST
- **Single Endpoint**: All operations through `/graphql`
- **Flexible Queries**: Request only the data you need
- **No Over-fetching**: Eliminate unnecessary data transfer
- **No Under-fetching**: Get all required data in one request
- **Type Safety**: Strongly typed schema with validation
- **Real-time Updates**: WebSocket subscriptions
- **Better Developer Experience**: Interactive playground

## Migration Strategy

### Phase 1: Parallel Usage
- Keep existing REST API calls
- Add GraphQL for new features
- Test GraphQL endpoints alongside REST

### Phase 2: Gradual Migration
- Replace simple read operations first
- Move complex queries to GraphQL
- Update mutations one by one

### Phase 3: Full Migration
- Remove all REST API dependencies
- Optimize GraphQL queries
- Implement subscriptions for real-time features

## Endpoint Mapping

### Cognitive Lab Operations

| REST Endpoint | GraphQL Query/Mutation | Status |
|---------------|------------------------|--------|
| `GET /api/v1/Cognitive Lab/:Cognitive Lab` | `query { Cognitive Lab(Cognitive Lab: "...") }` | ✅ Direct replacement |
| `GET /api/v1/Cognitive Lab` | `query { Cognitive Labs(...) }` | ✅ Enhanced filtering |
| `POST /api/v1/Cognitive Lab` | `mutation { createLABS(...) }` | ✅ Direct replacement |
| `PUT /api/v1/Cognitive Lab/:Cognitive Lab` | `mutation { updateLABS(...) }` | ✅ Direct replacement |
| `DELETE /api/v1/Cognitive Lab/:Cognitive Lab` | `mutation { deactivateLABS(...) }` | ✅ Direct replacement |

### Credential Operations

| REST Endpoint | GraphQL Query/Mutation | Status |
|---------------|------------------------|--------|
| `GET /api/v1/credentials/:id` | `query { credential(id: "...") }` | ✅ Direct replacement |
| `GET /api/v1/credentials` | `query { credentials(...) }` | ✅ Enhanced filtering |
| `POST /api/v1/credentials` | `mutation { issueCredential(...) }` | ✅ Direct replacement |
| `DELETE /api/v1/credentials/:id` | `mutation { revokeCredential(...) }` | ✅ Direct replacement |

### Stellar Operations

| REST Endpoint | GraphQL Query/Mutation | Status |
|---------------|------------------------|--------|
| `GET /api/v1/stellar/account/:address` | `query { stellarAccount(address: "...") }` | ✅ Direct replacement |
| `GET /api/v1/stellar/transactions` | `query { transactions(...) }` | ✅ Enhanced filtering |
| `POST /api/v1/stellar/transaction` | `mutation { createTransaction(...) }` | ✅ Direct replacement |

## Code Examples

### Before: REST API

```javascript
// Fetch Cognitive Lab with REST
async function getLABS(Cognitive Lab) {
  try {
    const response = await fetch(`/api/v1/Cognitive Lab/${Cognitive Lab}`);
    const data = await response.json();
    
    if (!response.ok) {
      throw new Error(data.message);
    }
    
    return data;
  } catch (error) {
    console.error('Error fetching Cognitive Lab:', error);
    throw error;
  }
}

// Fetch multiple Cognitive Labs
async function listLABSs(owner, active) {
  try {
    const params = new URLSearchParams();
    if (owner) params.append('owner', owner);
    if (active !== undefined) params.append('active', active);
    
    const response = await fetch(`/api/v1/Cognitive Lab?${params}`);
    const data = await response.json();
    
    return data.Cognitive Labs || [];
  } catch (error) {
    console.error('Error listing Cognitive Labs:', error);
    throw error;
  }
}

// Create Cognitive Lab
async function createLABS(LABSData) {
  try {
    const response = await fetch('/api/v1/Cognitive Lab', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify(LABSData)
    });
    
    const data = await response.json();
    
    if (!response.ok) {
      throw new Error(data.message);
    }
    
    return data;
  } catch (error) {
    console.error('Error creating Cognitive Lab:', error);
    throw error;
  }
}
```

### After: GraphQL API

```javascript
// GraphQL client setup
import { ApolloClient, InMemoryCache, gql } from '@apollo/client';

const client = new ApolloClient({
  uri: 'http://localhost:3001/graphql',
  cache: new InMemoryCache(),
  headers: {
    Authorization: `Bearer ${token}`
  }
});

// Fetch Cognitive Lab with GraphQL
const GET_LABS = gql`
  query GetLABS($Cognitive Lab: String!) {
    Cognitive Lab(Cognitive Lab: $Cognitive Lab) {
      id
      Cognitive Lab
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

async function getLABS(Cognitive Lab) {
  try {
    const { data, errors } = await client.query({
      query: GET_LABS,
      variables: { Cognitive Lab },
      errorPolicy: 'all'
    });
    
    if (errors && errors.length > 0) {
      throw new Error(errors[0].message);
    }
    
    return data.Cognitive Lab;
  } catch (error) {
    console.error('Error fetching Cognitive Lab:', error);
    throw error;
  }
}

// Fetch multiple Cognitive Labs with enhanced filtering
const LIST_LABSS = gql`
  query ListLABSs($owner: String, $active: Boolean, $limit: Int, $offset: Int) {
    Cognitive Labs(owner: $owner, active: $active, limit: $limit, offset: $offset) {
      id
      Cognitive Lab
      owner
      created
      active
      serviceEndpoint
    }
    LABSCount(active: $active)
  }
`;

async function listLABSs(owner, active, limit = 10, offset = 0) {
  try {
    const { data, errors } = await client.query({
      query: LIST_LABSS,
      variables: { owner, active, limit, offset },
      errorPolicy: 'all'
    });
    
    if (errors && errors.length > 0) {
      throw new Error(errors[0].message);
    }
    
    return {
      Cognitive Labs: data.Cognitive Labs,
      total: data.LABSCount
    };
  } catch (error) {
    console.error('Error listing Cognitive Labs:', error);
    throw error;
  }
}

// Create Cognitive Lab with GraphQL
const CREATE_LABS = gql`
  mutation CreateLABS($input: CreateLABSInput!) {
    createLABS(
      Cognitive Lab: $input.Cognitive Lab
      publicKey: $input.publicKey
      serviceEndpoint: $input.serviceEndpoint
      verificationMethods: $input.verificationMethods
      services: $input.services
    ) {
      id
      Cognitive Lab
      owner
      publicKey
      created
      active
    }
  }
`;

async function createLABS(LABSData) {
  try {
    const { data, errors } = await client.mutate({
      mutation: CREATE_LABS,
      variables: { input: LABSData },
      errorPolicy: 'all'
    });
    
    if (errors && errors.length > 0) {
      throw new Error(errors[0].message);
    }
    
    return data.createLABS;
  } catch (error) {
    console.error('Error creating Cognitive Lab:', error);
    throw error;
  }
}
```

## Advanced Features

### Real-time Subscriptions

```javascript
// Subscribe to Cognitive Lab creation events
const LABS_CREATED_SUBSCRIPTION = gql`
  subscription LABSCreated($owner: String) {
    LABSCreated(owner: $owner) {
      id
      Cognitive Lab
      owner
      created
      active
    }
  }
`;

function subscribeToLABSCreated(owner, callback) {
  const subscription = client.subscribe({
    query: LABS_CREATED_SUBSCRIPTION,
    variables: { owner }
  }).subscribe({
    next: ({ data }) => callback(data.LABSCreated),
    error: (error) => console.error('Subscription error:', error)
  });
  
  return subscription;
}

// Usage
const subscription = subscribeToLABSCreated('owner-address', (Cognitive Lab) => {
  console.log('New Cognitive Lab created:', Cognitive Lab);
});

// Unsubscribe when done
subscription.unsubscribe();
```

### Batch Operations

```javascript
// Batch revoke credentials
const BATCH_REVOKE = gql`
  mutation BatchRevokeCredentials($ids: [ID!]!) {
    batchRevokeCredentials(ids: $ids) {
      successful
      failed
      errors
    }
  }
`;

async function batchRevokeCredentials(ids) {
  try {
    const { data, errors } = await client.mutate({
      mutation: BATCH_REVOKE,
      variables: { ids },
      errorPolicy: 'all'
    });
    
    if (errors && errors.length > 0) {
      throw new Error(errors[0].message);
    }
    
    return data.batchRevokeCredentials;
  } catch (error) {
    console.error('Error batch revoking credentials:', error);
    throw error;
  }
}
```

### Optimized Queries

```javascript
// Request only needed fields
const MINIMAL_LABS = gql`
  query GetMinimalLABS($Cognitive Lab: String!) {
    Cognitive Lab(Cognitive Lab: $Cognitive Lab) {
      id
      Cognitive Lab
      active
    }
  }
`;

// Complex query with relationships
const LABS_WITH_CREDENTIALS = gql`
  query GetLABSWithCredentials($Cognitive Lab: String!) {
    Cognitive Lab(Cognitive Lab: $Cognitive Lab) {
      id
      Cognitive Lab
      owner
      active
      verificationMethods {
        id
        type
        publicKeyBase58
      }
    }
    credentials(subject: $Cognitive Lab, revoked: false) {
      id
      issuer
      credentialType
      issued
      expires
    }
  }
`;
```

## Error Handling

### REST Error Handling
```javascript
try {
  const response = await fetch('/api/v1/Cognitive Lab/invalid-Cognitive Lab');
  const data = await response.json();
  
  if (!response.ok) {
    throw new Error(data.message || 'Request failed');
  }
  
  return data;
} catch (error) {
  console.error('REST Error:', error);
  throw error;
}
```

### GraphQL Error Handling
```javascript
try {
  const { data, errors } = await client.query({
    query: GET_LABS,
    variables: { Cognitive Lab: 'invalid-Cognitive Lab' },
    errorPolicy: 'all'
  });
  
  if (errors && errors.length > 0) {
    const error = errors[0];
    throw new Error(error.message);
  }
  
  if (!data.Cognitive Lab) {
    throw new Error('Cognitive Lab not found');
  }
  
  return data.Cognitive Lab;
} catch (error) {
  console.error('GraphQL Error:', error);
  throw error;
}
```

## Performance Optimization

### Caching Strategy
```javascript
// Configure Apollo Client cache
const client = new ApolloClient({
  uri: 'http://localhost:3001/graphql',
  cache: new InMemoryCache({
    typePolicies: {
      Query: {
        fields: {
          Cognitive Lab: {
            merge: true,
            cache: true
          },
          Cognitive Labs: {
            merge: false,
            cache: true
          }
        }
      },
      LABSDocument: {
        keyFields: ["id"],
        fields: {
          verificationMethods: {
            merge: false
          },
          services: {
            merge: false
          }
        }
      }
    }
  })
});
```

### Query Optimization
```javascript
// Use field selection to reduce payload
const OPTIMIZED_QUERY = gql`
  query GetLABSList($limit: Int) {
    Cognitive Labs(limit: $limit) {
      id  # Only request ID field
      Cognitive Lab
      active
    }
  }
`;

// Use pagination for large datasets
const PAGINATED_QUERY = gql`
  query GetLABSList($limit: Int, $offset: Int) {
    Cognitive Labs(limit: $limit, offset: $offset) {
      id
      Cognitive Lab
      owner
      created
    }
    LABSCount
  }
`;
```

## Testing Migration

### Unit Tests
```javascript
// Test GraphQL queries
import { ApolloClient, InMemoryCache } from '@apollo/client';

describe('Cognitive Lab GraphQL Operations', () => {
  let client;
  
  beforeEach(() => {
    client = new ApolloClient({
      uri: 'http://localhost:3001/graphql',
      cache: new InMemoryCache()
    });
  });
  
  it('should fetch Cognitive Lab', async () => {
    const { data } = await client.query({
      query: GET_LABS,
      variables: { Cognitive Lab: 'test-Cognitive Lab' }
    });
    
    expect(data.Cognitive Lab).toBeDefined();
    expect(data.Cognitive Lab.id).toBe('test-Cognitive Lab');
  });
});
```

### Integration Tests
```javascript
// Test migration compatibility
describe('REST to GraphQL Migration', () => {
  it('should return same data for Cognitive Lab operations', async () => {
    // Fetch with REST
    const restResponse = await fetch('/api/v1/Cognitive Lab/test-Cognitive Lab');
    const restData = await restResponse.json();
    
    // Fetch with GraphQL
    const { data: graphqlData } = await client.query({
      query: GET_LABS,
      variables: { Cognitive Lab: 'test-Cognitive Lab' }
    });
    
    // Compare results
    expect(restData.id).toBe(graphqlData.Cognitive Lab.id);
    expect(restData.Cognitive Lab).toBe(graphqlData.Cognitive Lab.Cognitive Lab);
  });
});
```

## Checklist

### Before Migration
- [ ] Review existing REST API usage
- [ ] Identify critical endpoints
- [ ] Set up GraphQL client
- [ ] Create migration plan
- [ ] Prepare test suite

### During Migration
- [ ] Implement GraphQL queries for read operations
- [ ] Add GraphQL mutations for write operations
- [ ] Test data consistency
- [ ] Update error handling
- [ ] Monitor performance

### After Migration
- [ ] Remove REST API dependencies
- [ ] Optimize GraphQL queries
- [ ] Implement subscriptions
- [ ] Update documentation
- [ ] Train team on GraphQL

## Troubleshooting

### Common Issues

#### Query Complexity Errors
```
Error: Query complexity limit exceeded
```
**Solution**: Break down large queries or request fewer fields.

#### Authentication Issues
```
Error: Authentication required
```
**Solution**: Ensure JWT token is included in Authorization header.

#### Subscription Connection Issues
```
Error: WebSocket connection failed
```
**Solution**: Check WebSocket configuration and network connectivity.

#### Cache Inconsistency
**Issue**: Stale data in cache
**Solution**: Implement cache invalidation strategies or use cache policies.

### Performance Issues

#### Slow Queries
- Use field selection to reduce payload
- Implement pagination
- Add appropriate caching
- Monitor query complexity

#### Memory Issues
- Clear cache periodically
- Use cache policies wisely
- Monitor memory usage

## Support

For migration assistance:
1. Review the GraphQL schema documentation
2. Use the GraphQL Playground for testing
3. Check the error messages for detailed information
4. Contact the development team with specific issues

## Timeline

### Week 1-2: Preparation
- Set up GraphQL client
- Create basic queries
- Test simple operations

### Week 3-4: Core Migration
- Migrate read operations
- Implement mutations
- Update error handling

### Week 5-6: Advanced Features
- Add subscriptions
- Optimize performance
- Implement caching

### Week 7-8: Finalization
- Remove REST dependencies
- Update documentation
- Team training

This migration guide provides a comprehensive approach to transitioning from REST to GraphQL while maintaining application stability and performance.
