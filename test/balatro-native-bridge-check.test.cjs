'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {LUA,parse,inspect}=require('../engines/iz2s-core/runtime/installer/engine/switch2/balatro/native-bridge-check.cjs');
test('upstream verified bridge and ABI compiler report remain non-native-ready',()=>{
 const r=parse('-> IZ2S_BRIDGE_V1;state=verified;abi=accepted;detail=none');
 assert.equal(r.bridgeCodeBytesVerified,true);
 assert.equal(r.signatureCompilerAccepted,true);
 assert.equal(r.nativeCallAttempted,false);
 assert.equal(r.nativeCoreReady,false);
 assert.equal(r.ready,false);
});
test('unsupported image and missing native API are explicit blockers',()=>{
 const blocked=parse('-> IZ2S_BRIDGE_V1;state=blocked;abi=unavailable;detail=preflight_rejected');
 assert.equal(blocked.bridgeCodeBytesVerified,false);
 const missing=parse('-> IZ2S_BRIDGE_V1;state=unavailable;abi=unavailable;detail=missing');
 assert.equal(missing.signatureCompilerAccepted,false);
 const error=parse('-> IZ2S_BRIDGE_V1;state=error;abi=unavailable;detail=preflight_error');
 assert.equal(error.ready,false);
});
test('strict parser rejects contradictory and injected success claims',()=>{
 for(const reply of [
  'IZ2S_BRIDGE_V1;state=verified;abi=accepted;detail=none',
  '-> IZ2S_BRIDGE_V1;state=blocked;abi=accepted;detail=none',
  '-> IZ2S_BRIDGE_V1;state=verified;abi=accepted;detail=none;ready=true',
  '-> IZ2S_BRIDGE_V1;state=verified;abi=rejected;detail=none',
  '-> IZ2S_BRIDGE_V1;state=unknown;abi=accepted;detail=none'
 ])assert.throws(()=>parse(reply));
});
test('live probe requests only upstream preflight and pure compiler',async()=>{
 let calls=0;
 const r=await inspect('192.168.1.232',{},async req=>{
  calls++;assert.equal(req.lua,LUA);assert.equal(req.port,9026);
  return '-> IZ2S_BRIDGE_V1;state=verified;abi=accepted;detail=none';
 });
 assert.equal(calls,1);
 assert.equal(r.nativeOperationExecuted,false);
 assert.match(LUA,/b\.native_ready/);
 assert.match(LUA,/mod\.compile/);
 assert.doesNotMatch(LUA,/b\.(declare|invoke)\s*\(/);
});
