# Improved Error Handling System

This document describes the comprehensive error handling system implemented to provide users with clear, actionable guidance instead of technical error messages.

## Overview

The error handling system transforms technical error messages into user-friendly explanations with actionable steps to resolve issues. It consists of:

1. **Backend Error Message System** - Translates technical errors into user-friendly responses
2. **Frontend Error Handler** - Maps API errors to user-friendly messages and suggestions
3. **Error Display Component** - Provides an intuitive UI for displaying errors with expandable suggestions

## Backend Implementation

### Error Message Mapping (`/backend/src/utils/errorMessages.js`)

The backend includes a comprehensive mapping of technical errors to user-friendly messages:

```javascript
// Example error mapping
'ValidationError': {
  userMessage: 'Please check your input and try again.',
  getAction: (error) => {
    if (error.details && error.details[0]) {
      const field = error.details[0].path?.[0] || 'input';
      if (issue.includes('required')) {
        return `The ${field} field is required. Please provide a valid value.`;
      }
    }
    return 'Please review all fields and ensure they meet the requirements.';
  }
}
```

### Custom Error Classes

The backend uses custom error classes for better error categorization:

- `ContractAddressNotSetError` - Smart contract not deployed
- `ContractDeploymentFailedError` - Contract deployment issues
- `LABSRegistrationFailedError` - Cognitive Lab registration problems
- `LABSUpdateFailedError` - Cognitive Lab update failures
- `CredentialIssuanceFailedError` - Credential issuance issues
- `TransactionFailedError` - Stellar transaction failures
- `AccountNotFoundError` - Account doesn't exist

### Updated Error Handler

The global error handler now uses `formatErrorResponse()` to create user-friendly API responses:

```javascript
const errorResponse = formatErrorResponse(err, req);
res.status(err.status || statusCode).json(errorResponse);
```

## Frontend Implementation

### Error Handler Utility (`/frontend/src/utils/errorHandler.js`)

The frontend error handler maps API errors to user-friendly information:

```javascript
const errorInfo = handleApiError(error);
// Returns: { title, message, suggestions, technicalDetails }
```

### Error Display Component (`/frontend/src/components/ErrorDisplay.js`)

A reusable component that displays errors with:

- Clear error title and message
- Expandable suggestions with actionable steps
- Technical details in development mode
- Dismissible interface

### Updated Components

All frontend components have been updated to use the new error handling:

1. **CreateLABS.js** - Cognitive Lab creation errors
2. **Contracts.js** - Contract deployment errors  
3. **Credentials.js** - Credential issuance/verification errors
4. **ResolveLABS.js** - Cognitive Lab resolution errors
5. **Account.js** - Account information errors
6. **useWallet.js** - Wallet connection errors

## Error Categories and Messages

### Validation Errors
- **Technical**: `ValidationError`, Joi validation failures
- **User Message**: "Please check your input and try again."
- **Suggestions**: Field-specific guidance based on validation rules

### Contract Errors
- **Technical**: `ContractAddressNotSet`, `ContractDeploymentFailed`
- **User Message**: "Smart contract is not deployed yet."
- **Suggestions**: Deploy contract first, check account balance, verify secret key

### Cognitive Lab Errors
- **Technical**: `LABSRegistrationFailed`, `LABSUpdateFailed`
- **User Message**: "Failed to register/update your Cognitive Lab."
- **Suggestions**: Check ownership, verify format, ensure funds

### Transaction Errors
- **Technical**: `TransactionFailed`, Stellar SDK errors
- **User Message**: "The Stellar transaction failed."
- **Suggestions**: Check balance, wait and retry, verify network status

### Network Errors
- **Technical**: Network failures, timeouts, CORS
- **User Message**: "Network connection problem."
- **Suggestions**: Check internet, refresh page, wait and retry

## Usage Examples

### Backend - Throwing Custom Errors

```javascript
// Instead of: throw new Error('Contract deployment failed: ' + error.message);
throw new ContractDeploymentFailedError(error.message);
```

### Frontend - Handling API Errors

```javascript
try {
  const response = await stellarAPI.post('/contracts/register-Cognitive Lab', data);
  // Handle success
} catch (err) {
  const errorInfo = handleApiError(err);
  setError(errorInfo);
  toast.error(errorInfo.message);
}
```

### Frontend - Displaying Errors

```jsx
{error && (
  <ErrorDisplay 
    error={error} 
    onClose={() => setError(null)} 
  />
)}
```

## Benefits

1. **User-Friendly Messages**: Technical errors are translated into plain language
2. **Actionable Guidance**: Users get specific steps to resolve their issues
3. **Consistent Experience**: All errors follow the same format and style
4. **Development Support**: Technical details are still available in development
5. **Reduced Support Load**: Users can self-resolve common issues

## Error Response Format

### API Error Response

```json
{
  "success": false,
  "error": {
    "code": "ValidationError",
    "userMessage": "Please check your input and try again.",
    "action": "The Cognitive Lab field is required. Please provide a valid value.",
    "path": "/api/v1/contracts/register-Cognitive Lab",
    "timestamp": "2024-01-01T12:00:00.000Z",
    "technicalError": "ValidationError: \"Cognitive Lab\" is required",
    "stack": "Error: ValidationError..."
  }
}
```

### Frontend Error Info

```javascript
{
  title: "Invalid Input",
  message: "The Cognitive Lab field is required. Please provide a valid value.",
  suggestions: [
    "Review all required fields",
    "Check that all formats are correct",
    "Make sure URLs include http:// or https://"
  ],
  technicalDetails: {
    code: "ValidationError",
    originalMessage: "ValidationError: \"Cognitive Lab\" is required"
  }
}
```

## Testing

To test the error handling system:

1. **Backend Tests**: Use the custom error classes in unit tests
2. **Frontend Tests**: Mock API responses with error formats
3. **Integration Tests**: Verify end-to-end error flow from API to UI

## Future Enhancements

1. **Internationalization**: Support for multiple languages
2. **Error Analytics**: Track common errors for improvement
3. **Smart Suggestions**: AI-powered suggestions based on context
4. **Error Recovery**: Automatic retry mechanisms for transient errors

## Migration Guide

### For Backend Developers

1. Import custom error classes from `contractService.js`
2. Replace generic `Error` throws with specific error classes
3. Ensure error messages include relevant context

### For Frontend Developers

1. Import `handleApiError` and `ErrorDisplay` utilities
2. Replace direct error message assignment with `handleApiError()`
3. Use `ErrorDisplay` component instead of basic `Alert`

This error handling system significantly improves the user experience by providing clear, actionable guidance instead of confusing technical error messages.
