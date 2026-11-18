'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const {BACKENDS, BLOCKED, selectBackend} = require('../engines/iz2s-core/runtime/installer/engine/switch2/balatro/backend-selector.cjs');
const {parseArgs} = require('../engines/iz2s-core/runtime/installer/engine/switch2/balatro/backend-status.cjs');
test('selector explicitly supports only known backends', () => {
  assert.deepEqual(BACKENDS, ['smilebasic', 'balatro']);
  assert.throws(() => selectBackend('unknown'), /Unknown/);
  assert.throws(() => selectBackend('balatro'), /requires --host/);
  assert.throws(() => selectBackend('balatro', {host: '127.0.0.1', port: -1}), /port/);
});
test('legacy SmileBASIC is not probed or claimed ready', async () => {
  const x = selectBackend('smilebasic');
  assert.equal(x.name, 'smilebasic');
  assert.deepEqual((await x.status()).checked, false);
  assert.equal((await x.status()).ready, false);
});
test('Balatro diagnostic result is forced fail-closed', async () => {
  let called = 0;
  const backend = selectBackend('balatro', {host: '127.0.0.1', port: 9026,
    audit: async (host, options) => {
      called++;
      assert.equal(host, '127.0.0.1');
      assert.equal(options.port, 9026);
      return {backend: 'balatro', capabilities: {ffi: true},
        iz2s: {ready: true, nativeOperationsVerified: true, privilegedSessionVerified: true}};
    }});
  const value = await backend.status();
  assert.equal(called, 1);
  assert.equal(value.iz2s.ready, false);
  assert.equal(value.iz2s.privilegedSessionVerified, false);
  assert.equal(value.iz2s.nativeOperationsVerified, false);
});
test('all sensitive operations explicitly throw', async () => {
  const backend = selectBackend('balatro', {host: '127.0.0.1', audit: async () => ({iz2s: {ready: false}})});
  for (const op of BLOCKED) await assert.rejects(backend[op](), /unavailable/);
});
test('CLI requires explicit flags and disallows unknown flags', () => {
  assert.deepEqual(parseArgs(['--backend', 'balatro', '--host', '192.168.1.232']),
    {backend: 'balatro',host:'192.168.1.232', port:undefined});
  assert.throws(() => parseArgs(['--backend', 'balatro', '--unknown', 'yes']), /Invalid arguments/);
  assert.throws(() => parseArgs(['--backend', 'balatro', '--backend', 'smilebasic']), /Invalid arguments/);
});
test('concurrent diagnostic calls do not elevate readiness', async () => {
  const backend = selectBackend('balatro', {host:'127.0.0.1', audit:async()=>({iz2s:{ready:true}})});
  const out = await Promise.all(Array.from({length:100},()=>backend.status()));
  assert.equal(out.length,100);
  assert.ok(out.every(x=>x.iz2s.ready===false));
});
