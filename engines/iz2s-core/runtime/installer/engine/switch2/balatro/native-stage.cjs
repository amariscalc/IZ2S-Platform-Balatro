#!/usr/bin/env node
'use strict';
// Guarded two-stage verification; the native target is NEVER invoked.
const {inspect:inspectBridge}=require('./native-bridge-check.cjs');
const {inspect:inspectDeclaration}=require('./native-declare-check.cjs');
async function run(host,options={},bridge=inspectBridge,declaration=inspectDeclaration){
 const base={backend:'balatro',mode:'native-transport-staging',
  nativeFunctionCalled:false,privilegedSessionVerified:false,
  nativeCoreReady:false,ready:false};
 const preflight=await bridge(host,options);
 if(!preflight||preflight.backend!=='balatro'||
   preflight.bridgeCodeBytesVerified!==true||
   preflight.signatureCompilerAccepted!==true||
   preflight.nativeCallAttempted!==false)
  return {...base,phase:'blocked',reason:'upstream-bridge-preflight',preflight};
 const declared=await declaration(host,options);
 if(!declared||declared.backend!=='balatro'||declared.closureConstructed!==true||
  declared.nativeFunctionCalled!==false)
  return {...base,phase:'blocked',reason:'native-declaration',preflight,declaration:declared};
 return {...base,phase:'declared-only',reason:'native-function-call-not-executed',
  preflight,declaration:declared};
}
async function main(){
 const [host,port]=process.argv.slice(2);
 if(!host){console.error('Usage: node native-stage.cjs <switch-ip> [port]');process.exitCode=2;return;}
 try{
  const r=await run(host,port?{port:Number(port)}:{});
  console.log(JSON.stringify(r,null,2));
  if(r.phase==='blocked')process.exitCode=1;
 }catch(e){
  console.error(JSON.stringify({backend:'balatro',phase:'error',ready:false,error:e.message}));
  process.exitCode=1;
 }
}
if(require.main===module)main();
module.exports={run};
