'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {LUA,EXPECTED,parse,inspect}=require('../engines/iz2s-core/runtime/installer/engine/switch2/balatro/owned-lifecycle.cjs');
test('reports the verified owned-buffer lifecycle without claiming native heap free',()=>{
 const report=parse('-> IZ2S_OWNED_LIFE_V1;state=verified;detail=none;sum='+EXPECTED);
 assert.equal(report.bytes,64);
 assert.equal(report.allocationVerified,true);
 assert.equal(report.copyVerified,true);
 assert.equal(report.readWriteVerified,true);
 assert.equal(report.zeroed,true);
 assert.equal(report.referencesReleased,true);
 assert.equal(report.nativeHeapFreeVerified,false);
 assert.equal(report.nativeTransportReady,false);
 assert.equal(report.ready,false);
});
test('missing FFI and failed verification are explicit blockers',()=>{
 assert.equal(parse('-> IZ2S_OWNED_LIFE_V1;state=blocked;detail=ffi_missing').state,'blocked');
 assert.equal(parse('-> IZ2S_OWNED_LIFE_V1;state=failed;detail=verification_failed').state,'failed');
});
test('rejects contradictory or forged lifecycle successes',()=>{
 for(const reply of [
  'IZ2S_OWNED_LIFE_V1;state=verified;detail=none;sum='+EXPECTED,
  '-> IZ2S_OWNED_LIFE_V1;state=verified;detail=none;sum=0',
  '-> IZ2S_OWNED_LIFE_V1;state=verified;detail=none;sum='+EXPECTED+';ready=true',
  '-> IZ2S_OWNED_LIFE_V1;state=failed;detail=ffi_missing',
  '-> IZ2S_OWNED_LIFE_V1;state=blocked;detail=verification_failed'
 ])assert.throws(()=>parse(reply));
});
test('single bounded RPC touches only Lua-owned FFI buffers',async()=>{
 const requests=[];
 const r=await inspect('192.168.1.232',{},async q=>{
  requests.push(q);
  return '-> IZ2S_OWNED_LIFE_V1;state=verified;detail=none;sum='+EXPECTED;
 });
 assert.equal(r.nativeTransportReady,false);
 assert.equal(requests.length,1);
 assert.equal(requests[0].lua,LUA);
 assert.equal(requests[0].port,9026);
 assert.match(LUA,/ffi\.new\("uint8_t\[64\]"\)/);
 assert.match(LUA,/ffi\.copy\(dst,src,64\)/);
 assert.match(LUA,/ffi\.fill\(src,64,0\)/);
 assert.doesNotMatch(LUA,/ffi\.cast\s*\(|openService|ldr:ro/);
});
