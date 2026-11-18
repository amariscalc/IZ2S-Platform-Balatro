'use strict';
const {evaluate,requireNativeEntry}=require('../../../../../../../core/console/sd-launcher/entry-contract.cjs');
const {inspect}=require('./native-launch-gate.cjs');
const {assess}=require('./readiness-gap.cjs');
const {create:createNativeBoundary}=require('./native-rpc-boundary.cjs');
// Keep the existing Balatro RPC and Lua diagnostics separate from the
// shared native launch contract. This function cannot launch native code.
function inspectEntry(){
 const artifacts=inspect();
 const gaps=assess();
 const contract=evaluate({entry:'balatro',evidence:{
  'native-rpc':false,
  'mapped-session':false,
  filesystem:false,
  renderer:false,
  'sdk-functions':false,
  'code-mapping':false,
  'thread-lifecycle':false,
 }});
 return {backend:'balatro',mode:'canonical-native-entry',
  artifacts:artifacts.phase,contract,
  observedLuaCapabilities:gaps.observed,
  nativeTransportReady:false,canonicalMenuReady:false,ready:false};
}
async function inspectLive(host,options={}){
 const entry=inspectEntry();
 const transport=createNativeBoundary({host,...options});
 const observation=await transport.status();
 return {...entry,mode:'canonical-native-entry-live',
  liveBoundary:observation,nativeTransportReady:false,canonicalMenuReady:false,ready:false};
}
function launchOriginal(){
 // Deliberately fail before connecting, installing hooks, calling FFI,
 // allocating title-owned memory, or touching the console.
 return requireNativeEntry({entry:'balatro'});
}
async function main(){
 const [action='inspect',host]=process.argv.slice(2);
 if(!['inspect','live','launch'].includes(action)||(action==='live'&&!host)){
  console.error('Usage: node canonical-entry.cjs inspect|launch|live <switch-ip>');process.exitCode=2;return;
 }
 try{
  const report=action==='inspect'?inspectEntry():action==='live'?await inspectLive(host):launchOriginal();
  console.log(JSON.stringify(report,null,2));
 }catch(e){
  console.error(JSON.stringify({code:e.code||'IZ2S_ENTRY_ERROR',
   error:e.message,missing:e.report?.missing,ready:false},null,2));
  process.exitCode=1;
 }
}
if(require.main===module)main();
module.exports={inspectEntry,inspectLive,launchOriginal};
