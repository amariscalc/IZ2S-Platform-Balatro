#!/usr/bin/env node
'use strict';
// Single grouped launcher verification: read-only state, UI navigation,
// cleanup and final state. Never touches an existing launcher or legacy app.
const {inspect:telemetry}=require('./launcher-telemetry.cjs');
const {run:launcherTest}=require('./launcher-integration.cjs');
const {assess}=require('./readiness-gap.cjs');
async function run(host,options={},inspect=telemetry,test=launcherTest){
 const prior=await inspect(host,options);
 if(prior.launcher!=='idle'||prior.legacy!=='idle')
  return {backend:'balatro',phase:'blocked',blocker:'existing-frontend',prior,
   nativeCoreReady:false,ready:false};
 const navigation=await test(host,options);
 if(navigation.phase!=='verified'||navigation.nativeCoreLaunched!==false)
  throw Error('Launcher integration did not finish safely');
 const after=await inspect(host,options);
 if(after.launcher!=='idle'||after.legacy!=='idle')
  throw Error('Frontend remained active after integration cleanup');
 const gap=assess();
 return {backend:'balatro',mode:'consolidated-launcher-verification',
  phase:'verified',prior,navigation,after,
  readiness:{stagesBlocked:gap.stages.filter(s=>!s.supported).length,
   nativeTransportReady:gap.nativeTransportReady,ipcVerified:gap.ipcVerified,
   nativeCoreReady:gap.nativeCoreReady},
  visualRenderingObserved:false,
  controllerEventsObserved:false,
  titleLocalRpcVerified:true,
  nativeCoreReady:false,ready:false};
}
async function main(){
 const [host,portArg]=process.argv.slice(2);
 if(!host){console.error('Usage: node launcher-suite.cjs <switch-ip> [port]');process.exitCode=2;return;}
 try{
  const r=await run(host,portArg?{port:Number(portArg)}:{});
  console.log(JSON.stringify(r,null,2));
  if(r.phase!=='verified')process.exitCode=1;
 }catch(e){console.error(JSON.stringify({backend:'balatro',phase:'error',ready:false,error:e.message}));process.exitCode=1;}
}
if(require.main===module)main();
module.exports={run};
