'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {FILES,CHECKS,analyze}=require('../engines/iz2s-core/runtime/installer/engine/switch2/balatro/static-compatibility.cjs');
test('all expected source markers are present but native readiness stays false',()=>{
  const r=analyze();
  assert.equal(r.checked,9);
  assert.equal(r.sourceConsistency,true);
  assert.equal(r.contactedConsole,false);
  assert.equal(r.executedNativeCalls,false);
  assert.equal(r.ready,false);
  assert.ok(r.checks.every(x=>x.sourceMarkersPresent&&!x.runtimeVerified));
});
test('missing source marker is reported and does not imply compatibility',()=>{
  const x=analyze(key=>key==='nro'?'// no loader':CHECKS.find(c=>c.file===key).markers.join('\n'));
  assert.equal(x.sourceConsistency,false);
  assert.equal(x.ready,false);
  assert.ok(x.checks.some(c=>c.id==='ro-service'&&c.missingMarkers.length>0));
});
test('source audit only refers to explicitly defined local files',()=>{
  for(const check of CHECKS){
    assert.ok(Object.hasOwn(FILES,check.file));
    assert.ok(check.markers.length>=2);
  }
});

test('relative source paths resolve from engine root, not switch2',()=>{
  const path=require('node:path');
  const fs=require('node:fs');
  const engineRoot=path.resolve(__dirname,'../engines/iz2s-core/runtime/installer/engine');
  for(const file of Object.values(FILES)){
    assert.equal(fs.existsSync(path.join(engineRoot,file)),true,'Cannot find '+file);
  }
  assert.doesNotThrow(()=>analyze());
});
