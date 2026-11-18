#!/usr/bin/env node
'use strict';
// One read-only Balatro Lua snapshot. Tests presence of the actual title-local
// interfaces; it deliberately does not invoke SDK functions or touch memory.
const {request}=require('./rpc.cjs');
const LUA=[
 'local b=type(love)=="table" and love.ffi or nil',
 'local a=package.loaded["bl.app"]',
 'local info=type(a)=="table" and a.info or nil',
 'local h=type(love)=="table" and love.handlers or nil',
 'local function yes(v) return v and "1" or "0" end',
 'local function present(k) return type(b)=="table" and type(b[k])=="function" end',
 'local function number(v) return type(v)=="number" and v>0 and v==math.floor(v) end',
 'return "IZ2S_CANON_PREFLIGHT_V1;ffi="..yes(type(b)=="table")',
 ' ..";declare="..yes(present("declare"))',
 ' ..";invoke="..yes(present("invoke"))',
 ' ..";readyfn="..yes(present("native_ready"))',
 ' ..";sdkinfo="..yes(type(info)=="table" and number(info.sdk_base))',
 ' ..";gamepad="..yes(type(h)=="table" and type(h.gamepadpressed)=="function")',
 ' ..";graphics="..yes(type(love)=="table" and type(love.graphics)=="table")',
].join('\n');
const FIELDS=['ffi','declare','invoke','readyfn','sdkinfo','gamepad','graphics'];
function parse(reply){
 if(typeof reply!=='string'||!reply.startsWith('-> '))throw Error('Invalid canonical preflight framing');
 const raw=reply.slice(3).trim();
 const m=/^IZ2S_CANON_PREFLIGHT_V1;ffi=([01]);declare=([01]);invoke=([01]);readyfn=([01]);sdkinfo=([01]);gamepad=([01]);graphics=([01])$/.exec(raw);
 if(!m)throw Error('Invalid canonical preflight response');
 const observed=Object.fromEntries(FIELDS.map((x,i)=>[x,m[i+1]==='1']));
 return {backend:'balatro',mode:'canonical-title-interface-preflight',
  observed,
  implications:{
   luaFfiBridge:observed.ffi&&observed.declare&&observed.invoke,
   callableSdkMetadata:observed.sdkinfo&&observed.declare,
   titleInputHook:observed.gamepad,
   loveGraphicsInterface:observed.graphics,
  },
  nativeRpcVerified:false,mappedSessionVerified:false,
  filesystemVerified:false,originalRendererVerified:false,
  executableMappingVerified:false,threadLifecycleVerified:false,
  originalLauncherExecuted:false,canonicalMenuReady:false,ready:false};
}
async function inspect(host,options={},send=request){
 return parse(await send({host,port:9026,timeoutMs:5000,lua:LUA,...options}));
}
async function main(){
 const [host,portArg]=process.argv.slice(2);
 if(!host){console.error('Usage: node canonical-preflight.cjs <switch-ip> [port]');process.exitCode=2;return;}
 try{console.log(JSON.stringify(await inspect(host,portArg?{port:Number(portArg)}:{}),null,2));}
 catch(e){console.error(JSON.stringify({backend:'balatro',ready:false,error:e.message}));process.exitCode=1;}
}
if(require.main===module)main();
module.exports={LUA,FIELDS,parse,inspect};
