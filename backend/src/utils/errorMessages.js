/**
 * User-friendly error message mappings
 * Translates technical errors into actionable guidance for users
 */

const errorMappings = {
  // Validation Errors
  'ValidationError': {
    userMessage: 'Please check your input and try again.',
    getAction: (error) => {
      if (error.details && error.details[0]) {
        const field = error.details[0].path?.[0] || 'input';
        const issue = error.details[0].message;
        
        if (issue.includes('required')) {
          return `The ${field} field is required. Please provide a valid value.`;
        }
        if (issue.includes('pattern')) {
          if (field === 'LABS') {
            return 'LABS format is incorrect. It should look like: LABS:stellar:G[56 characters]';
          }
          if (field === 'publicKey' || field === 'signerSecret') {
            return 'Stellar keys must be exactly 56 characters starting with "G" (public) or "S" (secret).';
          }
          return `The ${field} format is invalid. Please check the requirements.`;
        }
        if (issue.includes('min') || issue.includes('max')) {
          return `The ${field} length is incorrect. Please check the required length.`;
        }
        if (issue.includes('url')) {
          return 'Please provide a valid URL including http:// or https://';
        }
      }
      return 'Please review all fields and ensure they meet the requirements.';
    }
  },

  // Contract Errors
  'ContractAddressNotSet': {
    userMessage: 'Smart contract is not deployed yet.',
    action: 'Please deploy the LABS registry contract first from the Contracts page.'
  },

  'ContractDeploymentFailed': {
    userMessage: 'Failed to deploy the smart contract.',
    getAction: (error) => {
      if (error.message.includes('insufficient')) {
        return 'Your account has insufficient funds. Please fund your Stellar account and try again.';
      }
      if (error.message.includes('network')) {
        return 'Network connection issue. Please check your internet connection and try again.';
      }
      if (error.message.includes('timeout')) {
        return 'The transaction timed out. The network might be busy. Please try again in a few minutes.';
      }
      return 'Check your account balance and network connection, then try deploying again.';
    }
  },

  'LABSRegistrationFailed': {
    userMessage: 'Failed to register your LABS.',
    getAction: (error) => {
      if (error.message.includes('already exists')) {
        return 'This LABS is already registered. Try creating a new account or using a different LABS.';
      }
      if (error.message.includes('insufficient')) {
        return 'Insufficient funds for registration. Please fund your account and try again.';
      }
      if (error.message.includes('unauthorized')) {
        return 'You are not authorized to register this LABS. Check your secret key.';
      }
      return 'Verify your account has funds and you own the private key for this LABS.';
    }
  },

  'LABSUpdateFailed': {
    userMessage: 'Failed to update your LABS document.',
    getAction: (error) => {
      if (error.message.includes('not found')) {
        return 'LABS not found. Please register the LABS first before updating.';
      }
      if (error.message.includes('unauthorized')) {
        return 'You can only update LABSs you own. Check your secret key.';
      }
      return 'Ensure you own this LABS and your account has sufficient funds.';
    }
  },

  'CredentialIssuanceFailed': {
    userMessage: 'Failed to issue the verifiable credential.',
    getAction: (error) => {
      if (error.message.includes('invalid issuer')) {
        return 'The issuer LABS is invalid or not registered. Please check the issuer LABS.';
      }
      if (error.message.includes('invalid subject')) {
        return 'The subject LABS is invalid or not registered. Please check the subject LABS.';
      }
      if (error.message.includes('insufficient')) {
        return 'Insufficient funds for credential issuance. Please fund your account.';
      }
      return 'Verify both issuer and subject LABSs are valid and your account has funds.';
    }
  },

  // Stellar Network Errors
  'NetworkError': {
    userMessage: 'Network connection problem.',
    action: 'Check your internet connection and try again. If the problem persists, the Stellar network might be experiencing issues.'
  },

  'TransactionFailed': {
    userMessage: 'Transaction failed on the Stellar network.',
    getAction: (error) => {
      if (error.message.includes('insufficient')) {
        return 'Insufficient balance. Please add more lumens to your account.';
      }
      if (error.message.includes('timeout')) {
        return 'Transaction timed out. The network might be busy. Please try again.';
      }
      if (error.message.includes('bad_sequence')) {
        return 'Transaction sequence issue. Please refresh your account and try again.';
      }
      return 'Check your account balance and try again. If the issue persists, contact support.';
    }
  },

  // Account Errors
  'AccountNotFound': {
    userMessage: 'Stellar account not found.',
    action: 'This account needs to be created and funded. Use the "Create Account" button to get started.'
  },

  'InvalidSecretKey': {
    userMessage: 'Invalid secret key provided.',
    action: 'Please check your secret key. It should be 56 characters starting with "S".'
  },

  'InvalidPublicKey': {
    userMessage: 'Invalid public key provided.',
    action: 'Please check the public key. It should be 56 characters starting with "G".'
  },

  // Generic Errors
  'InternalServerError': {
    userMessage: 'Something went wrong on our end.',
    action: 'Please try again in a few minutes. If the problem persists, contact our support team.'
  },

  'RateLimitExceeded': {
    userMessage: 'Too many requests.',
    action: 'Please wait a few minutes before making another request.'
  },

  'TimeoutError': {
    userMessage: 'Request timed out.',
    action: 'The operation took too long. Please try again. If it continues to fail, the network might be busy.'
  }
};

/**
 * Get user-friendly error message and action
 * @param {Error} error - The original error object
 * @returns {Object} - { userMessage, action }
 */
function getUserFriendlyError(error) {
  const errorName = error.name || 'UnknownError';
  const errorMessage = error.message || '';
  
  // Try to find exact match first
  if (errorMappings[errorName]) {
    const mapping = errorMappings[errorName];
    return {
      userMessage: mapping.userMessage,
      action: mapping.getAction ? mapping.getAction(error) : mapping.action
    };
  }
  
  // Try to match by error message content
  for (const [key, mapping] of Object.entries(errorMappings)) {
    if (errorMessage.toLowerCase().includes(key.toLowerCase())) {
      return {
        userMessage: mapping.userMessage,
        action: mapping.getAction ? mapping.getAction(error) : mapping.action
      };
    }
  }
  
  // Common pattern matching
  if (errorMessage.includes('validation') || errorMessage.includes('schema')) {
    return {
      userMessage: 'Please check your input.',
      action: 'Review all fields to ensure they meet the requirements shown in the form.'
    };
  }
  
  if (errorMessage.includes('network') || errorMessage.includes('connection')) {
    return {
      userMessage: 'Network connection issue.',
      action: 'Check your internet connection and try again.'
    };
  }
  
  if (errorMessage.includes('timeout')) {
    return {
      userMessage: 'Operation timed out.',
      action: 'The operation took too long. Please try again.'
    };
  }
  
  if (errorMessage.includes('insufficient') || errorMessage.includes('balance')) {
    return {
      userMessage: 'Insufficient funds.',
      action: 'Please add more lumens to your Stellar account.'
    };
  }
  
  // Default fallback
  return {
    userMessage: 'An unexpected error occurred.',
    action: 'Please try again. If the problem persists, contact our support team with the error details.'
  };
}

/**
 * Format error for API response
 * @param {Error} error - The original error
 * @param {Object} req - Express request object
 * @returns {Object} - Formatted error response
 */
function formatErrorResponse(error, req) {
  const { userMessage, action } = getUserFriendlyError(error);
  
  return {
    success: false,
    error: {
      code: error.name || 'UNKNOWN_ERROR',
      userMessage,
      action,
      path: req.originalUrl,
      timestamp: new Date().toISOString(),
      // Include technical details only in development
      ...(process.env.NODE_ENV === 'development' && {
        technicalError: error.message,
        stack: error.stack
      })
    }
  };
}

module.exports = {
  errorMappings,
  getUserFriendlyError,
  formatErrorResponse
};
