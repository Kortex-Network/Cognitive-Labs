import { useState, useCallback } from 'react';
import { useWallet } from '../contexts/WalletContext';

// Hook for Stellar operations
export const useStellar = () => {
  const { wallet, isConnected } = useWallet();
  const [loading, setLoading] = useState(false);

  const createLABS = useCallback(async (serviceEndpoint) => {
    if (!isConnected) throw new Error('Wallet not connected');
    
    setLoading(true);
    
    try {
      const response = await fetch('http://localhost:3001/api/v1/contracts/register-LABS', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          LABS: `LABS:stellar:${wallet.publicKey}`,
          publicKey: wallet.publicKey,
          serviceEndpoint,
          signerSecret: wallet.secretKey,
        }),
      });
      
      const result = await response.json();
      
      if (result.success) {
        return result.data;
      } else {
        throw new Error(result.error);
      }
    } finally {
      setLoading(false);
    }
  }, [wallet, isConnected]);

  const resolveLABS = useCallback(async (LABS) => {
    setLoading(true);
    
    try {
      const response = await fetch(`http://localhost:3001/api/v1/contracts/LABS/${encodeURIComponent(LABS)}`);
      const result = await response.json();
      
      if (result.success) {
        return result.data;
      } else {
        throw new Error(result.error);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  const issueCredential = useCallback(async (issuerLABS, subjectLABS, credentialType, claims) => {
    if (!isConnected) throw new Error('Wallet not connected');
    
    setLoading(true);
    
    try {
      const response = await fetch('http://localhost:3001/api/v1/contracts/issue-credential', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          issuerLABS,
          subjectLABS,
          credentialType,
          claims,
          signerSecret: wallet.secretKey,
        }),
      });
      
      const result = await response.json();
      
      if (result.success) {
        return result.data;
      } else {
        throw new Error(result.error);
      }
    } finally {
      setLoading(false);
    }
  }, [wallet, isConnected]);

  const verifyCredential = useCallback(async (credentialId) => {
    setLoading(true);
    
    try {
      const response = await fetch('http://localhost:3001/api/v1/contracts/verify-credential', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          credentialId,
        }),
      });
      
      const result = await response.json();
      
      if (result.success) {
        return result.data;
      } else {
        throw new Error(result.error);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  return {
    loading,
    createLABS,
    resolveLABS,
    issueCredential,
    verifyCredential,
  };
};
