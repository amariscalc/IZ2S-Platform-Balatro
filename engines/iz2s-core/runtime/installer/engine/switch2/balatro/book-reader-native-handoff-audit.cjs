#!/usr/bin/env node
'use strict';
// Native handoff audit for one controller-originated Book Reader request.
// Uses existing, bounded probes only. Never installs or launches native code.
const {inspect:preflight}=require('./book-reader-launch-preflight.cjs');
const {inspect:evidence}=require('./native-evidence.cjs');
const REQUIRED=Object.freeze(['native-rpc','mapped-session','filesystem','renderer',
 'sdk-functions','code-mapping','thread-lifecycle']);
// State of each ORIGINAL supervisor requirement, not just Lua API presence.
// "partial-title-only" means a related Balatro capability was observed, but
// ownership/ABI/permissions of the canonical native supervisor are unverified.
function classifyPrerequisites(report){
 const o=report?.observations||{};
 const e=report?.evidence||{};
 const has=(v)=>v===true;
 const api=(obj,key)=>has(obj?.[key]);
 const partial={
  'native-rpc':has(o.luaRpc)&&has(o.nativeGetter),
  'mapped-session':has(o.ownedMemory)&&has(o.nativeMemcpy),
  'filesystem':has(o.bookReaderTitleApisInventoried)&&api(e.bookReaderResources?.filesystem,'readFunctionExposed'),
  'renderer':has(o.bookReaderTitleApisInventoried)&&api(e.bookReaderResources?.graphics,'drawFunctionExposed'),
  'sdk-functions':has(o.nativeGetter)&&has(o.nativeMemcpy),
  'code-mapping':false,
  'thread-lifecycle':has(o.bookReaderTitleApisInventoried)&&api(e.bookReaderResources?.threading,'titleThreadFunctionExposed'),
 };
 const notes={
  'native-rpc':'Lua RPC and one SDK getter are not address-based native RPC',
  'mapped-session':'Owned Lua buffers do not establish IZ2S mapped Session ownership',
  'filesystem':'Title-local LÖVE filesystem APIs do not establish retained SD endpoint',
  'renderer':'Title-local graphics APIs do not establish original Vulkan resources',
  'sdk-functions':'SDK getter/memcpy are only a subset of verified native functions',
  'code-mapping':'Executable image mapping and ownership have not been verified',
  'thread-lifecycle':'A title-local thread API does not establish native supervisor lifecycle'
 };
 return REQUIRED.map(id=>({
  id,
  state:partial[id]?'partial-title-only':'not-verified',
  verified:false,
  evidence:notes[id],
 }));
}
function assess(first,last){
 const selected=first?.consoleSelection;
 const reason=[];
 if(!selected?.bookReaderSelected)reason.push('book-reader-detail-not-open');
 if(!selected?.launchRequests)reason.push('controller-launch-not-requested');
 if(first?.packageVerified!==true)reason.push('original-package-not-verified');
 if(last?.observations?.luaRpc!==true)reason.push('balatro-rpc-not-confirmed');
 const missing=Array.isArray(last?.missingNativePrerequisites)
  ?REQUIRED.filter(x=>last.missingNativePrerequisites.includes(x)):REQUIRED.slice();
 if(missing.length)reason.push('native-entry-contract-not-satisfied');
 if(last?.nativeTransportReady!==true)reason.push('native-transport-unavailable');
 return {backend:'balatro',app:'book-reader',mode:'original-native-launch-handoff-audit',
  phase:'blocked',requestCount:selected?.launchRequests||0,
  packageVerified:first?.packageVerified===true,
  consoleSelectionVerified:selected?.bookReaderSelected===true,
  titleCapabilities:last?.observations||null,
  nativePrerequisites:classifyPrerequisites(last),
  nativeEntryMissing:missing,
  nativeEntryAssessment:'unverified-prerequisites-not-individual-failures',
  evidenceIssues:Array.isArray(last?.issues)?last.issues:[],
  blockers:reason,
  originalNativeSupervisorStarted:false,originalBookReaderExecuted:false,ready:false};
}
async function audit(host,packageFile,expectedSha256,{preflightCheck=preflight,evidenceCheck=evidence}={}){
 const first=await preflightCheck(host,{packageFile,expectedSha256});
 // Do not probe SDK, memory or graphics until the title identifies a real
 // controller request and the exact original package passes verification.
 if(!first.consoleSelection?.bookReaderSelected||!first.consoleSelection?.launchRequests||
    first.packageVerified!==true)return assess(first,null);
 const last=await evidenceCheck(host);
 return assess(first,last);
}
async function main(){
 const [host,file,sha]=process.argv.slice(2);
 if(!host||!file||!sha){console.error('Usage: node book-reader-native-handoff-audit.cjs <switch-ip> <original-launcher.iza> <sha256>');process.exitCode=2;return;}
 try{console.log(JSON.stringify(await audit(host,file,sha),null,2));}
 catch(error){console.error(JSON.stringify({phase:'error',ready:false,error:String(error.message||error)}));process.exitCode=1;}
}
if(require.main===module)main();
module.exports={REQUIRED,classifyPrerequisites,assess,audit};
