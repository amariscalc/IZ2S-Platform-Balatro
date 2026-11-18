'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {LUA,parse,inspect}=require('../engines/iz2s-core/runtime/installer/engine/switch2/balatro/ffi-names.cjs');
test('reads parameter names and upvalue counts without reading values',()=>{
 const p=parse('-> IZ2S_FFI_NAMES_V1;declare=ret,args,addr@2;invoke=fn@1');
 assert.deepEqual(p.declare,{available:true,parameters:['ret','args','addr'],upvalueCount:2});
 assert.deepEqual(p.invoke,{available:true,parameters:['fn'],upvalueCount:1});
 assert.equal(p.ffiCalled,false);
 assert.equal(p.upvalueValuesRead,false);
 assert.equal(p.ready,false);
});
test('unavailable Lua introspection is represented explicitly',()=>{
 const p=parse('-> IZ2S_FFI_NAMES_V1;declare=unavailable;invoke=unavailable');
 assert.equal(p.declare.available,false);
 assert.equal(p.invoke.available,false);
});
test('parser rejects injected and malformed replies',()=>{
 for(const reply of [
  'IZ2S_FFI_NAMES_V1;declare=ret@0;invoke=fn@0',
  '-> IZ2S_FFI_NAMES_V1;declare=ret@33;invoke=fn@0',
  '-> IZ2S_FFI_NAMES_V1;declare=ret,args;invoke=fn@0',
  '-> IZ2S_FFI_NAMES_V1;declare=ret@0;invoke=fn@0;ready=true',
  '-> IZ2S_FFI_NAMES_V1;declare=ret,1addr@0;invoke=fn@0',
 ])assert.throws(()=>parse(reply));
});
test('live probe contains only metadata reads and no FFI invocation',async()=>{
 const calls=[];
 const p=await inspect('192.168.1.232',{},async req=>{
  calls.push(req);
  return '-> IZ2S_FFI_NAMES_V1;declare=ret,args,addr@2;invoke=fn@1';
 });
 assert.equal(p.ready,false);
 assert.equal(calls.length,1);
 assert.equal(calls[0].lua,LUA);
 assert.equal(calls[0].port,9026);
 assert.match(LUA,/dbg\.getlocal/);
 assert.doesNotMatch(LUA,/bridge\s*\.\s*(declare|invoke)\s*\(/);
});
