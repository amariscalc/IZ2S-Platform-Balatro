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
