const mongoose = require('mongoose');

/**
 * Runs explain() on a query and returns a summary of index usage and execution stats.
 *
 * @param {mongoose.Model} Model
 * @param {object} filter  - MongoDB filter object
 * @param {object} [sort]  - Sort spec, e.g. { issued: -1 }
 * @returns {Promise<object>} Summary with indexUsed, docsExamined, docsReturned, executionTimeMs
 */
async function analyzeQuery(Model, filter, sort = {}) {
  const query = Model.find(filter).sort(sort);
  const plan = await query.explain('executionStats');

  const stage = plan.executionStats;
  const winningPlan = plan.queryPlanner.winningPlan;

  // Walk the plan tree to find the index name (if any)
  const indexName = extractIndexName(winningPlan);

  return {
    collection: Model.collection.collectionName,
    filter,
    sort,
    indexUsed: indexName,
    docsExamined: stage.totalDocsExamined,
    keysExamined: stage.totalKeysExamined,
    docsReturned: stage.nReturned,
    executionTimeMs: stage.executionTimeMillis,
    isCollectionScan: indexName === null,
  };
}

/**
 * Recursively walks a query plan stage tree to find the index name.
 * Returns null if the plan is a COLLSCAN.
 */
function extractIndexName(stage) {
  if (!stage) return null;
  if (stage.stage === 'IXSCAN') return stage.indexName;
  if (stage.stage === 'COLLSCAN') return null;
  // Check inputStage or inputStages
  if (stage.inputStage) return extractIndexName(stage.inputStage);
  if (stage.inputStages) {
    for (const s of stage.inputStages) {
      const found = extractIndexName(s);
      if (found !== null) return found;
    }
  }
  return null;
}

/**
 * Lists all indexes on a collection with their sizes.
 *
 * @param {mongoose.Model} Model
 * @returns {Promise<Array>}
 */
async function listIndexes(Model) {
  const collection = mongoose.connection.db.collection(Model.collection.collectionName);
  const indexes = await collection.indexes();
  const stats = await collection.stats();
  const indexSizes = stats.indexSizes || {};

  return indexes.map(idx => ({
    name: idx.name,
    key: idx.key,
    unique: idx.unique || false,
    sparse: idx.sparse || false,
    sizeBytes: indexSizes[idx.name] || null,
  }));
}

/**
 * Runs the standard set of queries for this application and reports
 * which ones are missing index coverage (collection scans).
 *
 * @returns {Promise<Array>} Array of analysis results, collection scans flagged
 */
async function runIndexAudit() {
  // Lazy-load models to avoid circular deps
  const Credential = mongoose.model('Credential');
  const LABS = mongoose.model('LABS');
  const ApiKey = mongoose.model('ApiKey');
  const Session = mongoose.model('Session');

  const queries = [
    { model: Credential, filter: { issuer: '__audit__' },                sort: { issued: -1 } },
    { model: Credential, filter: { subject: '__audit__' },               sort: { issued: -1 } },
    { model: Credential, filter: { credentialType: '__audit__' },        sort: { issued: -1 } },
    { model: Credential, filter: { revoked: false },                     sort: { issued: -1 } },
    { model: Credential, filter: { issuer: '__audit__', credentialType: '__audit__' }, sort: { issued: -1 } },
    { model: Credential, filter: { subject: '__audit__', revoked: false }, sort: {} },
    { model: LABS,        filter: { owner: '__audit__' },                 sort: { created: -1 } },
    { model: LABS,        filter: { owner: '__audit__', active: true },   sort: {} },
    { model: ApiKey,     filter: { owner: '__audit__', status: 'active' }, sort: {} },
    { model: Session,    filter: { userId: '__audit__', isValid: true }, sort: {} },
  ];

  const results = [];
  for (const { model, filter, sort } of queries) {
    try {
      const result = await analyzeQuery(model, filter, sort);
      results.push(result);
    } catch (err) {
      results.push({ collection: model.collection.collectionName, filter, error: err.message });
    }
  }

  const collectionScans = results.filter(r => r.isCollectionScan);
  if (collectionScans.length > 0) {
    console.warn('[queryAnalysis] Collection scans detected (missing indexes):');
    collectionScans.forEach(r => {
      console.warn(`  ${r.collection} filter=${JSON.stringify(r.filter)}`);
    });
  } else {
    console.log('[queryAnalysis] All audited queries use indexes.');
  }

  return results;
}

module.exports = { analyzeQuery, listIndexes, runIndexAudit };
