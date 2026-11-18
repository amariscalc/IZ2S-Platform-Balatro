'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {LUA,parse,inspect}=require('../engines/iz2s-core/runtime/installer/engine/switch2/balatro/native-declare-check.cjs');
test('verified image can create declaration without executing native callee',()=>{
 const result=parse('-> IZ2S_DECLARE_V1;state=created;detail=none');
 assert.equal(result.closureConstructed,true);
 assert.equal(result.nativeFunctionCalled,false);
 assert.equal(result.nativeCoreReady,false);
 assert.equal(result.ready,false);
});
test('unknown image and unsupported declaration fail closed',()=>{
 for(const detail of ['preflight_failed','offset_unavailable','declaration_rejected','description_failed']){
  const r=parse('-> IZ2S_DECLARE_V1;state=blocked;detail='+detail);
  assert.equal(r.closureConstructed,false);
  assert.equal(r.nativeFunctionCalled,false);
 }
 const absent=parse('-> IZ2S_DECLARE_V1;state=unavailable;detail=api_missing');
 assert.equal(absent.closureConstructed,false);
});
test('rejects contradictory or injected state',()=>{
 for(const reply of [
  'IZ2S_DECLARE_V1;state=created;detail=none',
  '-> IZ2S_DECLARE_V1;state=created;detail=preflight_failed',
  '-> IZ2S_DECLARE_V1;state=blocked;detail=none',
  '-> IZ2S_DECLARE_V1;state=created;detail=none;ready=true'
 ])assert.throws(()=>parse(reply));
});
test('declaration smoke only describes the closure, never calls it',async()=>{
 const calls=[];
 const r=await inspect('192.168.1.232',{},async req=>{
  calls.push(req);return '-> IZ2S_DECLARE_V1;state=created;detail=none';
 });
 assert.equal(r.nativeFunctionCalled,false);
 assert.equal(calls.length,1);
 assert.equal(calls[0].lua,LUA);
 assert.equal(calls[0].port,9026);
 assert.match(LUA,/b\.native_ready/);
 assert.match(LUA,/pcall\(b\.declare/);
 assert.match(LUA,/pcall\(b\.describe/);
 assert.doesNotMatch(LUA,/\bfn\s*\(/);
});
