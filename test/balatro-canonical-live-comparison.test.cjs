'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {LUA,parse,inspect}=require('../engines/iz2s-core/runtime/installer/engine/switch2/balatro/canonical-preflight.cjs');
const {evaluate,run,STAGES}=require('../engines/iz2s-core/runtime/installer/engine/switch2/balatro/canonical-live-comparison.cjs');
const RESPONSE='-> IZ2S_CANON_PREFLIGHT_V1;ffi=1;declare=1;invoke=1;readyfn=1;sdkinfo=1;gamepad=1;graphics=1';
test('live Balatro entry interfaces are observed but never interpreted as native ownership',()=>{
 const r=parse(RESPONSE);
 assert.equal(r.implications.luaFfiBridge,true);
 assert.equal(r.implications.titleInputHook,true);
 assert.equal(r.originalRendererVerified,false);
 assert.equal(r.nativeRpcVerified,false);
 assert.equal(r.canonicalMenuReady,false);
});
test('read-only probe sends one fixed Lua RPC without invoking native operations',async()=>{
 let n=0;
 const r=await inspect('192.168.1.232',{},async request=>{
  n++;assert.equal(request.port,9026);assert.equal(request.lua,LUA);return RESPONSE;
 });
 assert.equal(n,1);assert.equal(r.ready,false);
 assert.doesNotMatch(LUA,/bridge\.declare\(|ffi\.declare\(|\bpcall\(|rawset\(|sdk\.allocate|openService|write\(/);
});
test('reject malformed preflight response rather than claiming readiness',()=>{
 for(const response of [
  RESPONSE+';native=1', RESPONSE.slice(3),
  '-> IZ2S_CANON_PREFLIGHT_V1;ffi=2;declare=1;invoke=1;readyfn=1;sdkinfo=1;gamepad=1;graphics=1',
 ])assert.throws(()=>parse(response));
});
test('original menu remains blocked even when title-local interfaces are all present',()=>{
 const r=evaluate(parse(RESPONSE),{phase:'verified'});
 assert.equal(r.phase,'entry-observed-native-blocked');
 assert.equal(r.firstBlockingStage,'native-rpc');
 assert.equal(r.missingNativePrerequisites.length,7);
 assert.equal(r.verifiedNativePrerequisites.length,0);
 assert.equal(r.canonicalMenuReady,false);
 assert.equal(r.localGraphicalInputObserved,true);
});
test('unverified artifact blocks the canonical entry despite live Lua capabilities',()=>{
 const r=evaluate(parse(RESPONSE),{phase:'blocked'});
 assert.equal(r.phase,'artifact-blocked');
 assert.equal(r.imageIntegrityVerified,false);
 assert.equal(r.ready,false);
});
test('the entire comparison is one live RPC plus one offline artifact read',async()=>{
 let calls=0;
 const r=await run('192.168.1.232',{},async()=>{
  calls++;return parse(RESPONSE);
 },()=>{calls++;return {phase:'verified'};});
 assert.equal(calls,2);
 assert.equal(r.stages.length,STAGES.length);
 assert.equal(r.canonicalMenuReady,false);
});
