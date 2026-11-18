'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const net = require('node:net');
const {request} = require('../engines/iz2s-core/runtime/installer/engine/switch2/balatro/rpc.cjs');
const {PROBE, parse, audit} = require('../engines/iz2s-core/runtime/installer/engine/switch2/balatro/diagnose.cjs');
const RESPONSE = '-> lua=Lua 5.1;jit=LuaJIT 2.1.0-beta3;ffi_module_loaded=true;native_declare=true;native_invoke=true;sdk_base_present=true';
async function withServer(handler, testFn) {
  const server = net.createServer({allowHalfOpen: true}, handler);
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  try {await testFn(server.address().port);} finally {await new Promise(resolve => server.close(resolve));}
}
test('capability parser accepts exact known fields', () => {
  const x = parse(RESPONSE);
  assert.equal(x.ffi_module_loaded, true);
  assert.equal(x.sdk_base_present, true);
});
test('capability parser rejects missing, duplicate and unexpected fields', () => {
  assert.throws(() => parse('-> lua=Lua 5.1'));
  assert.throws(() => parse(RESPONSE + ';lua=Lua 5.1'));
  assert.throws(() => parse(RESPONSE + ';privileged=true'));
});
test('request sends fixed Lua and half-closes write side', async () => {
  await withServer(socket => {
    const bytes = [];
    socket.on('data', b => bytes.push(b));
    socket.on('end', () => {
      assert.equal(Buffer.concat(bytes).toString(), PROBE);
      socket.end(RESPONSE);
    });
  }, async port => {
    const reply = await request({host:'127.0.0.1', port, lua:PROBE});
    assert.equal(reply, RESPONSE);
  });
});
test('audit never reports privileged readiness', async () => {
  await withServer(s => {s.on('data', () => {}); s.on('end', () => s.end(RESPONSE));}, async port => {
    const x = await audit('127.0.0.1', {port});
    assert.equal(x.iz2s.ready, false);
    assert.equal(x.iz2s.nativeOperationsVerified, false);
    assert.equal(x.capabilities.native_invoke, true);
  });
});
test('oversized reply rejected', async () => {
  await withServer(s => {s.on('data', () => {}); s.on('end', () => s.end('x'.repeat(1000)));}, async port => {
    await assert.rejects(request({host:'127.0.0.1', port, lua:PROBE, maxReplyBytes:50}), /size limit/);
  });
});
test('timeout rejects and request is not retried', async () => {
  await withServer(s => {s.on('data', () => {}); s.on('end', () => setTimeout(() => s.end(), 70));}, async port => {
    await assert.rejects(request({host:'127.0.0.1', port, lua:PROBE, timeoutMs:30}), /timed out/);
  });
});
test('invalid argument validation', () => {
  assert.throws(() => request({host:'', lua:PROBE}), /Invalid Balatro host/);
  assert.throws(() => request({host:'127.0.0.1', port:0, lua:PROBE}), /Invalid Balatro port/);
  assert.throws(() => request({host:'127.0.0.1', lua:''}), /Invalid Lua request/);
});
test('100 mock audits never claim privileged session', async () => {
  await withServer(s => {s.on('data',()=>{});s.on('end',()=>s.end(RESPONSE));}, async port => {
    for (let i=0; i<100; i++) assert.equal((await audit('127.0.0.1',{port})).iz2s.ready,false);
  });
});
