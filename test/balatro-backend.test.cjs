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
  launcherActivity:async(host,options)=>{
   calls.push(['launcher-activity',host,options]);
   return {phase:'running',renderedFrames:42,physicalGamepadEvents:3,ready:false};
  },
  launcherTelemetry:async(host,options)=>{
   calls.push(['launcher-telemetry',host,options]);
   return {backend:'balatro',mode:'read-only-launcher-telemetry',
    legacy:'idle',launcher:'active',ownedBuffers:0,ownedBytes:0,ready:false};
  },
  launcherExecute:async(host,op,options)=>{
   calls.push(['launcher',host,op,options]);
   return {backend:'balatro',phase:'running',menu:1,page:'home',nativeCoreReady:false,ready:false};
  },
  launcherIntegration:async(host,options)=>{
   calls.push(['launcher-integration',host,options]);
   return {backend:'balatro',phase:'verified',nativeCoreLaunched:false,ready:false};
  },
  ownedRegistry:async(host,operation,args,options)=>{
   calls.push(['registry',host,operation,args,options]);
   return {op:operation,state:'ok',value:1,ready:false};
  },
  persistentMemorySuite:async(host,options)=>{
   calls.push(['persistent-suite',host,options]);
   return {backend:'balatro',phase:'verified',nativeCoreReady:false,ready:false};
  },
  ownedHandlesSmoke:async(host,options)=>{
   calls.push(['owned-handles',host,options]);
   return {backend:'balatro',mode:'scoped-owned-handles',boundsVerified:true,ready:false};
  },
  memorySuite:async(host,options)=>{
   calls.push(['memory-suite',host,options]);
   return {backend:'balatro',mode:'memory-capability-suite',phase:'scoped-memory-verified',ready:false};
  },
  ownedLifecycleSmoke:async(host,options)=>{
   calls.push(['owned-lifecycle',host,options]);
   return {backend:'balatro',mode:'owned-lua-ffi-lifecycle',
    allocationVerified:true,nativeHeapFreeVerified:false,ready:false};
  },
  nativeCallSmoke:async(host,options)=>{
   calls.push(['native-call',host,options]);
   return {backend:'balatro',mode:'read-only-sdk-native-call',nativeCallVerified:true,ready:false};
  },
  ownedBufferSmoke:async(host,options)=>{
   calls.push(['owned-buffer',host,options]);
   return {backend:'balatro',mode:'self-owned-ffi-buffer',readWriteVerified:true,ready:false};
  },
  declarationPreflight:async(host,options)=>{
   calls.push(['declaration-preflight',host,options]);
   return {backend:'balatro',mode:'native-declaration-only',closureConstructed:true,
    nativeFunctionCalled:false,ready:false};
  },
  bridgePreflight:async(host,options)=>{
   calls.push(['bridge-preflight',host,options]);
   return {backend:'balatro',mode:'upstream-native-bridge-preflight',
    bridgeCodeBytesVerified:true,signatureCompilerAccepted:true,
    nativeCallAttempted:false,ready:false};
  },
  ffiNames:async(host,options)=>{
   calls.push(['ffi-names',host,options]);return {backend:'balatro',mode:'read-only-ffi-names',ready:false};
  },
  ffiProfile:async(host,options)=>{
   calls.push(['ffi-profile',host,options]);return {backend:'balatro',mode:'read-only-ffi-profile',ready:false,
    declare:{implementation:'Lua',parameters:3,varargs:false},
    invoke:{implementation:'Lua',parameters:1,varargs:true}};
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
 const ffi=await backend.inspectFfi('192.168.1.232');
 assert.equal(ffi.mode,'read-only-ffi-profile');
 assert.equal(ffi.ready,false);
 assert.deepEqual(calls.map(x=>x[0]),['probe','menu','observe','ffi-profile']);
 const plan=await backend.planFfi('192.168.1.232',{
  returnType:'u32',argumentTypes:[],address:'sdk:example'
 });
 assert.equal(plan.observedSignatureMatches,true);
 assert.equal(plan.invocationVerified,false);
 assert.equal(plan.ready,false);
 const names=await backend.inspectFfiNames('192.168.1.232');
 assert.equal(names.mode,'read-only-ffi-names');
 assert.equal(names.ready,false);
 assert.deepEqual(calls.map(x=>x[0]),['probe','menu','observe','ffi-profile','ffi-profile','ffi-names']);
 const bridge=await backend.inspectNativeBridge('192.168.1.232');
 assert.equal(bridge.bridgeCodeBytesVerified,true);
 assert.equal(bridge.nativeCallAttempted,false);
 assert.equal(bridge.ready,false);
 assert.deepEqual(calls.map(x=>x[0]),['probe','menu','observe','ffi-profile','ffi-profile','ffi-names','bridge-preflight']);
 const declared=await backend.inspectNativeDeclaration('192.168.1.232');
 assert.equal(declared.closureConstructed,true);
 assert.equal(declared.nativeFunctionCalled,false);
 assert.equal(declared.ready,false);
 assert.deepEqual(calls.map(x=>x[0]),['probe','menu','observe','ffi-profile','ffi-profile',
  'ffi-names','bridge-preflight','declaration-preflight']);
 const native=await backend.inspectNativeCall('192.168.1.232');
 assert.equal(native.nativeCallVerified,true);
 assert.equal(native.ready,false);
 const owned=await backend.inspectOwnedBuffer('192.168.1.232');
 assert.equal(owned.readWriteVerified,true);
 assert.equal(owned.ready,false);
 assert.deepEqual(calls.map(x=>x[0]),['probe','menu','observe','ffi-profile','ffi-profile',
  'ffi-names','bridge-preflight','declaration-preflight','native-call','owned-buffer']);
 const lifecycle=await backend.inspectOwnedLifecycle('192.168.1.232');
 assert.equal(lifecycle.allocationVerified,true);
 assert.equal(lifecycle.nativeHeapFreeVerified,false);
 assert.equal(lifecycle.ready,false);
 assert.deepEqual(calls.map(x=>x[0]),['probe','menu','observe','ffi-profile','ffi-profile',
  'ffi-names','bridge-preflight','declaration-preflight','native-call','owned-buffer','owned-lifecycle']);
 const handles=await backend.inspectOwnedHandles('192.168.1.232');
 assert.equal(handles.boundsVerified,true);
 assert.equal(handles.ready,false);
 const suite=await backend.verifyMemorySuite('192.168.1.232');
 assert.equal(suite.phase,'scoped-memory-verified');
 assert.equal(suite.ready,false);
 assert.deepEqual(calls.map(x=>x[0]),['probe','menu','observe','ffi-profile','ffi-profile',
  'ffi-names','bridge-preflight','declaration-preflight','native-call','owned-buffer',
  'owned-lifecycle','owned-handles','memory-suite']);
 const registry=await backend.ownedRegistry('192.168.1.232','status',[]);
 assert.equal(registry.ready,false);
 const persistent=await backend.verifyPersistentMemory('192.168.1.232');
 assert.equal(persistent.phase,'verified');
 assert.equal(persistent.nativeCoreReady,false);
 assert.equal(persistent.ready,false);
 assert.deepEqual(calls.map(x=>x[0]),['probe','menu','observe','ffi-profile','ffi-profile',
  'ffi-names','bridge-preflight','declaration-preflight','native-call','owned-buffer',
  'owned-lifecycle','owned-handles','memory-suite','registry','persistent-suite']);
 const gap=backend.assessNativeReadiness();
 assert.equal(gap.stages.length,7);
 assert.equal(gap.nativeCoreReady,false);
 assert.equal(gap.ready,false);
 const launcher=await backend.launcher('192.168.1.232','start');
 assert.equal(launcher.nativeCoreReady,false);
 const verified=await backend.verifyLauncher('192.168.1.232');
 assert.equal(verified.phase,'verified');
 assert.equal(verified.nativeCoreLaunched,false);
 assert.equal(verified.ready,false);
 assert.deepEqual(calls.map(x=>x[0]),['probe','menu','observe','ffi-profile','ffi-profile',
  'ffi-names','bridge-preflight','declaration-preflight','native-call','owned-buffer',
  'owned-lifecycle','owned-handles','memory-suite','registry','persistent-suite',
  'launcher','launcher-integration']);
 const telemetry=await backend.inspectLauncherTelemetry('192.168.1.232');
 assert.equal(telemetry.launcher,'active');
 assert.equal(telemetry.ready,false);
 assert.deepEqual(calls.map(x=>x[0]),['probe','menu','observe','ffi-profile','ffi-profile',
  'ffi-names','bridge-preflight','declaration-preflight','native-call','owned-buffer',
  'owned-lifecycle','owned-handles','memory-suite','registry','persistent-suite',
  'launcher','launcher-integration','launcher-telemetry']);
 const activity=await backend.inspectLauncherActivity('192.168.1.232');
 assert.equal(activity.renderedFrames,42);
 assert.equal(activity.physicalGamepadEvents,3);
 assert.equal(activity.ready,false);
 assert.deepEqual(calls.map(x=>x[0]),['probe','menu','observe','ffi-profile','ffi-profile',
  'ffi-names','bridge-preflight','declaration-preflight','native-call','owned-buffer',
  'owned-lifecycle','owned-handles','memory-suite','registry','persistent-suite',
  'launcher','launcher-integration','launcher-telemetry','launcher-activity']);
 assert.equal(typeof backend.inspectCanonicalLauncher,'function');
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
