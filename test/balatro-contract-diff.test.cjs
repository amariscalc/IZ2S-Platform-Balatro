'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {ROOT,SOURCES,CONTRACTS,audit}=require('../engines/iz2s-core/runtime/installer/engine/switch2/balatro/contract-diff.cjs');
test('contract inventory resolves local sources and documents gaps',()=>{
  for(const [key,file] of Object.entries(SOURCES)){
    assert.ok(fs.existsSync(path.join(ROOT,file)),key+': '+file);
  }
  const result=audit();
  assert.equal(result.checks.length,8);
  assert.equal(result.sourceConsistency,true);
  assert.equal(result.contactedConsole,false);
  assert.equal(result.executedNativeCalls,false);
  assert.equal(result.ready,false);
  assert.equal(result.nativeCompatibilityVerified,false);
  assert.ok(result.checks.every(c=>c.compatibility==='unverified'&&c.gap));
});
test('missing contract marker is detected without granting readiness',()=>{
  const fixture=audit(key=>key==='original'?'':CONTRACTS.find(c=>c.left===key||c.right===key)?.leftTokens.join('\n')||'');
  assert.equal(fixture.sourceConsistency,false);
  assert.equal(fixture.ready,false);
  assert.ok(fixture.checks.some(c=>c.missingMarkers.right.length>0));
});
test('contract sources and checks remain explicit',()=>{
  assert.equal(CONTRACTS.length,8);
  for(const check of CONTRACTS){
    assert.ok(Object.hasOwn(SOURCES,check.left));
    assert.ok(Object.hasOwn(SOURCES,check.right));
    assert.ok(check.leftTokens.length>0);
    assert.ok(check.rightTokens.length>0);
  }
});
