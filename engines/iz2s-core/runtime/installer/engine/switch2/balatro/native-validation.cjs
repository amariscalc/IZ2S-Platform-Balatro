#!/usr/bin/env node
'use strict';
// Controlled Balatro native compatibility characterization.
// No arbitrary addresses or user-provided native function arguments.
// Even complete success does not satisfy the IZ2S NRO loader prerequisites.
const {run:stage}=require('./native-stage.cjs');
const {inspect:checkCall}=require('./native-call-smoke.cjs');
const {inspect:checkOwned}=require('./owned-memory-smoke.cjs');
async function validate(host,options={},stageRun=stage,nativeCall=checkCall,ownedBuffer=checkOwned){
 const result={backend:'balatro',mode:'native-compatibility-validation',phase:'blocked',
  functionCallVerified:false,ownedMemoryVerified:false,
  arbitraryMemoryAccessVerified:false,ipcVerified:false,
  privilegedSessionVerified:false,nroLoaderVerified:false,
  nativeCoreReady:false,ready:false};
 const staging=await stageRun(host,options);
 result.staging=staging;
 if(!staging||staging.backend!=='balatro'||staging.phase!=='declared-only'||
   staging.ready!==false||staging.nativeFunctionCalled!==false){
  result.blocker='native-staging';return result;
 }
 const owned=await ownedBuffer(host,options);
 result.ownedMemory=owned;
 if(!owned||owned.backend!=='balatro'||owned.state!=='verified'||
   owned.readWriteVerified!==true||owned.clearVerified!==true||
   owned.arbitraryMemoryAccessVerified!==false){
  result.blocker='owned-buffer';return result;
 }
 result.ownedMemoryVerified=true;
 const called=await nativeCall(host,options);
 result.nativeCall=called;
 if(!called||called.backend!=='balatro'||called.state!=='called'||
   called.nativeCallVerified!==true||called.function!=='sdk:sock_error'||
   called.nativeCoreReady!==false){
  result.blocker='native-getter';return result;
 }
 result.functionCallVerified=true;
 result.phase='limited-userland-verified';
 result.blocker='native-memory-ipc-and-loader-contract';
 return result;
}
async function main(){
 const [host,portArg]=process.argv.slice(2);
 if(!host){console.error('Usage: node native-validation.cjs <switch-ip> [port]');process.exitCode=2;return;}
 try{
  const result=await validate(host,portArg?{port:Number(portArg)}:{});
  console.log(JSON.stringify(result,null,2));
  if(result.phase==='blocked')process.exitCode=1;
 }catch(error){
  console.error(JSON.stringify({backend:'balatro',phase:'error',ready:false,error:error.message}));
  process.exitCode=1;
 }
}
if(require.main===module)main();
module.exports={validate};
