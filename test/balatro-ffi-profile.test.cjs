'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {LUA,parse,profile}=require('../engines/iz2s-core/runtime/installer/engine/switch2/balatro/ffi-profile.cjs');
test('parses Lua and C wrappers without upgrading native readiness',()=>{
 const result=parse('-> IZ2S_FFI_PROFILE_V1;declare=Lua,2,false;invoke=C,0,true');
 assert.equal(result.declare.implementation,'Lua');
 assert.equal(result.declare.parameters,2);
 assert.equal(result.invoke.implementation,'C');
 assert.equal(result.invoke.varargs,true);
 assert.equal(result.ffiCalled,false);
 assert.equal(result.nativeTransportReady,false);
 assert.equal(result.ready,false);
});
test('reports absent wrappers without assuming native availability',()=>{
 const result=parse('-> IZ2S_FFI_PROFILE_V1;declare=missing,0,false;invoke=unknown,0,false');
 assert.equal(result.declare.implementation,'missing');
 assert.equal(result.invoke.implementation,'unknown');
 assert.equal(result.nativeOperationsVerified,false);
});
test('rejects malformed, extra and out-of-range RPC replies',()=>{
 for(const reply of [
  'IZ2S_FFI_PROFILE_V1;declare=C,0,false;invoke=C,0,false',
  '-> IZ2S_FFI_PROFILE_V1;declare=Lua,101,false;invoke=C,0,false',
  '-> IZ2S_FFI_PROFILE_V1;declare=C,0,no;invoke=C,0,false',
  '-> IZ2S_FFI_PROFILE_V1;declare=C,0,false;invoke=C,0,false;ready=true',
 ])assert.throws(()=>parse(reply));
});
test('sends fixed non-invoking script through the Lua RPC',async()=>{
 const calls=[];
 const result=await profile('192.168.1.232',{},async req=>{
  calls.push(req);
  return '-> IZ2S_FFI_PROFILE_V1;declare=C,0,false;invoke=C,0,false';
 });
 assert.equal(result.ffiCalled,false);
 assert.equal(calls.length,1);
 assert.equal(calls[0].port,9026);
 assert.equal(calls[0].lua,LUA);
 assert.match(LUA,/debug\.getinfo/);
 assert.doesNotMatch(LUA,/l\s*\.\s*(invoke|declare)\s*\(/);
});
