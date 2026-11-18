'use strict';
// Shared entry contract for the ORIGINAL native IZ2S SD launcher.
// This object models ownership evidence, not an alternative menu.
// Evaluating it performs no IO and does not execute or modify native resources.
const REQUIRED=Object.freeze([
 {id:'native-rpc',description:'Original platform-2 native RPC with address-based read, write, query and call'},
 {id:'mapped-session',description:'Initialized application-owned Session with validated native allocations'},
 {id:'filesystem',description:'Retained and verified FS endpoint with SD filesystem access'},
 {id:'renderer',description:'Original IZ2S menu display, Vulkan resources, input and clean scratch'},
 {id:'sdk-functions',description:'Verified SDK/HID/Vulkan functions for this exact process'},
 {id:'code-mapping',description:'Authorized ro:dmnt executable mapping and code ownership'},
 {id:'thread-lifecycle',description:'Safe creation, status and cleanup of original supervisor thread'},
]);
const names=new Set(REQUIRED.map(x=>x.id));
function evaluate({entry,evidence={}}={}){
 if(!['smilebasic','balatro','civilization'].includes(entry))
  throw Error('Unknown canonical IZ2S entry method');
 if(!evidence||typeof evidence!=='object'||Array.isArray(evidence))
  throw Error('Invalid native entry evidence');
 // Evidence is descriptive only. An input flag cannot on its own authorize
 // executing a native binary. Concrete ownership proof belongs to bootstrap.
 const checks=REQUIRED.map(x=>({
  ...x,
  reported:evidence[x.id]===true,
  verified:false,
  reason:'Native bootstrap has not verified resource ownership and mappings',
 }));
 return {entry,kind:'canonical-iz2s-native-menu',
  requirements:checks,missing:checks.map(x=>x.id),
  evidenceOnly:true,
  originalCode:'core/console/sd-launcher/native/build/launcher.bin',
  originalBootstrap:'core/console/sd-launcher/bootstrap.cjs',
  canonicalMenuReady:false,allowNativeStart:false,ready:false};
}
class NativeEntryBlocked extends Error{
 constructor(report){
  super('Cannot start the original IZ2S console launcher from '+report.entry+
   ': verified native ownership prerequisites are missing');
  this.name='NativeEntryBlocked';
  this.code='IZ2S_NATIVE_ENTRY_NOT_READY';
  this.report=report;
 }
}
function requireNativeEntry(input){
 const report=evaluate(input);
 if(!report.allowNativeStart)throw new NativeEntryBlocked(report);
 return report;
}
module.exports={REQUIRED,evaluate,requireNativeEntry,NativeEntryBlocked};
