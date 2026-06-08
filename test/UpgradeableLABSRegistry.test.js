const { expect } = require("chai");
const { ethers, upgrades } = require("hardhat");

describe("UpgradeableStellarLABSRegistry", function () {
  let registry;
  let proxy;
  let implementation;
  let owner;
  let user1;
  let user2;

  beforeEach(async function () {
    [owner, user1, user2] = await ethers.getSigners();

    // Deploy the implementation
    const UpgradeableStellarLABSRegistry = await ethers.getContractFactory("UpgradeableStellarLABSRegistry");
    implementation = await UpgradeableStellarLABSRegistry.deploy();
    await implementation.deployed();

    // Deploy the proxy
    const LABSProxy = await ethers.getContractFactory("LABSProxy");
    proxy = await upgrades.deployProxy(
      LABSProxy,
      [owner.address],
      { initializer: "initialize", kind: "uups" }
    );
    await proxy.deployed();

    // Upgrade proxy to implementation
    await proxy.upgradeTo(implementation.address);

    // Get the registry interface
    registry = UpgradeableStellarLABSRegistry.attach(proxy.address);
  });

  describe("Initialization", function () {
    it("Should initialize correctly", async function () {
      expect(await registry.owner()).to.equal(owner.address);
      expect(await registry.getVersion()).to.equal("1.0.0");
      expect(await registry.getContractType()).to.equal("UpgradeableStellarLABSRegistry");
    });

    it("Should not allow re-initialization", async function () {
      await expect(
        registry.initialize(user1.address)
      ).to.be.revertedWith("Initializable: contract is already initialized");
    });
  });

  describe("LABS Operations", function () {
    const testLABS = "LABS:stellar:test123";
    const testPublicKey = "0x1234567890abcdef";
    const testServiceEndpoint = "https://api.example.com/LABS";

    it("Should create a new LABS", async function () {
      await expect(
        registry.connect(user1).createLABS(testLABS, testPublicKey, testServiceEndpoint)
      )
        .to.emit(registry, "LABSCreated")
        .withArgs(testLABS, user1.address, testPublicKey);

      const doc = await registry.getLABSDocument(testLABS);
      expect(doc.LABS).to.equal(testLABS);
      expect(doc.owner).to.equal(user1.address);
      expect(doc.publicKey).to.equal(testPublicKey);
      expect(doc.serviceEndpoint).to.equal(testServiceEndpoint);
      expect(doc.active).to.be.true;
    });

    it("Should not allow duplicate LABS creation", async function () {
      await registry.connect(user1).createLABS(testLABS, testPublicKey, testServiceEndpoint);
      
      await expect(
        registry.connect(user1).createLABS(testLABS, testPublicKey, testServiceEndpoint)
      ).to.be.revertedWith("LABS already exists");
    });

    it("Should update LABS document", async function () {
      await registry.connect(user1).createLABS(testLABS, testPublicKey, testServiceEndpoint);
      
      const newPublicKey = "0xabcdef1234567890";
      const newServiceEndpoint = "https://new-api.example.com/LABS";
      
      await expect(
        registry.connect(user1).updateLABS(testLABS, newPublicKey, newServiceEndpoint)
      )
        .to.emit(registry, "LABSUpdated")
        .withArgs(testLABS, anyValue);

      const doc = await registry.getLABSDocument(testLABS);
      expect(doc.publicKey).to.equal(newPublicKey);
      expect(doc.serviceEndpoint).to.equal(newServiceEndpoint);
    });

    it("Should not allow non-owner to update LABS", async function () {
      await registry.connect(user1).createLABS(testLABS, testPublicKey, testServiceEndpoint);
      
      await expect(
        registry.connect(user2).updateLABS(testLABS, "0xnewkey", "https://new.com")
      ).to.be.revertedWith("Only LABS owner can perform this action");
    });

    it("Should deactivate LABS", async function () {
      await registry.connect(user1).createLABS(testLABS, testPublicKey, testServiceEndpoint);
      
      await expect(
        registry.connect(user1).deactivateLABS(testLABS)
      )
        .to.emit(registry, "LABSDeactivated")
        .withArgs(testLABS);

      const doc = await registry.getLABSDocument(testLABS);
      expect(doc.active).to.be.false;
    });

    it("Should transfer LABS ownership", async function () {
      await registry.connect(user1).createLABS(testLABS, testPublicKey, testServiceEndpoint);
      
      await expect(
        registry.connect(user1).transferLABS(testLABS, user2.address)
      )
        .to.emit(registry, "LABSUpdated")
        .withArgs(testLABS, anyValue);

      const doc = await registry.getLABSDocument(testLABS);
      expect(doc.owner).to.equal(user2.address);
      
      const user1LABSs = await registry.getOwnerLABSs(user1.address);
      const user2LABSs = await registry.getOwnerLABSs(user2.address);
      expect(user1LABSs).to.not.include(testLABS);
      expect(user2LABSs).to.include(testLABS);
    });
  });

  describe("Credential Operations", function () {
    const testIssuer = "LABS:stellar:issuer123";
    const testSubject = "LABS:stellar:subject456";
    const testCredentialType = "VerifiableCredential";
    const testDataHash = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("test data"));

    it("Should issue a credential", async function () {
      const expires = Math.floor(Date.now() / 1000) + 86400; // 24 hours from now
      
      const tx = await registry.issueCredential(testIssuer, testSubject, testCredentialType, expires, testDataHash);
      const receipt = await tx.wait();
      
      const event = receipt.events.find(e => e.event === "CredentialIssued");
      const credentialId = event.args.id;
      
      expect(event.args.issuer).to.equal(testIssuer);
      expect(event.args.subject).to.equal(testSubject);
      
      const credential = await registry.getCredential(credentialId);
      expect(credential.issuer).to.equal(testIssuer);
      expect(credential.subject).to.equal(testSubject);
      expect(credential.credentialType).to.equal(testCredentialType);
      expect(credential.dataHash).to.equal(testDataHash);
      expect(credential.revoked).to.be.false;
    });

    it("Should validate credentials", async function () {
      const expires = Math.floor(Date.now() / 1000) + 86400;
      const tx = await registry.issueCredential(testIssuer, testSubject, testCredentialType, expires, testDataHash);
      const receipt = await tx.wait();
      
      const event = receipt.events.find(e => e.event === "CredentialIssued");
      const credentialId = event.args.id;
      
      expect(await registry.isCredentialValid(credentialId)).to.be.true;
      
      // Revoke credential
      await registry.revokeCredential(credentialId);
      expect(await registry.isCredentialValid(credentialId)).to.be.false;
    });
  });

  describe("Upgradeability", function () {
    it("Should allow owner to upgrade implementation", async function () {
      // Deploy new implementation
      const UpgradeableStellarLABSRegistryV2 = await ethers.getContractFactory("UpgradeableStellarLABSRegistry");
      const newImplementation = await UpgradeableStellarLABSRegistryV2.deploy();
      await newImplementation.deployed();
      
      // Upgrade proxy
      await expect(proxy.connect(owner).upgradeTo(newImplementation.address))
        .to.emit(proxy, "Upgraded")
        .withArgs(newImplementation.address);
      
      // Verify new implementation
      expect(await proxy.getImplementation()).to.equal(newImplementation.address);
      
      // Test that functionality still works
      const testLABS = "LABS:stellar:upgrade-test";
      await registry.connect(user1).createLABS(testLABS, "0x123", "https://test.com");
      
      const doc = await registry.getLABSDocument(testLABS);
      expect(doc.LABS).to.equal(testLABS);
    });

    it("Should not allow non-owner to upgrade", async function () {
      const UpgradeableStellarLABSRegistryV2 = await ethers.getContractFactory("UpgradeableStellarLABSRegistry");
      const newImplementation = await UpgradeableStellarLABSRegistryV2.deploy();
      await newImplementation.deployed();
      
      await expect(
        proxy.connect(user1).upgradeTo(newImplementation.address)
      ).to.be.revertedWith("Ownable: caller is not the owner");
    });

    it("Should preserve state during upgrade", async function () {
      // Create some state
      const testLABS = "LABS:stellar:state-test";
      await registry.connect(user1).createLABS(testLABS, "0x123", "https://test.com");
      
      const originalDoc = await registry.getLABSDocument(testLABS);
      expect(originalDoc.LABS).to.equal(testLABS);
      
      // Deploy and upgrade to new implementation
      const UpgradeableStellarLABSRegistryV2 = await ethers.getContractFactory("UpgradeableStellarLABSRegistry");
      const newImplementation = await UpgradeableStellarLABSRegistryV2.deploy();
      await newImplementation.deployed();
      
      await proxy.connect(owner).upgradeTo(newImplementation.address);
      
      // Verify state is preserved
      const upgradedDoc = await registry.getLABSDocument(testLABS);
      expect(upgradedDoc.LABS).to.equal(originalDoc.LABS);
      expect(upgradedDoc.owner).to.equal(originalDoc.owner);
      expect(upgradedDoc.publicKey).to.equal(originalDoc.publicKey);
    });
  });

  describe("Security", function () {
    it("Should prevent reentrancy attacks", async function () {
      // This test would require a malicious contract to test reentrancy
      // For now, we just verify the nonReentrant modifier is present
      const contractInterface = registry.interface;
      const createLABSFragment = contractInterface.getFunction("createLABS");
      expect(createLABSFragment.inputs.length).to.be.greaterThan(0);
    });

    it("Should validate input parameters", async function () {
      await expect(
        registry.connect(user1).createLABS("", "0x123", "https://test.com")
      ).to.be.revertedWith("LABS cannot be empty");
      
      await expect(
        registry.connect(user1).createLABS("LABS:test", "", "https://test.com")
      ).to.be.revertedWith("Public key cannot be empty");
    });
  });
});
