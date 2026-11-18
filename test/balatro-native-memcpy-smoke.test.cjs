'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {LUA,parse,inspect}=require('../engines/iz2s-core/runtime/installer/engine/switch2/balatro/native-memcpy-smoke.cjs');

test('successful SDK memcpy proves only a bounded owned-buffer copy',()=>{
 const r=parse('-> IZ2S_MEMCPY_V1;state=verified;detail=none;sum=2040');
 assert.equal(r.state,'verified');
 assert.equal(r.bytes,16);
 assert.equal(r.copyVerified,true);
 assert.equal(r.clearVerified,true);
 assert.equal(r.nativeFunctionCalled,true);
 assert.equal(r.arbitraryMemoryAccessVerified,false);
 assert.equal(r.ipcVerified,false);
 assert.equal(r.nativeCoreReady,false);
 assert.equal(r.ready,false);
});
test('unknown image, missing FFI and failed copy remain blocked',()=>{
 for(const detail of ['missing_api','preflight_rejected','offset_unavailable','ffi_missing','declaration_rejected']){
  const r=parse('-> IZ2S_MEMCPY_V1;state=blocked;detail='+detail);
  assert.equal(r.nativeFunctionCalled,false);
  assert.equal(r.copyVerified,false);
 }
 for(const detail of ['call_rejected','bytes_mismatch','clear_failed']){
  const r=parse('-> IZ2S_MEMCPY_V1;state=failed;detail='+detail);
  assert.equal(r.copyVerified,false);
 }
});
test('malformed or contradictory reports cannot masquerade as success',()=>{
 for(const reply of [
  'IZ2S_MEMCPY_V1;state=verified;detail=none;sum=2040',
  '-> IZ2S_MEMCPY_V1;state=verified;detail=none;sum=2039',
  '-> IZ2S_MEMCPY_V1;state=verified;detail=none;sum=2040;ready=true',
  '-> IZ2S_MEMCPY_V1;state=blocked;detail=call_rejected',
  '-> IZ2S_MEMCPY_V1;state=failed;detail=missing_api',
 ])assert.throws(()=>parse(reply));
});
test('single RPC script uses only self-owned arrays and an exact SDK symbol',async()=>{
 const calls=[];
 const r=await inspect('192.168.1.232',{},async args=>{
  calls.push(args);
  return '-> IZ2S_MEMCPY_V1;state=verified;detail=none;sum=2040';
 });
 assert.equal(r.copyVerified,true);
 assert.equal(calls.length,1);
 assert.equal(calls[0].lua,LUA);
 assert.equal(calls[0].port,9026);
 assert.match(LUA,/b\.native_ready/);
 assert.match(LUA,/info\.off\.memcpy/);
 assert.match(LUA,/ffi\.new\("uint8_t\[16\]"\)/);
 assert.match(LUA,/pcall\(copy,dst,src,16\)/);
 assert.doesNotMatch(LUA,/ffi\.cast\s*\(|openService|ldr:ro/);
});
