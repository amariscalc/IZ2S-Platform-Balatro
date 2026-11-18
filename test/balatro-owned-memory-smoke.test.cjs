'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {LUA,parse,inspect}=require('../engines/iz2s-core/runtime/installer/engine/switch2/balatro/owned-memory-smoke.cjs');
test('owned FFI byte roundtrip verifies only local buffer',()=>{
 const r=parse('-> IZ2S_OWNED_V1;state=verified;detail=none;sum=2040');
 assert.equal(r.readWriteVerified,true);
 assert.equal(r.clearVerified,true);
 assert.equal(r.bytes,16);
 assert.equal(r.arbitraryMemoryAccessVerified,false);
 assert.equal(r.nativeCoreReady,false);
 assert.equal(r.ready,false);
});
test('missing LuaJIT and buffer failures remain explicit',()=>{
 assert.equal(parse('-> IZ2S_OWNED_V1;state=unavailable;detail=ffi_missing').state,'unavailable');
 assert.equal(parse('-> IZ2S_OWNED_V1;state=failed;detail=buffer_mismatch').state,'failed');
});
test('rejects forged or contradictory buffer reports',()=>{
 for(const raw of [
  'IZ2S_OWNED_V1;state=verified;detail=none;sum=2040',
  '-> IZ2S_OWNED_V1;state=verified;detail=none;sum=2041',
  '-> IZ2S_OWNED_V1;state=verified;detail=none;sum=2040;native=true',
  '-> IZ2S_OWNED_V1;state=failed;detail=ffi_missing',
  '-> IZ2S_OWNED_V1;state=unavailable;detail=buffer_mismatch'
 ])assert.throws(()=>parse(raw));
});
test('uses only a local 16-byte array in a single RPC request',async()=>{
 const calls=[];
 const result=await inspect('192.168.1.232',{},async options=>{
  calls.push(options);
  return '-> IZ2S_OWNED_V1;state=verified;detail=none;sum=2040';
 });
 assert.equal(result.ready,false);
 assert.equal(calls.length,1);
 assert.equal(calls[0].lua,LUA);
 assert.equal(calls[0].port,9026);
 assert.match(LUA,/ffi\.new\("uint8_t\[16\]"\)/);
 assert.match(LUA,/ffi\.fill\(buffer,16,0\)/);
 assert.doesNotMatch(LUA,/ffi\.cast\s*\(|bridge\.invoke\s*\(/);
});
