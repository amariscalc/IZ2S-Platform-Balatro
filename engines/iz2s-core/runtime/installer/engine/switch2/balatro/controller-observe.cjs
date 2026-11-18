#!/usr/bin/env node
'use strict';
// Read-only, title-local Lua application telemetry: no FFI or native operations.
const {request}=require('./rpc.cjs');
const PROBE=[
 'local a=rawget(_G,"__IZ2S_BALATRO_APP_V1")',
 'if type(a)~="table" then return "IZ2S_INPUT_V1;phase=idle" end',
 'local h=love and love.handlers',
 'local c=package.loaded["bl.console"]',
 'local gp=type(h)=="table" and type(a.inputHooks)=="table" and a.inputHooks.gamepadpressed',
 'local kb=type(h)=="table" and type(a.inputHooks)=="table" and a.inputHooks.keypressed',
 'local overlay=type(c)=="table" and a.overlayDraw~=nil and c.draw==a.overlayDraw',
 'local gamepad=gp~=nil and h.gamepadpressed==gp.wrapper',
 'local keyboard=kb~=nil and h.keypressed==kb.wrapper',
 'return "IZ2S_INPUT_V1;phase=running;menu="..tostring(a.menu)',
 ' .. ";page="..tostring(a.page)..";steps="..tostring(a.steps)',
 ' .. ";overlay="..tostring(overlay)..";gamepad="..tostring(gamepad)',
 ' .. ";keyboard="..tostring(keyboard)..";drawFault="..tostring(a.drawFault==true)',
].join('\n');
function parse(reply){
 if(typeof reply!=='string'||!reply.startsWith('-> IZ2S_INPUT_V1;'))throw Error('Unexpected input telemetry framing');
 const data=reply.slice(3).trim();
 if(data==='IZ2S_INPUT_V1;phase=idle')return {phase:'idle'};
 const m=/^IZ2S_INPUT_V1;phase=running;menu=([1-5]);page=(home|status|about);steps=(0|[1-9][0-9]{0,8});overlay=(true|false);gamepad=(true|false);keyboard=(true|false);drawFault=(true|false)$/.exec(data);
 if(!m)throw Error('Invalid input telemetry');
 return {phase:'running',menu:Number(m[1]),page:m[2],steps:Number(m[3]),
  overlay:m[4]==='true',gamepad:m[5]==='true',keyboard:m[6]==='true',drawFault:m[7]==='true',
  nativeCoreLaunched:false};
}
async function observe(host,options={},send=request){
 return parse(await send({host,lua:PROBE,port:9026,timeoutMs:5000,...options}));
}
async function main(){
 const [host,port]=process.argv.slice(2);
 if(!host){console.error('Usage: node controller-observe.cjs <switch-ip> [port]');process.exitCode=2;return;}
 try{process.stdout.write(JSON.stringify(await observe(host,port?{port:Number(port)}:{}),null,2)+'\n');}
 catch(e){console.error(JSON.stringify({ok:false,error:e.message}));process.exitCode=1;}
}
if(require.main===module)main();
module.exports={PROBE,parse,observe};
