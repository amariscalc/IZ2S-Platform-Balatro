'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {FFI,LUA,parse,inspect}=require('../engines/iz2s-core/runtime/installer/engine/switch2/balatro/native-ffi-metadata.cjs');
test('strict read-only metadata inspection without native invocation',()=>{
 assert.match(LUA,/debug\.getinfo/);
 assert.match(LUA,/pcall\(dbg,f\[name\],"S"\)/);
 assert.doesNotMatch(LUA,/ffi\.invoke\(|ffi\.declare\(|fiber_switch\(|ctx_restore\(|os\.execute\(|f\.mount\(|f\.write\(/);
 assert.ok(Buffer.byteLength(LUA)<=8192);
});
test('classification is descriptive, not execution evidence',()=>{
 const r=parse('-> IZ2S_FFI_SHAPES_V1;ffi=declare:lua,describe:lua,invoke:cfunc,metatype:lua,native_ready:lua,u64_eq:lua,u64_is_zero:lua;context=1111');
 assert.equal(Object.keys(r.ffiFunctionKinds).length,FFI.length);
 assert.equal(r.ffiFunctionKinds.invoke,'cfunc');
 assert.equal(r.contextOffsetMetadataPresent.fiberSwitch,true);
 assert.equal(r.arbitraryNativeCallVerified,false);
 assert.equal(r.ready,false);
});
test('rejects missing entries, reordered names and invalid kinds',()=>{
 assert.throws(()=>parse('-> IZ2S_FFI_SHAPES_V1;ffi=declare:lua;context=1111'));
 assert.throws(()=>parse('-> IZ2S_FFI_SHAPES_V1;ffi=invoke:cfunc,describe:lua,declare:lua,metatype:lua,native_ready:lua,u64_eq:lua,u64_is_zero:lua;context=1111'));
 assert.throws(()=>parse('-> IZ2S_FFI_SHAPES_V1;ffi=declare:native,describe:lua,invoke:cfunc,metatype:lua,native_ready:lua,u64_eq:lua,u64_is_zero:lua;context=1111'));
});
test('one bounded RPC',async()=>{
 let n=0;
 const r=await inspect('192.168.1.232',{send:async options=>{
  n++;assert.equal(options.timeoutMs,5000);
  return '-> IZ2S_FFI_SHAPES_V1;ffi=declare:unknown,describe:unknown,invoke:unknown,metatype:unknown,native_ready:unknown,u64_eq:unknown,u64_is_zero:unknown;context=0000';
 }});
 assert.equal(n,1);
 assert.equal(r.ffiFunctionsCalled,false);
});
