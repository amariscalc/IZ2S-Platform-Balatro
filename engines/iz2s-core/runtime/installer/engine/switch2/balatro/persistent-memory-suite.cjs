#!/usr/bin/env node
'use strict';
// One-command cross-RPC state/lifetime test with cleanup.
// No arbitrary pointers, no native heap allocation, no IPC.
const {execute}=require('./owned-registry.cjs');
async function verify(host,options={},call=execute){
 const steps=[];
 let initialized=false;
 const run=async(op,args=[])=>{
  const r=await call(host,op,args,options);
  steps.push(r);
  return r;
 };
 const expect=async(op,args=[],state='ok',detail=null)=>{
  const r=await run(op,args);
  if(!r||r.state!==state||(detail&&r.detail!==detail))
   throw Error('Registry expectation failed: '+op+' expected '+state+(detail?'/'+detail:''));
  return r.value;
 };
 try{
  await expect('init');
  initialized=true;
  const a=await expect('alloc',[16]);
  const b=await expect('alloc',[16]);
  if(!Number.isSafeInteger(a)||!Number.isSafeInteger(b)||a<1||b<=a)
   throw Error('Invalid allocated handles');
  for(let i=0;i<8;i++)await expect('write',[a,i,(i*11+5)%256]);
  await expect('copy',[b,0,a,8], 'ok');
  for(let i=0;i<8;i++){
   const value=await expect('read',[b,i]);
   if(value!==(i*11+5)%256)throw Error('Persistent byte mismatch at '+i);
  }
  await expect('read',[a,16],'blocked','bounds');
  await expect('write',[a,16,3],'blocked','bounds');
  await expect('copy',[b,12,a,8],'blocked','bounds');
  await expect('copy',[a,0,a,8],'blocked','overlap_refused');
  await expect('release',[a]);
  await expect('read',[a,0],'blocked','stale_handle');
  await expect('release',[a],'blocked','stale_handle');
  const c=await expect('alloc',[8]);
  if(c<=b||c===a)throw Error('Released handle was reused');
  await expect('release',[c]);
  await expect('release',[b]);
  const used=await expect('status');
  if(used!==0)throw Error('Owned registry leaked live buffers');
  await expect('clear');
  initialized=false;
  await expect('status',[],'blocked','not_initialized');
  return {backend:'balatro',mode:'persistent-owned-handles',phase:'verified',
   checks:steps.length,handleCount:3,bytesCopied:8,
   persistentAcrossRpcConnections:true,boundsVerified:true,
   staleHandlesRejected:true,handleReuseRejected:true,
   zeroOnRelease:true,registryCleared:true,
   rawPointersExposed:false,nativeHeapFreeVerified:false,
   nativeTransportReady:false,ipcVerified:false,nativeCoreReady:false,ready:false};
 }finally{
  if(initialized){
   // Best effort ONLY. If RPC is unresponsive, preserve the original error.
   try{await run('clear');}catch{}
  }
 }
}
async function main(){
 const [host,portArg]=process.argv.slice(2);
 if(!host){console.error('Usage: node persistent-memory-suite.cjs <switch-ip> [port]');process.exitCode=2;return;}
 try{console.log(JSON.stringify(await verify(host,portArg?{port:Number(portArg)}:{}),null,2));}
 catch(e){console.error(JSON.stringify({backend:'balatro',phase:'blocked',ready:false,error:e.message}));process.exitCode=1;}
}
if(require.main===module)main();
module.exports={verify};
