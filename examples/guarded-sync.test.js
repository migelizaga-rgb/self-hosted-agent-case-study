'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { hashBytes, decideFileAction } = require('./guarded-sync');

const old = hashBytes('previous release');
const next = hashBytes('candidate release');
const edited = hashBytes('owner edit');

test('hashing distinguishes absence from empty bytes', () => {
  assert.equal(hashBytes(null), null);
  assert.notEqual(hashBytes(''), null);
  assert.equal(hashBytes('same'), hashBytes(Buffer.from('same')));
});

const cases = [
  ['create a new absent file', null, null, next, 'create'],
  ['update only an unchanged previous blob', old, old, next, 'update'],
  ['preserve an owner edit', edited, old, next, 'skip-live-edit'],
  ['accept bytes already at the candidate', next, old, next, 'noop'],
  ['preserve an owner deletion', null, old, next, 'keep-live-delete'],
  ['preserve an existing file on addition', edited, null, next, 'skip-live-edit'],
  ['accept an identical existing addition', next, null, next, 'noop'],
  ['never prune an upstream deletion', old, old, null, 'noop'],
  ['never prune edited bytes on upstream deletion', edited, old, null, 'noop'],
  ['both files absent needs no action', null, null, null, 'noop'],
  ['an unchanged release needs no write', old, old, old, 'noop'],
  ['empty bytes are an existing previous file', hashBytes(''), hashBytes(''), next, 'update'],
];

for (const [name, liveHash, prevDeployedHash, nextHash, expected] of cases) {
  test(name, () => {
    assert.equal(decideFileAction({ liveHash, prevDeployedHash, nextHash }), expected);
  });
}
