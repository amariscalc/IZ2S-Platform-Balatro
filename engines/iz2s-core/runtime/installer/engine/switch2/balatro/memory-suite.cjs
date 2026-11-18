#!/usr/bin/env node
'use strict';
// Ordered memory capability check. Owns no pointers outside the Lua chunks.
// A successful report never enables the IZ2S native process transport.
const {inspect:checkLifecycle}=require('./owned-lifecycle.cjs');
const {inspect:checkHandles}=require('./owned-handles.cjs');
const {inspect:checkMemcpy}=require('./native-memcpy-smoke.cjs');
async function verify(host,options={},lifecycle=checkLifecycle,handles=checkHandles,memcpy=checkMemcpy){
 const report={backend:'balatro',mode:'memory-capability-suite',phase:'blocked',
  ownedMemoryVerified:false,handleBoundsVerified:false,nativeOwnedMemcpyVerified:false,
  persistentHandlesVerified:false,arbitraryMemoryAccessVerified:false,
  nativeHeapFreeVerified:false,ipcVerified:false,nroLoaderVerified:false,
  nativeCoreReady:false,ready:false};
 const life=await lifecycle(host,options);
 report.lifecycle=life;
 if(!life||life.backend!=='balatro'||life.state!=='verified'||
    life.allocationVerified!==true||life.zeroed!==true||
    life.nativeHeapFreeVerified!==false){
  report.blocker='owned-lifecycle';return report;
 }
 report.ownedMemoryVerified=true;
 const owner=await handles(host,options);
 report.handles=owner;
 if(!owner||owner.backend!=='balatro'||owner.state!=='verified'||
    owner.boundsVerified!==true||owner.staleHandlesRejected!==true||
    owner.handleReuseRejected!==true||owner.zeroOnRelease!==true||
    owner.persistentHandles!==false||owner.nativeFreeVerified!==false){
  report.blocker='owned-handles';return report;
 }
 report.handleBoundsVerified=true;
 const copy=await memcpy(host,options);
 report.memcpy=copy;
 if(!copy||copy.backend!=='balatro'||copy.state!=='verified'||
    copy.copyVerified!==true||copy.clearVerified!==true||
    copy.arbitraryMemoryAccessVerified!==false){
  report.blocker='native-memcpy';return report;
 }
 report.nativeOwnedMemcpyVerified=true;
 report.phase='scoped-memory-verified';
 report.blocker='persistent-resource-and-native-memory-transport';
 return report;
}
async function main(){
 const [host,portArg]=process.argv.slice(2);
 if(!host){console.error('Usage: node memory-suite.cjs <switch-ip> [port]');process.exitCode=2;return;}
 try{const r=await verify(host,portArg?{port:Number(portArg)}:{});
  console.log(JSON.stringify(r,null,2));if(r.phase==='blocked')process.exitCode=1;
 }catch(e){console.error(JSON.stringify({backend:'balatro',phase:'error',ready:false,error:e.message}));process.exitCode=1;}
}
if(require.main===module)main();
module.exports={verify};
