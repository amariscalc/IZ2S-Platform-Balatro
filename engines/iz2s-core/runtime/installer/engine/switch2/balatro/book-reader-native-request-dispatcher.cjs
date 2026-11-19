'use strict';
// Hand off ONE NEW controller-originated Book Reader intent to an ALREADY
// OWNED canonical IZ2S supervisor. No native bootstrap, RPC privilege
// escalation, executable mapping, or synthetic success.
const {inspect:preflight}=require('./book-reader-launch-preflight.cjs');
const {owned,installAndLaunch}=require('./original-book-reader-native-session.cjs');
function exact(state){
 return state?.consoleSelection?.bookReaderSelected===true &&
   state?.consoleSelection?.selectedId==='book-reader' &&
   state?.packageVerified===true &&
   Number.isSafeInteger(state.consoleSelection.launchRequests) &&
   state.consoleSelection.launchRequests>=0 &&
   state?.originalNativeSessionReady===false &&
   state?.originalApplicationExecuted===false;
}
// Explicit ownership is supplied by the trusted native host; the Balatro
// title-local RPC is never substituted for supervisor or SD storage.
async function create({host,packageFile,expectedSha256,supervisor,storage,
 inspect=preflight,launch=installAndLaunch,assertOwned=owned}={}){
 if(typeof host!=='string'||!host||/\s/.test(host))throw Error('Invalid console host');
 if(typeof packageFile!=='string'||!packageFile)throw Error('Original Book Reader package path required');
 if(!/^[a-f0-9]{64}$/.test(expectedSha256))throw Error('Original Book Reader SHA-256 required');
 if(typeof inspect!=='function'||typeof launch!=='function'||typeof assertOwned!=='function')
  throw Error('Invalid Book Reader native dispatcher dependencies');
 // Reject a Balatro-only invocation BEFORE any native operation.
 assertOwned(supervisor,storage);
 const input={packageFile,expectedSha256};
 const read=()=>inspect(host,input);
 const baseline=await read();
 if(!exact(baseline))throw Error('Book Reader detail and original package must be verified at arming');
 let observed=baseline.consoleSelection.launchRequests;
 let state='armed';
 let result=null;
 let activePoll=null;
 async function performPoll(){
  if(state!=='armed')return {phase:state,requestCount:observed,executedOnConsole:result?.executedOnConsole===true,ready:result?.ready===true};
  const snapshot=await read();
  if(!exact(snapshot)){state='closed';return {phase:'closed',reason:'selection-or-package-changed',executedOnConsole:false,ready:false};}
  const current=snapshot.consoleSelection.launchRequests;
  if(current<observed){state='closed';return {phase:'closed',reason:'title-session-reset',executedOnConsole:false,ready:false};}
  if(current===observed)return {phase:'armed',requestCount:observed,executedOnConsole:false,ready:false};
  // Do not replay an unknown sequence of controller inputs.
  if(current!==observed+1){state='closed';return {phase:'closed',reason:'multiple-unobserved-requests',executedOnConsole:false,ready:false};}
  observed=current;
  state='dispatching'; // latch before the first native operation
  try{
   assertOwned(supervisor,storage);
   result=await launch(packageFile,{supervisor,storage,expectedSha256});
   if(!result||typeof result!=='object')throw Error('Invalid original native launch receipt');
   state='completed';
   return {phase:'completed',requestCount:observed,result,
    executedOnConsole:result.executedOnConsole===true,ready:result.ready===true};
  }catch(error){
   state='failed';
   // Native operations may have had uncertain effects. Never retry automatically.
   return {phase:'failed',requestCount:observed,error:String(error?.message||error),
    executionUnverified:true,executedOnConsole:false,ready:false};
  }
 }
 // Lock the full read/validate/launch transaction. Concurrent timer callbacks
 // cannot both observe 'armed' and submit the same native launch.
 function poll(){
  if(activePoll)return activePoll;
  activePoll=performPoll();
  return activePoll.finally(()=>{activePoll=null;});
 }
 return Object.freeze({
  get state(){return state;},
  get baselineRequestCount(){return baseline.consoleSelection.launchRequests;},
  poll,
  close(){if(state==='armed')state='closed';return state;},
 });
}
module.exports={exact,create};
