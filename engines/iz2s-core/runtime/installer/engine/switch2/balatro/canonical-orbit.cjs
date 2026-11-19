#!/usr/bin/env node
'use strict';
// Coordinated launch of the read-only Balatro ORBIT FOCUS visual frontend.
// Native IZ2S startup, SD install and privileged access are intentionally absent.
const focus=require('./canonical-focus.cjs');
const catalog=require('./canonical-catalog.cjs');
const artwork=require('./canonical-visual-assets.cjs');
async function launch(host,{port=9026,images=true,focusExecute=focus.execute,
 publishCatalog=catalog.publish,uploadArt=artwork.upload}={}){
 const options={port};
 const started=await focusExecute(host,'start',options);
 if(started.phase!=='running')return {started,catalog:null,artwork:null,ready:false};
 const inventory=await publishCatalog(host,options);
 let graphics={state:'disabled',loaded:0,skipped:0};
 if(images){
  try{
   const result=await uploadArt(host,options);
   graphics={state:result.skipped?'partial':'uploaded',loaded:result.loaded,
    skipped:result.skipped,results:result.results};
  }catch(error){
   graphics={state:'unavailable',loaded:0,error:error.message};
  }
 }
 const status=await focusExecute(host,'status',options);
 return {backend:'balatro',mode:'canonical-orbit-visual',phase:status.phase,
  visualStages:started.visualStages||[],
  visualFallback:(started.visualStages||[]).some(x=>!x.loaded),
  view:status.view,drawErrors:status.drawErrors,
  availablePackages:status.availablePackages,
  sourceCatalogEntries:status.sourceCatalogEntries,
  catalog:inventory,artwork:graphics,
  nativeSupervisorRunning:false,nativeCoreReady:false,ready:false};
}
async function main(){
 const [host,action='start',portRaw]=process.argv.slice(2);
 if(!host||!['start','status','stop','start-no-art'].includes(action)){
  console.error('Usage: node canonical-orbit.cjs <switch-ip> [start|status|stop|start-no-art] [port]');
  process.exitCode=2;return;
 }
 const port=portRaw?Number(portRaw):9026;
 try{
  const result=action==='start'||action==='start-no-art'?
   await launch(host,{port,images:action==='start'}):
   await focus.execute(host,action,{port});
  console.log(JSON.stringify(result,null,2));
  if(result.phase==='error'||result.phase==='blocked')process.exitCode=1;
 }catch(e){
  console.error(JSON.stringify({backend:'balatro',phase:'error',ready:false,error:e.message}));
  process.exitCode=1;
 }
}
if(require.main===module)main();
module.exports={launch};
