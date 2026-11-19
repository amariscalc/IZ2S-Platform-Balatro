#!/usr/bin/env node
'use strict';
// Live, sequential hardware evidence for the original IZ2S loader prerequisites.
// Verifies only permitted title-local capabilities; never executes a package,
// performs arbitrary memory I/O, maps NRO or contacts privileged services.
const {validate}=require('./native-validation.cjs');
const {inspect:inspectSurface}=require('./native-loader-surface.cjs');
const {inspect:inspectReaderResources}=require('./book-reader-runtime-surface.cjs');
const {inspect:memcpy}=require('./native-memcpy-smoke.cjs');
const {check:binary}=require('./owned-binary.cjs');
const {create:createBoundary}=require('./native-rpc-boundary.cjs');
const {evaluate}=require('../../../../../../../core/console/sd-launcher/entry-contract.cjs');
async function inspect(host,{port=9026,validateCalls=validate,memcpyCheck=memcpy,
 binaryCheck=binary,makeBoundary=createBoundary,surfaceCheck=inspectSurface,
 readerResourcesCheck=inspectReaderResources}={}){
 const evidence={},issues=[];
 async function run(name,fn){
  try{evidence[name]=await fn();}
  catch(error){
   evidence[name]={state:'error',error:String(error?.message||error).slice(0,300)};
   issues.push(name);
  }
 }
 await run('boundary',()=>makeBoundary({host,port}).status());
 if(!evidence.boundary?.titleLuaAvailable)
  return {backend:'balatro',mode:'original-iz2s-native-evidence',phase:'blocked',
   blocker:'lua-rpc-unavailable',evidence,issues,
   nativeTransportReady:false,originalLauncherReady:false,ready:false};
 await run('loaderSurface',()=>surfaceCheck(host,{port}));
 await run('bookReaderResources',()=>readerResourcesCheck(host,{port}));
 await run('userland',()=>validateCalls(host,{port}));
 await run('nativeOwnedMemcpy',()=>memcpyCheck(host,{port}));
 // Scoped binary check has its own unpredictable token and best-effort cleanup.
 await run('binaryTransport',()=>binaryCheck(host,{port}));
 const observations={
  luaRpc:evidence.boundary?.titleLuaAvailable===true,
  nativeGetter:evidence.userland?.functionCallVerified===true,
  ownedMemory:evidence.userland?.ownedMemoryVerified===true,
  nativeMemcpy:evidence.nativeOwnedMemcpy?.copyVerified===true,
  pcToTitleBinaryRoundtrip:evidence.binaryTransport?.phase==='verified',
  loaderSurfaceInventoried:evidence.loaderSurface?.observationsOnly===true,
  bookReaderTitleApisInventoried:evidence.bookReaderResources?.readOnly===true&&
    evidence.bookReaderResources?.titleScoped===true,

 };
 const contract=evaluate({entry:'balatro',evidence:{}});
 return {backend:'balatro',mode:'original-iz2s-native-evidence',
  phase:'title-local-characterized',observations,evidence,issues,
  missingNativePrerequisites:contract.missing,
  nativeMemoryTransportReady:false,serviceIpcReady:false,
  executableMappingReady:false,nativeTransportReady:false,
  originalLauncherReady:false,originalBookReaderExecuted:false,ready:false};
}
async function main(){
 const [host,portRaw]=process.argv.slice(2);
 if(!host){console.error('Usage: node native-evidence.cjs <switch-ip> [port]');process.exitCode=2;return;}
 try{
  const r=await inspect(host,{port:portRaw?Number(portRaw):9026});
  console.log(JSON.stringify(r,null,2));
  if(r.phase==='blocked'||r.issues.length)process.exitCode=1;
 }catch(e){
  console.error(JSON.stringify({backend:'balatro',phase:'error',ready:false,error:e.message}));
  process.exitCode=1;
 }
}
if(require.main===module)main();
module.exports={inspect};
