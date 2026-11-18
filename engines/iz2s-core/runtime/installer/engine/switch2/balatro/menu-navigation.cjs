#!/usr/bin/env node
'use strict';
// Test only the title-local Lua menu; never sends native or FFI commands.
const {request}=require('./rpc.cjs');
const {script,parse:parseSession}=require('./app-session.cjs');
const STATE='local a=rawget(_G,"__IZ2S_BALATRO_APP_V1"); if not a then return "IZ2S_MENU_V1;phase=idle" end; return "IZ2S_MENU_V1;phase=running;menu="..tostring(a.menu)..";page="..tostring(a.page)..";steps="..tostring(a.steps)';
function parseState(reply){
  if(typeof reply!=='string'||!reply.startsWith('-> IZ2S_MENU_V1;'))throw Error('Invalid menu state framing');
  const raw=reply.trim().slice(3);
  if(raw==='IZ2S_MENU_V1;phase=idle')return {phase:'idle'};
  const m=/^IZ2S_MENU_V1;phase=running;menu=([1-5]);page=(home|status|about);steps=(0|[1-9][0-9]{0,8})$/.exec(raw);
  if(!m)throw Error('Malformed menu state');
  return {phase:'running',menu:Number(m[1]),page:m[2],steps:Number(m[3])};
}
async function run(host,{port=9026,timeoutMs=5000}={},send=request){
  async function rpc(lua){return send({host,port,timeoutMs,lua});}
  async function action(op){
    const result=parseSession(await rpc(script(op)));
    return result;
  }
  async function state(){return parseState(await rpc(STATE));}
  const first=await state();
  if(first.phase!=='idle')throw Error('Existing Lua menu is running; refusing to modify it');
  let started=false;
  let failure;
  try{
    started=true; // attempt may run even if its reply is lost
    const begin=await action('start');
    if(begin.phase!=='running')throw Error('Menu failed to start');
    const home=await state();
    if(home.phase!=='running'||home.page!=='home'||home.menu!==1||home.steps!==0)
      throw Error('Unexpected initial menu state');
    await action('down');
    const selected=await state();
    if(selected.menu!==2||selected.page!=='home')throw Error('Menu did not navigate down');
    await action('select');
    const updated=await state();
    if(updated.steps!==5||updated.menu!==2)throw Error('Menu selection did not update state');
    await action('down');await action('select');
    const status=await state();
    if(status.page!=='status'||status.steps!==5)throw Error('Status page not displayed');
    await action('back');
    const back=await state();
    if(back.page!=='home'||back.menu!==3)throw Error('Back navigation failed');
    return {passed:true,mode:'balatro-title-local-menu',states:{home,selected,updated,status,back},
      nativeCoreLaunched:false,ready:false};
  }catch(error){failure=error;throw error;}
  finally{
    if(started){
      try{
        const end=await action('stop');
        if(end.phase!=='idle')throw Error('Menu did not stop');
      }catch(error){
        if(!failure)throw Error('Menu cleanup failed: '+error.message);
      }
    }
  }
}
async function main(){
  const [host,portArg]=process.argv.slice(2);
  if(!host){console.error('Usage: node menu-navigation.cjs <switch-ip> [port]');process.exitCode=2;return;}
  try{console.log(JSON.stringify(await run(host,{port:portArg?Number(portArg):9026}),null,2));}
  catch(error){console.error(JSON.stringify({passed:false,ready:false,error:error.message}));process.exitCode=1;}
}
if(require.main===module)main();
module.exports={STATE,parseState,run};
