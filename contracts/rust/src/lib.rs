#![no_std]
use soroban_sdk::{
    contract, contracterror, contractimpl, contracttype, Address, Bytes, Env, String, Vec,
    Symbol,
};

// Contract errors
#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq, PartialOrd, Ord)]
#[repr(u32)]
pub enum Error {
    Unauthorized = 1,
    LABSNotFound = 2,
    CredentialNotFound = 3,
    AlreadyRevoked = 4,
    InvalidInput = 5,
    InsufficientBalance = 6,
    ContractPaused = 7,
    CredentialExpired = 8,
}

// Data keys for storage
#[contracttype]
pub enum DataKey {
    LABS(Bytes),
    LABSOwner(Bytes),
    LABSCreated(Bytes),
    LABSUpdated(Bytes),
    Credential(Bytes),
    CredentialIssuer(Bytes),
    CredentialSubject(Bytes),
    CredentialIssued(Bytes),
    CredentialRevoked(Bytes),
    ContractInfo,
}

// LABS Document structure
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct LABSDocument {
    pub LABS: Bytes,
    pub owner: Address,
    pub public_key: Bytes,
    pub service_endpoint: Option<String>,
    pub created: u64,
    pub updated: u64,
    pub active: bool,
}

// Verifiable Credential structure
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
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

// Contract information
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct ContractInfo {
    pub version: String,
    pub network: String,
    pub created: u64,
    pub owner: Address,
}

// Main contract implementation
#[contract]
pub struct LABSContract;

#[contractimpl]
impl LABSContract {
    /// Initialize the contract with version and network
     pub fn __constructor(env: Env, version: String, network: String, owner: Address) {
        let info = ContractInfo {
            version,
            network,
            created: env.ledger().timestamp(),
            owner: owner.clone(),
        };
        
        env.storage().instance().set(&DataKey::ContractInfo, &info);
    }

    /// Register a new LABS
    pub fn register_LABS(
        env: Env,
        LABS: Bytes,
        public_key: Bytes,
        service_endpoint: Option<String>,
        owner: Address,
    ) -> Result<(), Error> {
        // Require the owner to sign this transaction
        owner.require_auth();

        // Validate inputs
        if LABS.len() == 0 || public_key.len() == 0 {
            return Err(Error::InvalidInput);
        }

        // Check if LABS already exists
        if env
            .storage()
            .instance()
            .has(&DataKey::LABS(LABS.clone()))
        {
            return Err(Error::InvalidInput);
        }

        let timestamp = env.ledger().timestamp();
        
        // Create LABS document
        let LABS_doc = LABSDocument {
            LABS: LABS.clone(),
            owner: owner.clone(),
            public_key: public_key.clone(),
            service_endpoint,
            created: timestamp,
            updated: timestamp,
            active: true,
        };

        // Store LABS document
        env.storage()
            .instance()
            .set(&DataKey::LABS(LABS.clone()), &LABS_doc);
        
        // Store owner mapping
        env.storage()
            .instance()
            .set(&DataKey::LABSOwner(LABS.clone()), &owner);
        
        // Store timestamps
        env.storage()
            .instance()
            .set(&DataKey::LABSCreated(LABS.clone()), &timestamp);
        env.storage()
            .instance()
            .set(&DataKey::LABSUpdated(LABS.clone()), &timestamp);

        Ok(())
    }

    /// Update LABS document
    pub fn update_LABS(
        env: Env,
        LABS: Bytes,
        public_key: Option<Bytes>,
        service_endpoint: Option<String>,
        updater: Address,
    ) -> Result<(), Error> {
        // Require the updater to sign this transaction
        updater.require_auth();

        // Get existing LABS document
        let mut LABS_doc: LABSDocument = env
            .storage()
            .instance()
            .get(&DataKey::LABS(LABS.clone()))
            .ok_or(Error::LABSNotFound)?;

        // Check authorization
        if LABS_doc.owner != updater {
            return Err(Error::Unauthorized);
        }

        if !LABS_doc.active {
            return Err(Error::InvalidInput);
        }

        // Update fields if provided
        if let Some(new_key) = public_key {
            LABS_doc.public_key = new_key;
        }
        
        if let Some(new_endpoint) = service_endpoint {
            LABS_doc.service_endpoint = Some(new_endpoint);
        }

        let timestamp = env.ledger().timestamp();
        LABS_doc.updated = timestamp;

        // Store updated document
        env.storage()
            .instance()
            .set(&DataKey::LABS(LABS.clone()), &LABS_doc);
        env.storage()
            .instance()
            .set(&DataKey::LABSUpdated(LABS.clone()), &timestamp);

        Ok(())
    }

    /// Deactivate LABS
    pub fn deactivate_LABS(env: Env, LABS: Bytes, deactivator: Address) -> Result<(), Error> {
        // Require the deactivator to sign this transaction
        deactivator.require_auth();

        let mut LABS_doc: LABSDocument = env
            .storage()
            .instance()
            .get(&DataKey::LABS(LABS.clone()))
            .ok_or(Error::LABSNotFound)?;

        // Check authorization
        if LABS_doc.owner != deactivator {
            return Err(Error::Unauthorized);
        }

        if !LABS_doc.active {
            return Err(Error::InvalidInput);
        }

        LABS_doc.active = false;
        LABS_doc.updated = env.ledger().timestamp();

        env.storage()
            .instance()
            .set(&DataKey::LABS(LABS.clone()), &LABS_doc);

        Ok(())
    }

    /// Resolve LABS document
    pub fn resolve_LABS(env: Env, LABS: Bytes) -> Result<LABSDocument, Error> {
        env.storage()
            .instance()
            .get(&DataKey::LABS(LABS))
            .ok_or(Error::LABSNotFound)
    }

    /// Issue verifiable credential
    pub fn issue_credential(
        env: Env,
        issuer: Bytes,
        subject: Bytes,
        credential_type: String,
        claims_hash: Bytes,
        expires: Option<u64>,
        issuer_address: Address,
    ) -> Result<Bytes, Error> {
        // Require the issuer to sign this transaction
        issuer_address.require_auth();

        // Validate inputs
        if issuer.len() == 0 || subject.len() == 0 || claims_hash.len() == 0 {
            return Err(Error::InvalidInput);
        }

        // Validate expiry is in the future if set
        if let Some(exp) = expires {
            if exp <= env.ledger().timestamp() {
                return Err(Error::InvalidInput);
            }
        }

        // Verify issuer exists and is authorized
        let issuer_LABS: LABSDocument = env
            .storage()
            .instance()
            .get(&DataKey::LABS(issuer.clone()))
            .ok_or(Error::LABSNotFound)?;

        if issuer_LABS.owner != issuer_address {
            return Err(Error::Unauthorized);
        }

        // Generate credential ID
        let mut credential_id = Bytes::new(&env);
        credential_id.extend_from_array(&[0u8; 32]); // Will be filled with hash
        
        // Create credential ID from issuer, subject, type, and timestamp
        let timestamp = env.ledger().timestamp();
        let mut hash_input = Bytes::new(&env);
        hash_input.append(&issuer);
        hash_input.append(&subject);
        hash_input.append(&credential_type.clone().into_bytes(&env));
        hash_input.append(&timestamp.to_be_bytes());
        
        // Simple hash (in production, use proper cryptographic hash)
        credential_id.copy_from_slice(&hash_input.slice(0, 32));

        let credential = VerifiableCredential {
            id: credential_id.clone(),
            issuer: issuer.clone(),
            subject: subject.clone(),
            credential_type: credential_type.clone(),
            claims_hash,
            issued: timestamp,
            expires,
            revoked: false,
        };

        // Store credential
        env.storage()
            .instance()
            .set(&DataKey::Credential(credential_id.clone()), &credential);
        
        // Store metadata
        env.storage()
            .instance()
            .set(&DataKey::CredentialIssuer(credential_id.clone()), &issuer);
        env.storage()
            .instance()
            .set(&DataKey::CredentialSubject(credential_id.clone()), &subject);
        env.storage()
            .instance()
            .set(&DataKey::CredentialIssued(credential_id.clone()), &timestamp);

        Ok(credential_id)
    }

    /// Revoke verifiable credential
    pub fn revoke_credential(
        env: Env,
        credential_id: Bytes,
        revoker_address: Address,
    ) -> Result<(), Error> {
        // Require the revoker to sign this transaction
        revoker_address.require_auth();

        let mut credential: VerifiableCredential = env
            .storage()
            .instance()
            .get(&DataKey::Credential(credential_id.clone()))
            .ok_or(Error::CredentialNotFound)?;

        if credential.revoked {
            return Err(Error::AlreadyRevoked);
        }

        // Get issuer to verify authorization
        let issuer_LABS: LABSDocument = env
            .storage()
            .instance()
            .get(&DataKey::LABS(credential.issuer.clone()))
            .ok_or(Error::LABSNotFound)?;

        if issuer_LABS.owner != revoker_address {
            return Err(Error::Unauthorized);
        }

        credential.revoked = true;
        
        env.storage()
            .instance()
            .set(&DataKey::Credential(credential_id.clone()), &credential);
        env.storage()
            .instance()
            .set(&DataKey::CredentialRevoked(credential_id), &env.ledger().timestamp());

        Ok(())
    }

    /// Verify credential
    pub fn verify_credential(
        env: Env,
        credential_id: Bytes,
    ) -> Result<VerifiableCredential, Error> {
        let credential: VerifiableCredential = env
            .storage()
            .instance()
            .get(&DataKey::Credential(credential_id))
            .ok_or(Error::CredentialNotFound)?;

        // Check if revoked
        if credential.revoked {
            return Err(Error::AlreadyRevoked);
        }

        // Check expiration
        if let Some(expiration) = credential.expires {
            if env.ledger().timestamp() > expiration {
                return Err(Error::CredentialExpired);
            }
        }

        Ok(credential)
    }

    /// Get credential by ID
    pub fn get_credential(
        env: Env,
        credential_id: Bytes,
    ) -> Result<VerifiableCredential, Error> {
        env.storage()
            .instance()
            .get(&DataKey::Credential(credential_id))
            .ok_or(Error::CredentialNotFound)
    }

    /// Get all LABSs for an owner
    pub fn get_owner_LABSs(env: Env, owner: Address) -> Result<Vec<Bytes>, Error> {
        // This is a simplified implementation
        // In production, you'd maintain an index or use more efficient querying
        let mut LABSs = Vec::new(&env);
        
        // For now, return empty vector as implementing efficient owner querying
        // would require more complex indexing
        Ok(LABSs)
    }

    /// Get contract information
    pub fn get_contract_info(env: Env) -> Result<ContractInfo, Error> {
        env.storage()
            .instance()
            .get(&DataKey::ContractInfo)
            .ok_or(Error::LABSNotFound)
    }

    /// Check if LABS exists
    pub fn LABS_exists(env: Env, LABS: Bytes) -> bool {
        env.storage()
            .instance()
            .has(&DataKey::LABS(LABS))
    }

    /// Check if credential exists
    pub fn credential_exists(env: Env, credential_id: Bytes) -> bool {
        env.storage()
            .instance()
            .has(&DataKey::Credential(credential_id))
    }
}

#[cfg(test)]
mod tests;
