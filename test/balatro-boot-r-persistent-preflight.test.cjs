'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {LUA,parse,execute}=require('../engines/iz2s-core/runtime/installer/engine/switch2/balatro/boot-r-persistent-preflight.cjs');
test('read-only stat and compile without executing Lua modules',()=>{
 assert.match(LUA,/love\.filesystem\.getInfo/);
 assert.match(LUA,/love\.filesystem\.load/);
 assert.doesNotMatch(LUA,/require\(|love\.filesystem\.write|ffi\.|loadstring\(/);
 assert.ok(Buffer.byteLength(LUA)<8192);
});
test('validates exactly five syntax-safe module files',()=>{
 const r=parse('-> IZ2S_RBOOT_PREFLIGHT_V1;files=11,11,11,11,11;present=5;compiled=5');
 assert.equal(r.allModulesPrepared,true);
 assert.equal(r.modulesExecuted,false);
 assert.equal(r.automaticBootVerified,false);
});
test('rejects contradictory and malformed inventory',()=>{
 assert.throws(()=>parse('-> IZ2S_RBOOT_PREFLIGHT_V1;files=01,11,11,11,11;present=4;compiled=5'));
 assert.throws(()=>parse('-> IZ2S_RBOOT_PREFLIGHT_V1;files=11,11,11,11,11;present=4;compiled=5'));
});
test('one bounded title-local request',async()=>{
 let n=0;
 const r=await execute('192.168.1.232',{send:async ({lua,timeoutMs})=>{
  n++;assert.equal(lua,LUA);assert.equal(timeoutMs,5000);
  return '-> IZ2S_RBOOT_PREFLIGHT_V1;files=11,11,11,11,11;present=5;compiled=5';
 }});
 assert.equal(n,1);assert.equal(r.allModulesPrepared,true);
});
