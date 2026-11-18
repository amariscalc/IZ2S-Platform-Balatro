#!/usr/bin/env node
'use strict';
// Read-only counters for actual rendered frames and physical controller events.
// Unlike synthetic RPC navigation, these counters are incremented in the
// draw callback and live LOVE input handlers.
const {request}=require('./rpc.cjs');
const LUA=[
 'local a=rawget(_G,"__IZ2S_BALATRO_LAUNCHER_V1")',
 'if type(a)~="table" then return "IZ2S_ACTIVITY_V1;phase=idle" end',
 'local function count(key)',
 ' local n=a[key]',
 ' if type(n)~="number" or n~=math.floor(n) or n<0 or n>999999999 then return nil end',
 ' return n',
 'end',
 'local f,e,g,k=count("drawFrames"),count("drawErrors"),count("gamepadEvents"),count("keyboardEvents")',
 'if not f or not e or not g or not k then return "IZ2S_ACTIVITY_V1;phase=invalid" end',
 'return "IZ2S_ACTIVITY_V1;phase=running;frames="..f..";errors="..e..',
 ' ";gamepad="..g..";keyboard="..k..";fault="..tostring(a.drawFault==true)',
].join('\n');
function parse(reply){
 if(typeof reply!=='string'||!reply.startsWith('-> '))throw Error('Invalid launcher activity framing');
 const raw=reply.slice(3).trim();
 if(raw==='IZ2S_ACTIVITY_V1;phase=idle')return {phase:'idle',ready:false};
 if(raw==='IZ2S_ACTIVITY_V1;phase=invalid')throw Error('Corrupt launcher activity counters');
 const m=/^IZ2S_ACTIVITY_V1;phase=running;frames=(0|[1-9][0-9]{0,8});errors=(0|[1-9][0-9]{0,8});gamepad=(0|[1-9][0-9]{0,8});keyboard=(0|[1-9][0-9]{0,8});fault=(true|false)$/.exec(raw);
 if(!m)throw Error('Invalid launcher activity response');
 return {phase:'running',renderedFrames:Number(m[1]),drawErrors:Number(m[2]),
  physicalGamepadEvents:Number(m[3]),physicalKeyboardEvents:Number(m[4]),
  drawFault:m[5]==='true',nativeCoreReady:false,ready:false};
}
async function inspect(host,options={},send=request){
 return parse(await send({host,port:9026,timeoutMs:5000,lua:LUA,...options}));
}
async function main(){
 const [host,portArg]=process.argv.slice(2);
 if(!host){console.error('Usage: node launcher-activity.cjs <switch-ip> [port]');process.exitCode=2;return;}
 try{console.log(JSON.stringify(await inspect(host,portArg?{port:Number(portArg)}:{}),null,2));}
 catch(e){console.error(JSON.stringify({phase:'error',ready:false,error:e.message}));process.exitCode=1;}
}
if(require.main===module)main();
module.exports={LUA,parse,inspect};
