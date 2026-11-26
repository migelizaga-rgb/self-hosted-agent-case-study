'use strict';

const { createHash } = require('node:crypto');

// Hash bytes consistently; null means absent, never an empty file.
function hashBytes(bytes) {
  return bytes === null ? null : createHash('sha256').update(bytes).digest('hex');
}

// Content policy only. The caller proves ancestry, locks writers, rejects unsafe
// paths, journals preimages, rechecks content, and publishes atomically.
function decideFileAction({ liveHash, prevDeployedHash, nextHash }) {
  // Source removal never prunes live bytes, and content already at the candidate needs no write.
  if (nextHash === null || liveHash === nextHash) return 'noop';
  // Live file absent: brand new if it was never deployed, otherwise the owner deleted it.
  if (liveHash === null) return prevDeployedHash === null ? 'create' : 'keep-live-delete';
  // Overwrite only bytes that still match the previously deployed blob.
  return liveHash === prevDeployedHash ? 'update' : 'skip-live-edit';
}

module.exports = { hashBytes, decideFileAction };
