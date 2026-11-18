'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {STAGES,OBSERVED,assess}=require('../engines/iz2s-core/runtime/installer/engine/switch2/balatro/readiness-gap.cjs');
test('readiness stages map to original IZ2S source and remain blocked',()=>{
 const r=assess();
 assert.equal(r.stages.length,7);
 assert.deepEqual(r.stages.map(x=>x.stage),[
  'connection','native-functions','mapped-scratch','addressable-memory',
  'service-ipc','ro-mapping','core-boot']);
 assert.ok(r.stages.every(x=>!x.supported));
 assert.equal(r.nativeTransportReady,false);
 assert.equal(r.ipcVerified,false);
 assert.equal(r.nroLoaderVerified,false);
 assert.equal(r.nativeCoreReady,false);
 assert.equal(r.ready,false);
});
test('local RPC, real SDK calls and persistent owned buffers do not grant native access',()=>{
 const r=assess(OBSERVED);
 assert.equal(r.observed.nativeGetterCall,true);
 assert.equal(r.observed.nativeMemcpyOwned,true);
 assert.equal(r.observed.persistentOwnedHandles,true);
 assert.equal(r.unsupported.arbitraryAddressReadWrite,true);
 assert.equal(r.unsupported.processMappingQuery,true);
 assert.equal(r.unsupported.serviceIpc,true);
 assert.equal(r.nativeCoreReady,false);
});
test('injected readiness flags cannot override native gaps',()=>{
 const r=assess({...OBSERVED,ready:true,nativeCoreReady:true,
  arbitraryAddressReadWrite:true,serviceIpc:true,nroMapping:true});
 assert.ok(r.stages.every(x=>!x.supported));
 assert.equal(r.nativeCoreReady,false);
 assert.equal(r.ready,false);
});
test('invalid summary cannot be evaluated',()=>{
 assert.throws(()=>assess(null));
 assert.throws(()=>assess([]));
});
