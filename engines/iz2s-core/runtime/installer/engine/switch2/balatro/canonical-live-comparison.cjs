'use strict';
// Maps actual read-only Balatro interface observations to the original
// bootstrap's ownership dependencies without treating Lua hooks as native.
const {inspect:live}=require('./canonical-preflight.cjs');
const {inspect:artifacts}=require('./native-launch-gate.cjs');
const {REQUIRED}=require('../../../../../../../core/console/sd-launcher/entry-contract.cjs');
const STAGES=Object.freeze([
 {id:'native-rpc',source:'core/console/sd-launcher/bootstrap.cjs',
  requires:'Native read/write/query/call, verified code and process identity',
  observedFromLua:'TCP Lua RPC only',verified:false},
 {id:'mapped-session',source:'core/console/sd-launcher/bootstrap.cjs',
  requires:'Validated a.Session and owned mapped address-space scratch',
  observedFromLua:'Bounded title-owned buffers only',verified:false},
 {id:'filesystem',source:'core/console/sd-launcher/runtime.cjs',
  requires:'fs-rpc-state verified plus retained FS endpoint and SD root',
  observedFromLua:'No retained filesystem ownership',verified:false},
 {id:'renderer',source:'core/console/sd-launcher/runtime.cjs',
  requires:'Original GPU menu, command buffers, descriptors and display lease',
  observedFromLua:'LOVE diagnostics overlay only',verified:false},
 {id:'sdk-functions',source:'core/console/sd-launcher/bootstrap.cjs',
  requires:'Process-specific SDK, HID, Vulkan functions verified for supervisor',
  observedFromLua:'FFI bridge and previously tested socket getter',verified:false},
 {id:'code-mapping',source:'core/console/sd-launcher/bootstrap.cjs',
  requires:'ro:dmnt service, RX mapping proof and native code verification',
  observedFromLua:'No code mapping evidence',verified:false},
 {id:'thread-lifecycle',source:'core/console/sd-launcher/bootstrap.cjs',
  requires:'Verified pthread create/status/stop/join and resource release',
  observedFromLua:'No original native worker lifecycle',verified:false},
]);
function evaluate(preflight,artifact){
 if(preflight?.mode!=='canonical-title-interface-preflight'||preflight.ready!==false||
    !preflight.observed||!artifact||typeof artifact.phase!=='string')
   throw Error('Invalid canonical comparison evidence');
 const missing=STAGES.filter(s=>!s.verified).map(s=>s.id);
 if(missing.length!==REQUIRED.length||missing.some(x=>!REQUIRED.some(r=>r.id===x)))
  throw Error('Canonical prerequisite contract drift');
 const observed=preflight.observed;
 return {backend:'balatro',mode:'canonical-entry-live-comparison',
  phase:artifact.phase==='verified'?'entry-observed-native-blocked':'artifact-blocked',
  canonicalImage:'core/console/sd-launcher/native/build/launcher.bin',
  imageIntegrityVerified:artifact.phase==='verified',
  observedLuaInterfaces:observed,
  localGraphicalInputObserved:preflight.implications.titleInputHook&&
    preflight.implications.loveGraphicsInterface,
  verifiedNativePrerequisites:[],
  missingNativePrerequisites:missing,
  firstBlockingStage:missing[0],
  stages:STAGES,
  nativeTransportReady:false,canonicalMenuReady:false,ready:false};
}
async function run(host,options={},readLive=live,readArtifact=artifacts){
 const artifact=readArtifact();
 const preflight=await readLive(host,options);
 return evaluate(preflight,artifact);
}
async function main(){
 const [host,portArg]=process.argv.slice(2);
 if(!host){console.error('Usage: node canonical-live-comparison.cjs <switch-ip> [port]');process.exitCode=2;return;}
 try{console.log(JSON.stringify(await run(host,portArg?{port:Number(portArg)}:{}),null,2));}
 catch(e){console.error(JSON.stringify({backend:'balatro',phase:'error',ready:false,error:e.message}));process.exitCode=1;}
}
if(require.main===module)main();
module.exports={STAGES,evaluate,run};
