/**
 * Frontend Error Handler
 * Translates API errors into user-friendly messages and actionable guidance
 */

const errorMappings = {
  // Backend error mappings
  'ValidationError': {
    title: 'Invalid Input',
    getMessage: (error) => {
      if (error.action) {
        return error.action;
      }
      return 'Please check your input and try again.';
    },
    getSuggestions: (error) => [
      'Review all required fields',
      'Check that all formats are correct',
      'Make sure URLs include http:// or https://'
    ]
  },

  'ContractAddressNotSet': {
    title: 'Contract Not Deployed',
    getMessage: (error) => error.action || 'The smart contract needs to be deployed first.',
    getSuggestions: () => [
      'Go to the Contracts page',
      'Click "Deploy Contract" to initialize the system',
      'Wait for deployment to complete before proceeding'
    ]
  },

  'ContractDeploymentFailed': {
    title: 'Contract Deployment Failed',
    getMessage: (error) => error.action || 'Failed to deploy the smart contract.',
    getSuggestions: (error) => [
      'Check your Stellar account has sufficient lumens',
      'Verify your secret key is correct',
      'Try again in a few minutes if the network is busy',
      'Contact support if the problem persists'
    ]
  },

  'LABSRegistrationFailed': {
    title: 'LABS Registration Failed',
    getMessage: (error) => error.action || 'Unable to register your LABS.',
    getSuggestions: () => [
      'Ensure your Stellar account has funds',
      'Verify you own the private key for this LABS',
      'Check that the LABS format is correct',
      'Try creating a new account if needed'
    ]
  },

  'LABSUpdateFailed': {
    title: 'LABS Update Failed',
    getMessage: (error) => error.action || 'Unable to update your LABS document.',
    getSuggestions: () => [
      'Make sure you own this LABS',
      'Check your secret key is correct',
      'Ensure your account has sufficient funds',
      'Verify the LABS is already registered'
    ]
  },

  'CredentialIssuanceFailed': {
    title: 'Credential Issuance Failed',
    getMessage: (error) => error.action || 'Unable to issue the verifiable credential.',
    getSuggestions: () => [
      'Verify both issuer and subject LABSs are valid',
      'Check that both LABSs are registered',
      'Ensure your account has sufficient funds',
      'Review credential data for any issues'
    ]
  },

  'TransactionFailed': {
    title: 'Transaction Failed',
    getMessage: (error) => error.action || 'The Stellar transaction failed.',
    getSuggestions: () => [
      'Check your account balance',
      'Wait a few minutes and try again',
      'Verify your secret key is correct',
      'Check network status at stellar.expert/explorer'
    ]
  },

  'AccountNotFound': {
    title: 'Account Not Found',
    getMessage: (error) => error.action || 'This Stellar account does not exist.',
    getSuggestions: () => [
      'Create a new account using the "Create Account" button',
      'Fund your account with testnet lumens',
      'Wait for the account to be created before proceeding'
    ]
  },

  'NetworkError': {
    title: 'Connection Problem',
    getMessage: (error) => error.action || 'Network connection issue.',
    getSuggestions: () => [
      'Check your internet connection',
      'Try refreshing the page',
      'Wait a few minutes and try again',
      'Check if Stellar network is experiencing issues'
    ]
  },

  'RateLimitExceeded': {
    title: 'Too Many Requests',
    getMessage: (error) => error.action || 'You have made too many requests.',
    getSuggestions: () => [
      'Wait a few minutes before trying again',
      'Avoid clicking buttons multiple times quickly',
      'Consider using batch operations if available'
    ]
  },

  'TimeoutError': {
    title: 'Request Timed Out',
    getMessage: (error) => error.action || 'The operation took too long to complete.',
    getSuggestions: () => [
      'Try again with a better internet connection',
      'The network might be busy, wait and retry',
      'Break down large operations if possible'
    ]
  },

  'InternalServerError': {
    title: 'Server Error',
    getMessage: (error) => error.action || 'Something went wrong on our end.',
    getSuggestions: () => [
      'Try again in a few minutes',
      'Refresh the page and retry',
      'Contact support if the problem persists'
    ]
  }
};

/**
 * Get user-friendly error information
 * @param {Object} apiError - Error from API response
 * @returns {Object} - User-friendly error info
 */
function getUserFriendlyError(apiError) {
  const errorCode = apiError?.error?.code || 'UnknownError';
  const errorMessage = apiError?.error?.userMessage || apiError?.message || 'An unexpected error occurred';
  const errorAction = apiError?.error?.action || '';
  
  // Try to find exact match
  if (errorMappings[errorCode]) {
    const mapping = errorMappings[errorCode];
    return {
      title: mapping.title,
      message: mapping.getMessage(apiError),
      suggestions: mapping.getSuggestions(apiError),
      technicalDetails: process.env.NODE_ENV === 'development' ? {
        code: errorCode,
        originalMessage: apiError?.error?.technicalError || errorMessage,
        stack: apiError?.error?.stack
      } : null
    };
  }
  
  // Try to match by error content
  for (const [key, mapping] of Object.entries(errorMappings)) {
    if (errorMessage.toLowerCase().includes(key.toLowerCase())) {
      return {
        title: mapping.title,
        message: mapping.getMessage(apiError),
        suggestions: mapping.getSuggestions(apiError),
        technicalDetails: process.env.NODE_ENV === 'development' ? {
          code: errorCode,
          originalMessage: errorMessage
        } : null
      };
    }
  }
  
  // Common pattern matching
  if (errorMessage.includes('validation') || errorMessage.includes('schema')) {
    return {
      title: 'Invalid Input',
      message: 'Please check your input and try again.',
      suggestions: [
        'Review all required fields',
        'Check that all formats are correct',
        'Make sure URLs include http:// or https://'
      ]
    };
  }
  
  if (errorMessage.includes('network') || errorMessage.includes('connection')) {
    return {
      title: 'Connection Problem',
      message: 'Network connection issue. Please check your internet connection.',
      suggestions: [
        'Check your internet connection',
        'Try refreshing the page',
        'Wait a few minutes and try again'
      ]
    };
  }
  
  if (errorMessage.includes('timeout')) {
    return {
      title: 'Request Timed Out',
      message: 'The operation took too long to complete.',
      suggestions: [
        'Try again with a better internet connection',
        'The network might be busy, wait and retry'
      ]
    };
  }
  
  // Default fallback
  return {
    title: 'Unexpected Error',
    message: errorMessage || 'An unexpected error occurred.',
    suggestions: [
      'Try again in a few minutes',
      'Refresh the page and retry',
      'Contact support if the problem persists'
    ],
    technicalDetails: process.env.NODE_ENV === 'development' ? {
      code: errorCode,
      originalMessage: errorMessage
    } : null
  };
}

/**
 * Handle API errors and return user-friendly information
 * @param {Error} error - Error object from API call
 * @returns {Object} - User-friendly error information
 */
function handleApiError(error) {
  // If it's already a formatted API error
  if (error.response?.data?.error) {
    return getUserFriendlyError(error.response.data);
  }
  
  // Handle network errors
  if (error.code === 'NETWORK_ERROR' || error.message.includes('Network Error')) {
    return {
      title: 'Connection Problem',
      message: 'Unable to connect to the server. Please check your internet connection.',
      suggestions: [
        'Check your internet connection',
        'Try refreshing the page',
        'Wait a few minutes and try again'
      ]
    };
  }
  
  // Handle timeout errors
  if (error.code === 'ECONNABORTED' || error.message.includes('timeout')) {
    return {
      title: 'Request Timed Out',
      message: 'The request took too long to complete.',
      suggestions: [
        'Try again with a better internet connection',
        'The network might be busy, wait and retry'
      ]
    };
  }
  
  // Handle CORS errors
  if (error.message.includes('CORS')) {
    return {
      title: 'Configuration Error',
      message: 'There\'s a problem with the server configuration.',
      suggestions: [
        'Contact the development team',
        'Try using a different browser',
        'Check if you\'re using the correct URL'
      ]
    };
  }
  
  // Default error handling
  return {
    title: 'Unexpected Error',
    message: error.message || 'An unexpected error occurred.',
    suggestions: [
      'Try again in a few minutes',
      'Refresh the page and retry',
      'Contact support if the problem persists'
    ],
    technicalDetails: process.env.NODE_ENV === 'development' ? {
      originalError: error.message,
      stack: error.stack
    } : null
  };
}

/**
 * Show error toast with user-friendly message
 * @param {Error} error - Error object
 * @param {Function} toast - Toast function from react-toastify
 */
function showErrorToast(error, toast) {
  const errorInfo = handleApiError(error);
  
  toast.error(errorInfo.message, {
    position: 'top-right',
    autoClose: 5000,
    hideProgressBar: false,
    closeOnClick: true,
    pauseOnHover: true,
    draggable: true,
  });
  
  return errorInfo;
}

export {
  errorMappings,
  getUserFriendlyError,
  handleApiError,
  showErrorToast
};
