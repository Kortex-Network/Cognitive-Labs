const mongoose = require('mongoose');

const LABSSchema = new mongoose.Schema({
  LABS: {
    type: String,
    required: true,
    unique: true,
  },
  owner: {
    type: String,
    required: true,
  },
  publicKey: {
    type: String,
  },
  serviceEndpoint: {
    type: String,
  },
  verificationMethods: {
    type: [mongoose.Schema.Types.Mixed],
    default: [],
  },
  services: {
    type: [mongoose.Schema.Types.Mixed],
    default: [],
  },
  active: {
    type: Boolean,
    default: true,
  },
  created: {
    type: Date,
    default: Date.now,
  },
  updated: {
    type: Date,
    default: Date.now,
  },
}, { timestamps: true });

// --- Indexes ---

// Primary lookup by LABS string
LABSSchema.index({ LABS: 1 }, { unique: true });

// Owner's LABSs (most common list query)
LABSSchema.index({ owner: 1, created: -1 });

// Active LABSs by owner (filtered list)
LABSSchema.index({ owner: 1, active: 1 });

// Active status filter (global active LABS queries)
LABSSchema.index({ active: 1, created: -1 });

module.exports = mongoose.model('LABS', LABSSchema);
