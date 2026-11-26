'use strict';

const { createHash } = require('node:crypto');
const hash = text => createHash('sha256').update(text).digest('hex');

// In-memory illustration: no dependency installation or filesystem writes.
// Each registry entry binds one transform to a version and exact input/output.
function runRegistry({ text, version, patches }) {
  if (patches.some(patch => patch.version !== version)) {
    throw new Error('upstream version drift');
  }
  const results = [];
  for (const patch of patches) {
    let status;
    try {
      const before = text.includes(patch.marker);
      if (patch.applicable && !patch.applicable(text)) {
        status = 'na';
      } else if (before && hash(text) === patch.afterHash) {
        status = 'already';
      } else if (before || hash(text) !== patch.beforeHash) {
        status = 'missed';
      } else {
        const candidate = patch.apply(text);
        const after = candidate.includes(patch.marker);
        if (after && hash(candidate) === patch.afterHash) {
          text = candidate;
          status = 'applied';
        } else {
          status = 'missed';
        }
      }
    } catch {
      status = 'error';
    }
    results.push({ name: patch.name, required: patch.required, status });
  }
  const failed = results.filter(row => ['missed', 'error'].includes(row.status));
  const degraded = failed.filter(row => row.required);
  const warnings = failed.filter(row => !row.required);
  return { text, results, degraded, warnings, preflightOk: degraded.length === 0 };
}

module.exports = { hash, runRegistry };
