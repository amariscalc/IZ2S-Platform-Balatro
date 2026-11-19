'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {audit,assess,classifyPrerequisites,REQUIRED}=require('../engines/iz2s-core/runtime/installer/engine/switch2/balatro/book-reader-native-handoff-audit.cjs');
const first={consoleSelection:{bookReaderSelected:true,launchRequests:1},packageVerified:true};
test('only a real Book Reader request and verified package trigger bounded hardware evidence',async()=>{
 const calls=[];
 const r=await audit('console','package','digest',{preflightCheck:async()=>{calls.push('preflight');return first;},
  evidenceCheck:async()=>{calls.push('evidence');return {
   observations:{luaRpc:true,nativeGetter:true},missingNativePrerequisites:REQUIRED.slice(),
   nativeTransportReady:false};}});
 assert.deepEqual(calls,['preflight','evidence']);
 assert.equal(r.requestCount,1);assert.equal(r.phase,'blocked');
 assert.deepEqual(r.nativeEntryMissing,REQUIRED);
 assert.equal(r.originalBookReaderExecuted,false);
});
test('no request or wrong app never runs native evidence checks',async()=>{
 let calls=0;
 for(const data of [
  {consoleSelection:{bookReaderSelected:true,launchRequests:0},packageVerified:true},
  {consoleSelection:{bookReaderSelected:false,launchRequests:1},packageVerified:true},
  {consoleSelection:{bookReaderSelected:true,launchRequests:1},packageVerified:false}
 ]){
  const r=await audit('console','package','digest',{preflightCheck:async()=>data,
   evidenceCheck:async()=>{calls++;throw Error('unexpected evidence probe');}});
  assert.equal(r.phase,'blocked');
 }
 assert.equal(calls,0);
});
test('reported title-local capabilities never authorize native execution',()=>{
 const result=assess(first,{observations:{luaRpc:true,nativeGetter:true,ownedMemory:true,
  nativeMemcpy:true,pcToTitleBinaryRoundtrip:true},
  missingNativePrerequisites:REQUIRED,nativeTransportReady:false});
 assert.equal(result.titleCapabilities.nativeMemcpy,true);
 assert.equal(result.ready,false);
 assert.equal(result.originalNativeSupervisorStarted,false);
 assert.ok(result.blockers.includes('native-entry-contract-not-satisfied'));
});

test('reports measured title capabilities separately from unverified supervisor ownership',()=>{
 const result=classifyPrerequisites({
  observations:{luaRpc:true,nativeGetter:true,ownedMemory:true,nativeMemcpy:true,
   bookReaderTitleApisInventoried:true},
  evidence:{bookReaderResources:{
   filesystem:{readFunctionExposed:true},
   graphics:{drawFunctionExposed:true},
   threading:{titleThreadFunctionExposed:true},
  }}
 });
 assert.deepEqual(result.map(x=>x.id),REQUIRED);
 assert.equal(result.find(x=>x.id==='filesystem').state,'partial-title-only');
 assert.equal(result.find(x=>x.id==='renderer').state,'partial-title-only');
 assert.equal(result.find(x=>x.id==='code-mapping').state,'not-verified');
 assert.ok(result.every(x=>x.verified===false));
});
test('absent hardware evidence is not reported as a failed native test',()=>{
 const r=assess(first,null);
 assert.equal(r.nativeEntryAssessment,'unverified-prerequisites-not-individual-failures');
 assert.ok(r.nativePrerequisites.every(x=>x.state==='not-verified'));
 assert.equal(r.originalBookReaderExecuted,false);
});
test('hardware probe errors remain visible and do not turn into supervisor readiness',()=>{
 const r=assess(first,{observations:{luaRpc:true},issues:['nativeOwnedMemcpy'],
 missingNativePrerequisites:REQUIRED,nativeTransportReady:false});
 assert.deepEqual(r.evidenceIssues,['nativeOwnedMemcpy']);
 assert.equal(r.ready,false);
});
