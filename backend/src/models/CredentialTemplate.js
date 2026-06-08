const mongoose = require('mongoose');

const credentialTemplateSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    unique: true,
  },
  description: String,
  credentialType: {
    type: String,
    required: true,
  },
  schemaUri: String,
  requiredClaims: [{
    name: String,
    type: { type: String, enum: ['string', 'number', 'boolean', 'date', 'object'] },
    description: String,
    required: { type: Boolean, default: true },
  }],
  issuerLABS: String,
  active: {
    type: Boolean,
    default: true,
  },
  metadata: {
    type: Map,
    of: String,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
  updatedAt: {
    type: Date,
    default: Date.now,
  },
});

credentialTemplateSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

// Active templates by type (template lookup during issuance)
credentialTemplateSchema.index({ credentialType: 1, active: 1 });

// Issuer's templates
credentialTemplateSchema.index({ issuerLABS: 1, active: 1 });

module.exports = mongoose.model('CredentialTemplate', credentialTemplateSchema);
