#!/usr/bin/env node
'use strict';
// Native handoff audit for one controller-originated Book Reader request.
// Uses existing, bounded probes only. Never installs or launches native code.
const {inspect:preflight}=require('./book-reader-launch-preflight.cjs');
const {inspect:evidence}=require('./native-evidence.cjs');
const REQUIRED=Object.freeze(['native-rpc','mapped-session','filesystem','renderer',
 'sdk-functions','code-mapping','thread-lifecycle']);
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
  nativeEntryMissing:missing,blockers:reason,
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
module.exports={REQUIRED,assess,audit};
