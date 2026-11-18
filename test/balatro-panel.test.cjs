'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const {create,validateTarget} = require('../panel/balatro-diagnostics.cjs');
test('private LAN address accepted',()=>{
  assert.equal(validateTarget('192.168.1.232'),'192.168.1.232');
  assert.equal(validateTarget('10.1.2.3'),'10.1.2.3');
});
test('public, DNS and loopback rejected',()=>{
  for(const host of ['8.8.8.8','localhost','127.0.0.1','169.254.1.4','192.168.1.255','::1'])
    assert.throws(()=>validateTarget(host));
});
test('diagnostic never claims native capabilities',async()=>{
  const s=create({probe:async()=>({capabilities:{ffi_module_loaded:true},iz2s:{ready:true}})});
  const x=await s.run('192.168.1.232');
  assert.equal(x.iz2s.ready,false);
  assert.equal(x.iz2s.nativeOperationsVerified,false);
});
test('overlap blocked, state released on failure',async()=>{
  let release, count=0;
  const s=create({probe:()=>{count++;return new Promise(r=>{release=r;});}});
  const pending=s.run('10.0.0.2');
  await assert.rejects(s.run('10.0.0.2'),/already in progress/);
  await Promise.resolve();
  release({capabilities:{}});
  await pending;
  assert.equal(count,1);
});
test('failure releases busy state',async()=>{
  let count=0;const s=create({probe:async()=>{count++;throw Error('offline');}});
  await assert.rejects(s.run('192.168.0.2'),/offline/);
  await assert.rejects(s.run('192.168.0.2'),/offline/);
  assert.equal(count,2);
});

test('Balatro browser script is actually registered as a served panel asset',()=>{
  const fs=require('node:fs');
  const path=require('node:path');
  const http=fs.readFileSync(path.join(__dirname,'../panel/http.cjs'),'utf8');
  const html=fs.readFileSync(path.join(__dirname,'../panel/ui/panel.html'),'utf8');
  const js=fs.readFileSync(path.join(__dirname,'../panel/ui/balatro-diagnostics.js'),'utf8');
  assert.match(http, /['"]\/balatro-diagnostics\.js['"]\s*:\s*\[['"]balatro-diagnostics\.js['"]/);
  assert.match(html, /<script[^>]+src=['"]\/balatro-diagnostics\.js\?v=/);
  assert.match(js, /getElementById\(['"]balatro-audit-run['"]\)/);
  assert.match(js, /addEventListener\(['"]click['"]/);
});

test('status snapshot is a read-only lifecycle view', async () => {
  let checks = 0;
  const session = create({probe: async () => {checks++; return {capabilities:{lua:'Lua 5.1'}};}});
  assert.equal(session.snapshot().phase,'idle');
  const result = await session.run('192.168.1.232');
  assert.equal(result.phase,'connected');
  assert.equal(session.snapshot().phase,'connected');
  assert.equal(session.snapshot().ready,false);
  assert.equal(checks,1);
  const status = session.snapshot();
  assert.equal(status.ready,false);
  assert.equal(checks,1);
});

test('disconnect clears only local diagnostic state, never privileges', async () => {
  let finish;
  const s = create({probe: () => new Promise(resolve => {finish = resolve;})});
  const pending = s.run('192.168.1.232');
  await Promise.resolve();
  const disconnected = s.disconnect();
  assert.equal(disconnected.phase,'idle');
  assert.equal(disconnected.ready,false);
  finish({capabilities:{ffi_module_loaded:true}});
  await assert.rejects(pending,/disconnected/);
  assert.equal(s.snapshot().phase,'idle');
});
test('disconnect from connected leaves idle and never claims native readiness', async () => {
  const s = create({probe: async () => ({capabilities:{lua:'Lua 5.1'}})});
  await s.run('192.168.1.232');
  assert.equal(s.snapshot().phase,'connected');
  const x = s.disconnect();
  assert.equal(x.phase,'idle');
  assert.equal(x.nativeOperationsVerified,false);
  assert.equal(x.privilegedSessionVerified,false);
});
