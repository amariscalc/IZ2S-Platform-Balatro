'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {LUA,UNSUPPORTED,parse,create}=require('../engines/iz2s-core/runtime/installer/engine/switch2/balatro/native-rpc-boundary.cjs');
test('single fixed read-only Lua status crosses the Balatro entry boundary',async()=>{
 let calls=0;
 const transport=create({host:'192.168.1.232',send:async q=>{
  calls++;assert.equal(q.host,'192.168.1.232');
  assert.equal(q.port,9026);assert.equal(q.lua,LUA);
  return '-> IZ2S_NATIVE_BOUNDARY_V1;lua=1;ffi=1;sdk=1';
 }});
 const status=await transport.status();
 assert.equal(calls,1);
 assert.equal(status.ffiReadyFunctionPresent,true);
 assert.equal(status.nativeRpcAvailable,false);
 assert.equal(status.ready,false);
});
test('all original native transport operations fail before touching Lua RPC',async()=>{
 let calls=0;
 const transport=create({host:'192.168.1.232',send:async()=>{calls++;throw Error('Unexpected RPC');}});
 for(const op of UNSUPPORTED){
  await assert.rejects(transport[op](0,0),e=>e.code==='IZ2S_NATIVE_TRANSPORT_UNAVAILABLE'&&e.operation===op);
 }
 await assert.rejects(transport.request('verify-function'),e=>e.code==='IZ2S_NATIVE_TRANSPORT_UNAVAILABLE');
 assert.equal(calls,0);
});
test('malformed or contradictory boundary replies cannot claim native readiness',()=>{
 for(const reply of [
  'IZ2S_NATIVE_BOUNDARY_V1;lua=1;ffi=1;sdk=1',
  '-> IZ2S_NATIVE_BOUNDARY_V1;lua=1;ffi=1;sdk=1;native=1',
  '-> IZ2S_NATIVE_BOUNDARY_V1;lua=1;ffi=2;sdk=1',
 ])assert.throws(()=>parse(reply));
});
test('the boundary never invokes native functions or changes title state',()=>{
 assert.doesNotMatch(LUA,/native_ready\s*\(|declare\s*\(|invoke\s*\(|ffi\.new|rawset\s*\(|memcpy\s*\(|openService\s*\(/);
 assert.throws(()=>create({host:''}),/Invalid Balatro host/);
 assert.throws(()=>create({host:'192.168.1.232',port:0}),/Invalid Balatro RPC port/);
});

test('canonical entry live method is available without changing the native launch guard',()=>{
 const entry=require('../engines/iz2s-core/runtime/installer/engine/switch2/balatro/canonical-entry.cjs');
 assert.equal(typeof entry.inspectLive,'function');
 assert.throws(()=>entry.launchOriginal(),e=>e.code==='IZ2S_NATIVE_ENTRY_NOT_READY');
});
