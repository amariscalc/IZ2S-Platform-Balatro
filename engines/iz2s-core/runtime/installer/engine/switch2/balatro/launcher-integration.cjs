#!/usr/bin/env node
'use strict';
// Integrated launcher navigation: status, all five pages, wrap-around, exit.
// Does not touch an already-running frontend and cleans up its own session.
const {execute}=require('./launcher-menu.cjs');
const PAGES=['dashboard','rpc','memory','native','about'];
async function run(host,options={},send=execute){
 const reports=[];
 const call=async op=>{
  const result=await send(host,op,options);
  reports.push({op,phase:result.phase,menu:result.menu,page:result.page});
  return result;
 };
 const pre=await call('status');
 if(pre.phase!=='idle')throw Error('Existing IZ2S frontend is running; refusing to take ownership');
 let attempted=false,stopped=false,failure;
 try{
  attempted=true;
  let current=await call('start');
  if(current.phase!=='running'||current.menu!==1||current.page!=='home')
   throw Error('Frontend did not enter home screen');
  if(!current.overlay||!current.controls)
   throw Error('Frontend overlay or controls not attached');
  for(let i=0;i<PAGES.length;i++){
   if(i>0){
    current=await call('down');
    if(current.menu!==i+1||current.page!=='home')
     throw Error('Navigation to item '+(i+1)+' failed');
   }
   current=await call('select');
   if(current.page!==PAGES[i])throw Error('Page '+PAGES[i]+' did not open');
   current=await call('back');
   if(current.page!=='home'||current.menu!==i+1)
    throw Error('Return to home from '+PAGES[i]+' failed');
  }
  current=await call('down');
  if(current.menu!==6||current.page!=='home')throw Error('Exit item not selected');
  current=await call('down');
  if(current.menu!==1)throw Error('Menu did not wrap around');
  current=await call('up');
  if(current.menu!==6)throw Error('Menu did not wrap upward');
  current=await call('select');
  if(current.phase!=='idle')throw Error('Exit did not stop the frontend');
  stopped=true;
  return {backend:'balatro',mode:'launcher-integration',phase:'verified',
   pagesVerified:PAGES,menuWrapVerified:true,controllerHookVerified:true,
   overlayHookVerified:true,cleanupVerified:true,checks:reports.length,
   nativeCoreLaunched:false,nativeTransportReady:false,nativeCoreReady:false,ready:false};
 }catch(error){failure=error;throw error;}
 finally{
  if(attempted&&!stopped){
   try{
    const last=await call('stop');
    if(last.phase!=='idle'&&!failure)throw Error('Launcher cleanup failed');
   }catch(e){if(!failure)throw e;}
  }
 }
}
async function main(){
 const [host,portArg]=process.argv.slice(2);
 if(!host){console.error('Usage: node launcher-integration.cjs <switch-ip> [port]');process.exitCode=2;return;}
 try{console.log(JSON.stringify(await run(host,portArg?{port:Number(portArg)}:{}),null,2));}
 catch(e){console.error(JSON.stringify({backend:'balatro',phase:'blocked',ready:false,error:e.message}));process.exitCode=1;}
}
if(require.main===module)main();
module.exports={PAGES,run};
