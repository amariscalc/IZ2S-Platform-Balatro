'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {inspect}=require('../engines/iz2s-core/runtime/installer/engine/switch2/balatro/native-evidence.cjs');
test('real loader evidence is sequenced and never grants native privileges',async()=>{
 const calls=[];
 const result=await inspect('192.168.1.232',{
  makeBoundary:()=>({status:async()=>{calls.push('boundary');return {titleLuaAvailable:true,nativeRpcAvailable:false};}}),
  surfaceCheck:async()=>{calls.push('surface');return {observationsOnly:true};},
  validateCalls:async()=>{calls.push('native');return {functionCallVerified:true,ownedMemoryVerified:true};},
  memcpyCheck:async()=>{calls.push('memcpy');return {copyVerified:true};},
  binaryCheck:async()=>{calls.push('binary');return {phase:'verified',bytes:64};},
 });
 assert.deepEqual(calls,['boundary','surface','native','memcpy','binary']);
 assert.deepEqual(result.observations,{
  luaRpc:true,nativeGetter:true,ownedMemory:true,nativeMemcpy:true,pcToTitleBinaryRoundtrip:true,
  loaderSurfaceInventoried:true
 });
 assert.equal(result.originalBookReaderExecuted,false);
 assert.equal(result.nativeTransportReady,false);
 assert.equal(result.originalLauncherReady,false);
 assert.equal(result.serviceIpcReady,false);
 assert.ok(result.missingNativePrerequisites.includes('thread-lifecycle'));
});
test('missing Lua endpoint blocks without touching native calls or memory',async()=>{
 let calls=0;
 const out=await inspect('192.168.1.232',{
  makeBoundary:()=>({status:async()=>({titleLuaAvailable:false})}),
  surfaceCheck:async()=>{calls++;},
  validateCalls:async()=>{calls++;},
  memcpyCheck:async()=>{calls++;},
  binaryCheck:async()=>{calls++;},
 });
 assert.equal(out.phase,'blocked');assert.equal(calls,0);
 assert.equal(out.ready,false);
});
test('failed userland or bounded binary probe remains non-authorizing',async()=>{
 const out=await inspect('192.168.1.232',{
  makeBoundary:()=>({status:async()=>({titleLuaAvailable:true})}),
  surfaceCheck:async()=>({observationsOnly:true}),
  validateCalls:async()=>{throw Error('Native call rejected')},
  memcpyCheck:async()=>({state:'blocked'}),
  binaryCheck:async()=>({phase:'blocked'}),
 });
 assert.deepEqual(out.issues,['userland']);
 assert.equal(out.observations.nativeGetter,false);
 assert.equal(out.observations.pcToTitleBinaryRoundtrip,false);
 assert.equal(out.originalLauncherReady,false);
});
