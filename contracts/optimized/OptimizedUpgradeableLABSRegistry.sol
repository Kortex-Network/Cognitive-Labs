// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuardUpgradeable.sol";

/**
 * @title OptimizedUpgradeableLABSRegistry
 * @dev Gas-optimized upgradeable version of the LABS registry with packed structs
 * Uses UUPS pattern and optimized storage layout for maximum gas efficiency
 */
contract OptimizedUpgradeableLABSRegistry is 
    Initializable, 
    UUPSUpgradeable, 
    OwnableUpgradeable,
    ReentrancyGuardUpgradeable 
{
    
    // Optimized LABSDocument struct - packed for gas efficiency
    // Storage layout: [address(20) + bool(1) + padding(11)] = 32 bytes (1 slot)
    // [uint256] = 32 bytes (1 slot) 
    // [uint256] = 32 bytes (1 slot)
    // Strings stored separately
    struct LABSDocument {
        address owner;        // 20 bytes
        bool active;          // 1 byte
        uint256 created;      // 32 bytes
        uint256 updated;      // 32 bytes
        string publicKey;     // dynamic
        string serviceEndpoint; // dynamic
    }
    
    // Optimized VerifiableCredential struct
    // Storage layout: [bytes32(32) + uint256(32) + uint256(32) + bool(1) + padding(7)] = 105 bytes (4 slots)
    // Strings stored separately
    struct VerifiableCredential {
        bytes32 id;           // 32 bytes
        uint256 issued;       // 32 bytes
        uint256 expires;      // 32 bytes
        bool revoked;         // 1 byte
        string issuer;        // dynamic
        string subject;       // dynamic
        string credentialType; // dynamic
        bytes32 dataHash;     // 32 bytes
    }
    
    // Storage variables - order must be maintained for upgrades
    mapping(string => LABSDocument) public LABSDocuments;
    mapping(bytes32 => VerifiableCredential) public credentials;
    mapping(address => string[]) public ownerToLABSs;
    
    // Events - optimized with indexed parameters
    event LABSCreated(string indexed LABS, address indexed owner, string publicKey);
    event LABSUpdated(string indexed LABS, uint256 updated);
    event LABSDeactivated(string indexed LABS);
    event CredentialIssued(bytes32 indexed id, string issuer, string subject);
    event CredentialRevoked(bytes32 indexed id);
    event ImplementationUpgraded(address indexed newImplementation);
    
    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }
    
    /**
     * @dev Initialize the upgradeable contract
     * @param initialOwner The address that will own the contract
     */
    function initialize(address initialOwner) public initializer {
        __Ownable_init(initialOwner);
        __UUPSUpgradeable_init();
        __ReentrancyGuard_init();
    }
    
    /**
     * @dev Authorizes an upgrade to a new implementation
     * @param newImplementation Address of the new implementation
     */
    function _authorizeUpgrade(address newImplementation) 
        internal 
        override 
        onlyOwner 
    {
        emit ImplementationUpgraded(newImplementation);
    }
    
    /**
     * @dev Create a new LABS document - gas optimized
     */
    function createLABS(
        string memory LABS,
        string memory publicKey,
        string memory serviceEndpoint
    ) external nonReentrant returns (bool) {
        require(LABSDocuments[LABS].owner == address(0), "LABS already exists");
        require(bytes(LABS).length > 0, "LABS cannot be empty");
        require(bytes(publicKey).length > 0, "Public key cannot be empty");
        
        // Create struct with optimal field ordering
        LABSDocument storage doc = LABSDocuments[LABS];
        doc.owner = msg.sender;
        doc.active = true;
        doc.created = block.timestamp;
        doc.updated = block.timestamp;
        doc.publicKey = publicKey;
        doc.serviceEndpoint = serviceEndpoint;
        
        ownerToLABSs[msg.sender].push(LABS);
        
        emit LABSCreated(LABS, msg.sender, publicKey);
        return true;
    }
    
    /**
     * @dev Update LABS document - gas optimized
     */
    function updateLABS(
        string memory LABS,
        string memory newPublicKey,
        string memory newServiceEndpoint
    ) external nonReentrant onlyOwner(LABS) returns (bool) {
        LABSDocument storage doc = LABSDocuments[LABS];
        require(doc.active, "LABS is not active");
        
        if (bytes(newPublicKey).length > 0) {
            doc.publicKey = newPublicKey;
        }
        
        if (bytes(newServiceEndpoint).length > 0) {
            doc.serviceEndpoint = newServiceEndpoint;
        }
        
        doc.updated = block.timestamp;
        
        emit LABSUpdated(LABS, block.timestamp);
        return true;
    }
    
    /**
     * @dev Deactivate LABS - gas optimized
     */
    function deactivateLABS(string memory LABS) external nonReentrant onlyOwner(LABS) returns (bool) {
        LABSDocuments[LABS].active = false;
        emit LABSDeactivated(LABS);
        return true;
    }
    
    /**
     * @dev Transfer LABS ownership - gas optimized
     */
    function transferLABS(string memory LABS, address newOwner) external nonReentrant onlyOwner(LABS) returns (bool) {
        require(newOwner != address(0), "New owner cannot be zero address");
        require(newOwner != LABSDocuments[LABS].owner, "New owner must be different");
        
        LABSDocument storage doc = LABSDocuments[LABS];
        address oldOwner = doc.owner;
        
        // Remove from old owner's list - optimized removal
        string[] storage oldOwnerLABSs = ownerToLABSs[oldOwner];
        uint256 length = oldOwnerLABSs.length;
        for (uint i = 0; i < length; i++) {
            if (keccak256(bytes(oldOwnerLABSs[i])) == keccak256(bytes(LABS))) {
                oldOwnerLABSs[i] = oldOwnerLABSs[length - 1];
                oldOwnerLABSs.pop();
                break;
            }
        }
        
        // Update owner
        doc.owner = newOwner;
        doc.updated = block.timestamp;
        
        // Add to new owner's list
        ownerToLABSs[newOwner].push(LABS);
        
        emit LABSUpdated(LABS, block.timestamp);
        return true;
    }
    
    /**
     * @dev Get LABS document
     */
    function getLABSDocument(string memory LABS) external view returns (LABSDocument memory) {
        return LABSDocuments[LABS];
    }
    
    /**
     * @dev Issue verifiable credential - gas optimized
     */
    function issueCredential(
        string memory issuer,
        string memory subject,
        string memory credentialType,
        uint256 expires,
        bytes32 dataHash
    ) external nonReentrant returns (bytes32) {
        require(bytes(issuer).length > 0, "Issuer cannot be empty");
        require(bytes(subject).length > 0, "Subject cannot be empty");
        require(bytes(credentialType).length > 0, "Credential type cannot be empty");
        
        bytes32 credentialId = keccak256(abi.encodePacked(
            issuer,
            subject,
            block.timestamp,
            dataHash
        ));
        
        require(credentials[credentialId].id == bytes32(0), "Credential already exists");
        
        // Create struct with optimal field ordering
        VerifiableCredential storage cred = credentials[credentialId];
        cred.id = credentialId;
        cred.issued = block.timestamp;
        cred.expires = expires;
        cred.revoked = false;
        cred.issuer = issuer;
        cred.subject = subject;
        cred.credentialType = credentialType;
        cred.dataHash = dataHash;
        
        emit CredentialIssued(credentialId, issuer, subject);
        return credentialId;
    }
    
    /**
     * @dev Revoke credential - gas optimized
     */
    function revokeCredential(bytes32 credentialId) external nonReentrant returns (bool) {
        VerifiableCredential storage cred = credentials[credentialId];
        require(cred.id != bytes32(0), "Credential does not exist");
        require(cred.issuer == addressToString(msg.sender), "Only issuer can revoke");
        require(!cred.revoked, "Credential already revoked");
        
        cred.revoked = true;
        emit CredentialRevoked(credentialId);
        return true;
    }
    
    /**
     * @dev Get credential
     */
    function getCredential(bytes32 credentialId) external view returns (VerifiableCredential memory) {
        return credentials[credentialId];
    }
    
    /**
     * @dev Check if credential is valid - gas optimized
     */
    function isCredentialValid(bytes32 credentialId) external view returns (bool) {
        VerifiableCredential storage cred = credentials[credentialId];
        return cred.id != bytes32(0) && !cred.revoked && (cred.expires == 0 || cred.expires > block.timestamp);
    }
    
    /**
     * @dev Get all LABSs for an owner
     */
    function getOwnerLABSs(address owner) external view returns (string[] memory) {
        return ownerToLABSs[owner];
    }
    
    /**
     * @dev Get contract version for upgrade tracking
     */
    function getVersion() external pure returns (string memory) {
        return "2.0.0-optimized";
    }
    
    /**
     * @dev Get contract type
     */
    function getContractType() external pure returns (string memory) {
        return "OptimizedUpgradeableLABSRegistry";
    }
    
    // --- Gas Optimization Functions ---
    
    /**
     * @dev Batch operation for multiple LABS creations - reduces gas costs
     */
    function batchCreateLABSs(
        string[] memory LABSs,
        string[] memory publicKeys,
        string[] memory serviceEndpoints
    ) external nonReentrant returns (bool) {
        require(LABSs.length == publicKeys.length && LABSs.length == serviceEndpoints.length, "Array length mismatch");
        
        for (uint256 i = 0; i < LABSs.length; i++) {
            require(LABSDocuments[LABSs[i]].owner == address(0), "LABS already exists");
            require(bytes(LABSs[i]).length > 0, "LABS cannot be empty");
            require(bytes(publicKeys[i]).length > 0, "Public key cannot be empty");
            
            LABSDocument storage doc = LABSDocuments[LABSs[i]];
            doc.owner = msg.sender;
            doc.active = true;
            doc.created = block.timestamp;
            doc.updated = block.timestamp;
            doc.publicKey = publicKeys[i];
            doc.serviceEndpoint = serviceEndpoints[i];
            
            ownerToLABSs[msg.sender].push(LABSs[i]);
            
            emit LABSCreated(LABSs[i], msg.sender, publicKeys[i]);
        }
        
        return true;
    }
    
    /**
     * @dev Check if LABS exists without loading full struct - gas efficient
     */
    function LABSExists(string memory LABS) external view returns (bool) {
        return LABSDocuments[LABS].owner != address(0);
    }
    
    /**
     * @dev Get only essential LABS info - saves gas when full document not needed
     */
    function getLABSInfo(string memory LABS) external view returns (address owner, bool active, uint256 updated) {
        LABSDocument storage doc = LABSDocuments[LABS];
        return (doc.owner, doc.active, doc.updated);
    }
    
    /**
     * @dev Batch credential issuance - reduces gas costs
     */
    function batchIssueCredentials(
        string[] memory issuers,
        string[] memory subjects,
        string[] memory credentialTypes,
        uint256[] memory expires,
        bytes32[] memory dataHashes
    ) external nonReentrant returns (bytes32[] memory) {
        require(
            issuers.length == subjects.length && 
            issuers.length == credentialTypes.length && 
            issuers.length == expires.length && 
            issuers.length == dataHashes.length,
            "Array length mismatch"
        );
        
        bytes32[] memory credentialIds = new bytes32[](issuers.length);
        
        for (uint256 i = 0; i < issuers.length; i++) {
            require(bytes(issuers[i]).length > 0, "Issuer cannot be empty");
            require(bytes(subjects[i]).length > 0, "Subject cannot be empty");
            require(bytes(credentialTypes[i]).length > 0, "Credential type cannot be empty");
            
            bytes32 credentialId = keccak256(abi.encodePacked(
                issuers[i],
                subjects[i],
                block.timestamp,
                dataHashes[i]
            ));
            
            require(credentials[credentialId].id == bytes32(0), "Credential already exists");
            
            VerifiableCredential storage cred = credentials[credentialId];
            cred.id = credentialId;
            cred.issued = block.timestamp;
            cred.expires = expires[i];
            cred.revoked = false;
            cred.issuer = issuers[i];
            cred.subject = subjects[i];
            cred.credentialType = credentialTypes[i];
            cred.dataHash = dataHashes[i];
            
            credentialIds[i] = credentialId;
            emit CredentialIssued(credentialId, issuers[i], subjects[i]);
        }
        
        return credentialIds;
    }
    
    // Helper function to convert address to string
    function addressToString(address addr) internal pure returns (string memory) {
        bytes32 value = bytes32(uint256(uint160(addr)));
        bytes memory alphabet = "0123456789abcdef";
        bytes memory str = new bytes(42);
        
        str[0] = '0';
        str[1] = 'x';
        
        for (uint i = 0; i < 20; i++) {
            str[2 + i * 2] = alphabet[uint8(uint8(value[i + 12] >> 4))];
            str[3 + i * 2] = alphabet[uint8(uint8(value[i + 12] & 0x0f))];
        }
        
        return string(str);
    }
    
    /**
     * @dev Modifier to check LABS ownership
     */
    modifier onlyOwner(string memory LABS) {
        require(LABSDocuments[LABS].owner == msg.sender, "Only LABS owner can perform this action");
        _;
    }
}
