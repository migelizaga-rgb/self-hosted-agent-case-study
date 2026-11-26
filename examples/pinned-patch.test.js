'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { hash, runRegistry } = require('./pinned-patch');

const original = 'const wait = 5;';
const patched = 'const wait = 9; /* local-fix */';
const patch = {
  name: 'bounded-wait', version: 'fixture-1', required: true,
  marker: '/* local-fix */', beforeHash: hash(original), afterHash: hash(patched),
  apply: () => patched,
};
const run = (text = original, overrides = {}) => runRegistry({
  text, version: 'fixture-1', patches: [{ ...patch, ...overrides }],
});

test('applies and verifies exact output', () => {
  const result = run();
  assert.equal(result.text, patched);
  assert.equal(result.results[0].status, 'applied');
  assert.equal(result.preflightOk, true);
});

test('already applied is idempotent and does not call the transform', () => {
  assert.equal(run(patched, { apply: () => { throw Error('called'); } })
    .results[0].status, 'already');
});

test('required byte drift degrades and blocks preflight', () => {
  const result = run('different bundle');
  assert.equal(result.results[0].status, 'missed');
  assert.equal(result.degraded.length, 1);
  assert.equal(result.preflightOk, false);
  assert.equal(result.text, 'different bundle');
});

test('advisory drift warns', () => {
  const result = run('different bundle', { required: false });
  assert.equal(result.warnings.length, 1);
  assert.equal(result.preflightOk, true);
});

test('a legitimately absent optional surface is not applicable', () => {
  const result = run(original, { applicable: () => false, required: false });
  assert.equal(result.results[0].status, 'na');
  assert.equal(result.preflightOk, true);
});

test('transform and probe exceptions are errors', () => {
  for (const overrides of [
    { apply: () => { throw Error('transform failed'); } },
    { applicable: () => { throw Error('probe failed'); } },
  ]) {
    const result = run(original, overrides);
    assert.equal(result.results[0].status, 'error');
    assert.equal(result.preflightOk, false);
    assert.equal(result.text, original);
  }
});

test('marker presence alone cannot authenticate output', () => {
  assert.equal(run('tampered ' + patched).results[0].status, 'missed');
});

test('bad transform output is never published', () => {
  for (const candidate of ['wrong output', 'wrong ' + patched]) {
    const result = run(original, { apply: () => candidate });
    assert.equal(result.results[0].status, 'missed');
    assert.equal(result.text, original);
  }
});

test('every version pin is checked before any transform runs', () => {
  let calls = 0;
  assert.throws(() => runRegistry({ text: original, version: 'fixture-1', patches: [
    { ...patch, apply: () => { calls++; return patched; } },
    { ...patch, version: 'fixture-2' },
  ] }), /version drift/);
  assert.equal(calls, 0);
});
