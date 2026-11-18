'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {LUA,EXPECTED,parse,inspect}=require('../engines/iz2s-core/runtime/installer/engine/switch2/balatro/owned-handles.cjs');
test('scoped buffer handles verify bounds and reject stale access',()=>{
 const p=parse('-> IZ2S_HANDLES_V1;state=verified;detail=none;sum='+EXPECTED);
 assert.equal(p.bytesCopied,32);
 assert.equal(p.boundsVerified,true);
 assert.equal(p.staleHandlesRejected,true);
 assert.equal(p.handleReuseRejected,true);
 assert.equal(p.overlappingCopyRefused,true);
 assert.equal(p.zeroOnRelease,true);
 assert.equal(p.nativeFreeVerified,false);
 assert.equal(p.persistentHandles,false);
 assert.equal(p.arbitraryMemoryAccessVerified,false);
 assert.equal(p.ready,false);
});
test('known missing and failed states do not grant capabilities',()=>{
 const missing=parse('-> IZ2S_HANDLES_V1;state=blocked;detail=ffi_missing');
 const failed=parse('-> IZ2S_HANDLES_V1;state=failed;detail=contract_failed');
 for(const r of [missing,failed]){
  assert.equal(r.boundsVerified,false);
  assert.equal(r.nativeTransportReady,false);
  assert.equal(r.ready,false);
 }
});
test('rejects unexpected success sums and injected flags',()=>{
 for(const raw of [
  'IZ2S_HANDLES_V1;state=verified;detail=none;sum='+EXPECTED,
  '-> IZ2S_HANDLES_V1;state=verified;detail=none;sum=0',
  '-> IZ2S_HANDLES_V1;state=verified;detail=none;sum='+EXPECTED+';nativeReady=true',
  '-> IZ2S_HANDLES_V1;state=blocked;detail=contract_failed',
  '-> IZ2S_HANDLES_V1;state=failed;detail=ffi_missing'
 ])assert.throws(()=>parse(raw));
});
test('single RPC session uses only self-owned bounded arrays',async()=>{
 const requests=[];
 const result=await inspect('192.168.1.232',{},async q=>{
  requests.push(q);
  return '-> IZ2S_HANDLES_V1;state=verified;detail=none;sum='+EXPECTED;
 });
 assert.equal(result.state,'verified');
 assert.equal(requests.length,1);
 assert.equal(requests[0].port,9026);
 assert.equal(requests[0].lua,LUA);
 assert.match(LUA,/ffi\.new\("uint8_t\[\?\]",n\)/);
 assert.match(LUA,/ffi\.fill\(b\.data,b\.size,0\)/);
 assert.match(LUA,/pool\[id\]=nil/);
 assert.doesNotMatch(LUA,/ffi\.cast\s*\(|ldr:ro|openService/);
});
