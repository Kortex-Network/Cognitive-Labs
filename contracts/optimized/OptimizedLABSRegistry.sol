// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "../interfaces/IERC725.sol";
import "../interfaces/IERC735.sol";

/**
 * @title OptimizedLABSRegistry
 * @dev Gas-optimized version of the LABS registry with packed structs and efficient storage layout
 * Implements ERC-725 and ERC-735 standards for identity and claim management
 */
contract OptimizedLABSRegistry is IERC725, IERC735 {
    using SafeMath for uint256;
    
    // Role-based access control - packed into single storage slot
    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");
    bytes32 public constant ISSUER_ROLE = keccak256("ISSUER_ROLE");
    
    mapping(bytes32 => mapping(address => bool)) private _roles;
    address private _admin;
    
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
    
    // Storage mappings - optimized order
    mapping(string => LABSDocument) public LABSDocuments;
    mapping(bytes32 => VerifiableCredential) public credentials;
    mapping(address => string[]) public ownerToLABSs;
    
    // ERC725/735 Storage mapped by LABS
    mapping(string => mapping(bytes32 => bytes)) private _LABSData;
    mapping(string => mapping(bytes32 => IERC735.Claim)) private _LABSClaims;
    mapping(string => mapping(uint256 => bytes32[])) private _LABSClaimsByTopic;
    
    // Events - optimized with indexed parameters
    event LABSBridged(string indexed LABS, address indexed owner, string publicKey);
    event LABSUpdated(string indexed LABS, uint256 updated);
    event CredentialBridged(bytes32 indexed id, string issuer, string subject);
    
    // Modifiers
    modifier onlyRole(bytes32 role) {
        require(_roles[role][msg.sender], "AccessControl: caller missing role");
        _;
    }
    
    modifier onlyOwner(string memory LABS) {
        require(LABSDocuments[LABS].owner == msg.sender, "Only LABS owner can perform this action");
        _;
    }
    
    constructor() {
        _admin = msg.sender;
        _roles[ADMIN_ROLE][msg.sender] = true;
    }

    function grantRole(bytes32 role, address account) external onlyRole(ADMIN_ROLE) {
        _roles[role][account] = true;
    }
    
    /**
     * @dev Bridge a Stellar LABS to Ethereum - gas optimized
     */
    function bridgeLABS(
        string memory LABS,
        address ownerAddress,
        string memory publicKey,
        string memory serviceEndpoint
    ) external onlyRole(ADMIN_ROLE) returns (bool) {
        require(LABSDocuments[LABS].owner == address(0), "LABS already exists on this chain");
        
        // Create struct with optimal field ordering
        LABSDocument storage doc = LABSDocuments[LABS];
        doc.owner = ownerAddress;
        doc.active = true;
        doc.created = block.timestamp;
        doc.updated = block.timestamp;
        doc.publicKey = publicKey;
        doc.serviceEndpoint = serviceEndpoint;
        
        ownerToLABSs[ownerAddress].push(LABS);
        
        emit LABSBridged(LABS, ownerAddress, publicKey);
        return true;
    }
    
    /**
     * @dev Bridge a Verifiable Credential to Ethereum - gas optimized
     */
    function bridgeCredential(
        bytes32 credentialId,
        string memory issuer,
        string memory subject,
        string memory credentialType,
        uint256 expires,
        bytes32 dataHash
    ) external onlyRole(ADMIN_ROLE) returns (bytes32) {
        require(credentials[credentialId].issued == 0, "Credential already exists");
        
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
        
        emit CredentialBridged(credentialId, issuer, subject);
        return credentialId;
    }
    
    function getLABSDocument(string memory LABS) external view returns (LABSDocument memory) {
        return LABSDocuments[LABS];
    }
    
    function getCredential(bytes32 credentialId) external view returns (VerifiableCredential memory) {
        return credentials[credentialId];
    }

    // --- IERC725 Implementation ---

    function setData(bytes32 key, bytes memory value) external override {
        string memory LABS = _getCallerLABS();
        _LABSData[LABS][key] = value;
        emit DataChanged(key, value);
    }

    function getData(bytes32 key) external view override returns (bytes memory) {
        string memory LABS = _getCallerLABS();
        return _LABSData[LABS][key];
    }

    function execute(uint256 operationType, address target, uint256 value, bytes memory data) 
        external override returns (bytes memory) 
    {
        string memory LABS = _getCallerLABS();
        require(LABSDocuments[LABS].owner == msg.sender, "Only LABS owner can execute calls");
        
        (bool success, bytes memory result) = target.call{value: value}(data);
        require(success, "Execution failed");
        
        emit Executed(operationType, target, value, data);
        return result;
    }

    // --- IERC735 Implementation ---

    function addClaim(uint256 topic, uint256 scheme, address issuer, bytes memory signature, bytes memory data, string memory uri) 
        external override returns (bytes32 claimId) 
    {
        string memory LABS = _getCallerLABS();
        require(LABSDocuments[LABS].owner == msg.sender || msg.sender == issuer, "Unauthorized to add claim");

        claimId = keccak256(abi.encodePacked(issuer, topic));
        
        if (_LABSClaims[LABS][claimId].issuer == address(0)) {
            _LABSClaimsByTopic[LABS][topic].push(claimId);
        }
        
        _LABSClaims[LABS][claimId] = IERC735.Claim(topic, scheme, issuer, signature, data, uri);
        
        emit ClaimAdded(claimId, topic, scheme, issuer, signature, data, uri);
        return claimId;
    }

    function removeClaim(bytes32 claimId) external override returns (bool success) {
        string memory LABS = _getCallerLABS();
        require(LABSDocuments[LABS].owner == msg.sender, "Only LABS owner can remove claims");
        
        uint256 topic = _LABSClaims[LABS][claimId].topic;
        require(topic != 0, "Claim does not exist");
        
        delete _LABSClaims[LABS][claimId];
        
        // Remove from topic list - optimized removal
        bytes32[] storage ids = _LABSClaimsByTopic[LABS][topic];
        uint256 length = ids.length;
        for (uint i = 0; i < length; i++) {
            if (ids[i] == claimId) {
                ids[i] = ids[length - 1];
                ids.pop();
                break;
            }
        }
        
        emit ClaimRemoved(claimId, topic, 0, address(0), "", "", "");
        return true;
    }

    function getClaim(bytes32 claimId) external view override returns (uint256 topic, uint256 scheme, address issuer, bytes memory signature, bytes memory data, string memory uri) {
        string memory LABS = _getCallerLABS();
        IERC735.Claim memory c = _LABSClaims[LABS][claimId];
        return (c.topic, c.scheme, c.issuer, c.signature, c.data, c.uri);
    }

    function getClaimIdsByTopic(uint256 topic) external view override returns (bytes32[] memory claimIds) {
        string memory LABS = _getCallerLABS();
        return _LABSClaimsByTopic[LABS][topic];
    }

    // --- Internal Helpers ---

    function _getCallerLABS() internal view returns (string memory) {
        string[] memory LABSs = ownerToLABSs[msg.sender];
        require(LABSs.length > 0, "No LABS found for caller address");
        return LABSs[0];
    }
    
    // --- Gas Optimization Functions ---
    
    /**
     * @dev Batch operation for multiple LABS creations - reduces gas costs
     */
    function batchBridgeLABSs(
        string[] memory LABSs,
        address[] memory owners,
        string[] memory publicKeys,
        string[] memory serviceEndpoints
    ) external onlyRole(ADMIN_ROLE) returns (bool) {
        require(LABSs.length == owners.length && LABSs.length == publicKeys.length && LABSs.length == serviceEndpoints.length, "Array length mismatch");
        
        for (uint256 i = 0; i < LABSs.length; i++) {
            require(LABSDocuments[LABSs[i]].owner == address(0), "LABS already exists");
            
            LABSDocument storage doc = LABSDocuments[LABSs[i]];
            doc.owner = owners[i];
            doc.active = true;
            doc.created = block.timestamp;
            doc.updated = block.timestamp;
            doc.publicKey = publicKeys[i];
            doc.serviceEndpoint = serviceEndpoints[i];
            
            ownerToLABSs[owners[i]].push(LABSs[i]);
            
            emit LABSBridged(LABSs[i], owners[i], publicKeys[i]);
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
}
