'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {LUA,parse,inspect}=require('../engines/iz2s-core/runtime/installer/engine/switch2/balatro/native-ffi-internals.cjs');
test('read-only bounded lexical type and table name inspection',()=>{
 assert.match(LUA,/debug\.getupvalue/);
 assert.match(LUA,/debug\.getinfo/);
 assert.match(LUA,/victim==other/);
 assert.doesNotMatch(LUA,/debug\.setupvalue|ffi\.invoke\(|ffi\.declare\(|ffi\.describe\(|loadstring|os\.execute|fiber_switch\(|ctx_restore\(|mount\(/);
 assert.ok(Buffer.byteLength(LUA)<=8192);
});
test('exposes only classified field types and function kinds',()=>{
 const s='-> IZ2S_FFI_INTERNALS_V1;backend=lua;victim=cfunc;victimshared=same;table=present;fields=call:function,ready:boolean';
 const x=parse(s);
 assert.equal(x.backendFunctionKind,'lua');
 assert.equal(x.victimFunctionKind,'cfunc');
 assert.equal(x.sharedVictimIdentity,'same');
 assert.deepEqual(x.ffiCallFields,{call:'function',ready:'boolean'});
 assert.equal(x.nativeFunctionsCalled,false);
 assert.equal(x.ready,false);
});
test('rejects unknown types, duplicate keys and contradictions',()=>{
 assert.throws(()=>parse('-> IZ2S_FFI_INTERNALS_V1;backend=lua;victim=lua;victimshared=same;table=present;fields=call:pointer'));
 assert.throws(()=>parse('-> IZ2S_FFI_INTERNALS_V1;backend=lua;victim=lua;victimshared=same;table=present;fields=call:function,call:function'));
 assert.throws(()=>parse('-> IZ2S_FFI_INTERNALS_V1;backend=lua;victim=lua;victimshared=same;table=missing;fields=call:function'));
});
test('one bounded RPC',async()=>{
 let n=0;
 const r=await inspect('192.168.1.232',{send:async opts=>{
  n++;assert.equal(opts.timeoutMs,5000);assert.equal(opts.maxReplyBytes,4096);
  return '-> IZ2S_FFI_INTERNALS_V1;backend=lua;victim=lua;victimshared=different;table=present;fields=none';
 }});
 assert.equal(n,1);assert.equal(r.valuesExposed,false);
});
