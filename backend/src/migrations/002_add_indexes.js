const mongoose = require('mongoose');

/**
 * Migration: 002_add_indexes
 * Description: Add indexes to all collections to improve query performance.
 *
 * Indexes added:
 *   credentials  - issuer+issued, subject+issued, credentialType+issued,
 *                  revoked+issued, expires, issuer+credentialType+issued,
 *                  subject+revoked
 *   LABSs         - owner+created, owner+active, active+created
 *   apikeys      - owner+status, expiresAt (sparse)
 *   sessions     - userId+isValid
 *   webhooks     - active, events+active
 *   credentialtemplates - credentialType+active, issuerLABS+active
 */

const INDEX_SPECS = {
  credentials: [
    { key: { issuer: 1, issued: -1 },           options: { name: 'issuer_issued' } },
    { key: { subject: 1, issued: -1 },           options: { name: 'subject_issued' } },
    { key: { credentialType: 1, issued: -1 },    options: { name: 'credentialType_issued' } },
    { key: { revoked: 1, issued: -1 },           options: { name: 'revoked_issued' } },
    { key: { expires: 1 },                       options: { name: 'expires' } },
    { key: { issuer: 1, credentialType: 1, issued: -1 }, options: { name: 'issuer_credentialType_issued' } },
    { key: { subject: 1, revoked: 1 },           options: { name: 'subject_revoked' } },
  ],
  LABSs: [
    { key: { owner: 1, created: -1 },  options: { name: 'owner_created' } },
    { key: { owner: 1, active: 1 },    options: { name: 'owner_active' } },
    { key: { active: 1, created: -1 }, options: { name: 'active_created' } },
  ],
  apikeys: [
    { key: { owner: 1, status: 1 },  options: { name: 'owner_status' } },
    { key: { expiresAt: 1 },         options: { name: 'expiresAt', sparse: true } },
  ],
  sessions: [
    { key: { userId: 1, isValid: 1 }, options: { name: 'userId_isValid' } },
  ],
  webhooks: [
    { key: { active: 1 },          options: { name: 'active' } },
    { key: { events: 1, active: 1 }, options: { name: 'events_active' } },
  ],
  credentialtemplates: [
    { key: { credentialType: 1, active: 1 }, options: { name: 'credentialType_active' } },
    { key: { issuerLABS: 1, active: 1 },      options: { name: 'issuerLABS_active' } },
  ],
};

module.exports = {
  up: async () => {
    const db = mongoose.connection.db;

    for (const [collectionName, indexes] of Object.entries(INDEX_SPECS)) {
      const collection = db.collection(collectionName);

      for (const { key, options } of indexes) {
        try {
          await collection.createIndex(key, options);
          console.log(`[002] Created index '${options.name}' on '${collectionName}'`);
        } catch (err) {
          // Index already exists — safe to ignore
          if (err.code === 85 || err.code === 86 || err.codeName === 'IndexAlreadyExists') {
            console.log(`[002] Index '${options.name}' on '${collectionName}' already exists, skipping`);
          } else {
            throw err;
          }
        }
      }
    }

    console.log('[002] Migration up complete');
  },

  down: async () => {
    const db = mongoose.connection.db;

    for (const [collectionName, indexes] of Object.entries(INDEX_SPECS)) {
      const collection = db.collection(collectionName);

      for (const { options } of indexes) {
        try {
          await collection.dropIndex(options.name);
          console.log(`[002] Dropped index '${options.name}' on '${collectionName}'`);
        } catch (err) {
          if (err.code === 27) {
            console.log(`[002] Index '${options.name}' on '${collectionName}' not found, skipping`);
          } else {
            throw err;
          }
        }
      }
    }

    console.log('[002] Migration down complete');
  },
};
