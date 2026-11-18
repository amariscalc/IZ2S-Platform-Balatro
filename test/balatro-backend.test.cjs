'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {createBalatroBackend,UnsupportedNativeCapability,NATIVE_OPERATIONS}
 =require('../engines/iz2s-core/runtime/installer/engine/switch2/balatro/backend.cjs');
function fixture(){
 const calls=[];
 const backend=createBalatroBackend({
  capabilityAudit:async(host,options)=>{
   calls.push(['probe',host,options]);
   return {backend:'balatro',capabilities:{native_declare:true,native_invoke:true,sdk_base_present:true}};
  },
  menuExecute:async(host,op,value,options)=>{
   calls.push(['menu',host,op,value,options]);
   return {phase:'running',overlay:'attached',nativeCoreLaunched:false};
  },
  menuObserve:async(host,options)=>{
   calls.push(['observe',host,options]);return {phase:'running',gamepad:true};
  },
 });
 return {backend,calls};
}
test('the Balatro backend uses live Lua APIs and never implies native readiness',async()=>{
 const {backend,calls}=fixture();
 const probe=await backend.probe('192.168.1.232',{port:9026});
 assert.equal(probe.nativeTransportReady,false);
 assert.equal(probe.nativeCoreReady,false);
 assert.equal(probe.capabilities.native_declare,true);
 const menu=await backend.menu('192.168.1.232','status');
 assert.equal(menu.phase,'running');
 const observed=await backend.observe('192.168.1.232');
 assert.equal(observed.gamepad,true);
 assert.deepEqual(calls.map(x=>x[0]),['probe','menu','observe']);
 assert.equal(backend.nativeStatus().ready,false);
});
test('all unsupported native operations reject with explicit error code',async()=>{
 const {backend,calls}=fixture();
 assert.equal(NATIVE_OPERATIONS.length,12);
 for(const op of NATIVE_OPERATIONS){
  await assert.rejects(backend[op](0,0,0),err=>{
   assert.ok(err instanceof UnsupportedNativeCapability);
   assert.equal(err.operation,op);
   assert.equal(err.code,'BALATRO_NATIVE_UNAVAILABLE');
   return true;
  });
 }
 assert.deepEqual(calls,[]);
});
test('capability responses cannot silently claim native compatibility',async()=>{
 const backend=createBalatroBackend({
  capabilityAudit:async()=>({backend:'balatro',capabilities:{
   native_declare:true,native_invoke:true,sdk_base_present:true,
   nativeOperationsVerified:true,ready:true,
  }}),
  menuExecute:async()=>({}),menuObserve:async()=>({}),
 });
 const probe=await backend.probe('192.168.1.232');
 assert.equal(probe.nativeTransportReady,false);
 assert.equal(probe.nativeCoreReady,false);
 assert.equal(backend.nativeStatus().loaderAvailable,false);
});
test('invalid injected providers are rejected',()=>{
 assert.throws(()=>createBalatroBackend({menuExecute:42}),/Invalid/);
});
