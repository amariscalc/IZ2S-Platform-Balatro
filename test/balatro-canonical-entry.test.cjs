'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {REQUIRED,evaluate,requireNativeEntry}=require('../core/console/sd-launcher/entry-contract.cjs');
const {launchOriginal}=require('../engines/iz2s-core/runtime/installer/engine/switch2/balatro/canonical-entry.cjs');
test('all three entry methods refer to the same original native launcher',()=>{
 for(const entry of ['smilebasic','balatro','civilization']){
  const report=evaluate({entry});
  assert.equal(report.kind,'canonical-iz2s-native-menu');
  assert.equal(report.originalCode,'core/console/sd-launcher/native/build/launcher.bin');
  assert.equal(report.originalBootstrap,'core/console/sd-launcher/bootstrap.cjs');
  assert.equal(report.canonicalMenuReady,false);
 }
});
test('native capabilities require concrete ownership, never unverified flags',()=>{
 const flags=Object.fromEntries(REQUIRED.map(item=>[item.id,true]));
 const r=evaluate({entry:'balatro',evidence:flags});
 assert.equal(r.requirements.length,7);
 assert.ok(r.requirements.every(item=>item.reported&&!item.verified));
 assert.equal(r.allowNativeStart,false);
 assert.equal(r.ready,false);
});
test('Balatro canonical entry fails before any native or FFI side effects',()=>{
 assert.throws(()=>launchOriginal(),e=>{
  assert.equal(e.code,'IZ2S_NATIVE_ENTRY_NOT_READY');
  assert.equal(e.report.missing.length,7);
  assert.equal(e.report.entry,'balatro');
  return true;
 });
 assert.throws(()=>requireNativeEntry({entry:'civilization'}),/Cannot start/);
});
test('invalid entry methods and evidence cannot bypass canonical launch guard',()=>{
 assert.throws(()=>evaluate({entry:'unknown'}));
 assert.throws(()=>evaluate({entry:'balatro',evidence:[]}));
});
