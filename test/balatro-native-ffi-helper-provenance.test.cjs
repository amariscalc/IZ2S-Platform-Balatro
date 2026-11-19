'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {NAMES,LUA,parse,inspect}=require('../engines/iz2s-core/runtime/installer/engine/switch2/balatro/native-ffi-helper-provenance.cjs');
const response='-> IZ2S_FFI_HELPERS_V1;'+NAMES.map((n,i)=>n+':'+(i===2?'cfunc':'lua')+':1:'+(i+1)).join(',');
test('read-only provenance does not execute FFI or expose source',()=>{
 assert.match(LUA,/debug\.getupvalue/);
 assert.match(LUA,/debug\.getinfo/);
 assert.doesNotMatch(LUA,/debug\.setupvalue|ffi\.invoke\(|ffi\.declare\(|loadstring|os\.execute|fiber_switch\(|ctx_restore\(/);
 assert.ok(Buffer.byteLength(LUA)<=8192);
});
test('bounded function identity with strict ordering',()=>{
 const r=parse(response);
 assert.equal(r.helpers.compile.kind,'lua');
 assert.equal(r.helpers.declare.kind,'cfunc');
 assert.equal(r.sourceBodiesExposed,false);
 assert.equal(r.ready,false);
});
test('rejects malformed, unknown, and reordered fields',()=>{
 assert.throws(()=>parse(response.replace('compile:lua','compile:pointer')));
 assert.throws(()=>parse(response.replace('compile:lua','construct:lua')));
 assert.throws(()=>parse(response.replace('compile:lua:1:1','compile:lua:18:1')));
});
test('single bounded RPC',async()=>{
 let n=0;
 const r=await inspect('192.168.1.232',{send:async opts=>{n++;assert.equal(opts.timeoutMs,5000);return response;}});
 assert.equal(n,1);assert.equal(r.ffiCallsPerformed,false);
});
