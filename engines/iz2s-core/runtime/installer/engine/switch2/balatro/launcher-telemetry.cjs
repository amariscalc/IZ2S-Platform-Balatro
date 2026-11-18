#!/usr/bin/env node
'use strict';
// Read-only title-local telemetry, with no FFI calls or native pointers.
const {request}=require('./rpc.cjs');
const LUA=[
 'local old=rawget(_G,"__IZ2S_BALATRO_APP_V1")',
 'local current=rawget(_G,"__IZ2S_BALATRO_LAUNCHER_V1")',
 'local registry=rawget(_G,"__IZ2S_OWNED_REGISTRY_V1")',
 'local count,bytes=0,0',
 'if type(registry)=="table" and type(registry.buffers)=="table" then',
 ' for _,b in pairs(registry.buffers) do',
 '  if type(b)=="table" and type(b.size)=="number" then',
 '   count=count+1;bytes=bytes+b.size end',
 ' end',
 'end',
 'if count<0 or count>4 or bytes<0 or bytes>512 then',
 ' return "IZ2S_DASH_V1;state=invalid"',
 'end',
 'local g=type(love)=="table" and love.ffi or nil',
 'local oldState=type(old)=="table" and "active" or "idle"',
 'local newState=type(current)=="table" and "active" or "idle"',
 'return "IZ2S_DASH_V1;state=ok;legacy="..oldState..";launcher="..newState..',
 ' ";ffi="..tostring(type(g)=="table")..";buffers="..count..";bytes="..bytes',
].join('\n');
function parse(reply){
 if(typeof reply!=='string'||!reply.startsWith('-> '))throw Error('Invalid dashboard RPC framing');
 const raw=reply.slice(3).trim();
 if(raw==='IZ2S_DASH_V1;state=invalid')throw Error('Invalid title-owned memory registry');
 const m=/^IZ2S_DASH_V1;state=ok;legacy=(active|idle);launcher=(active|idle);ffi=(true|false);buffers=([0-4]);bytes=(0|[1-9][0-9]{0,2})$/.exec(raw);
 if(!m)throw Error('Invalid dashboard telemetry');
 const bytes=Number(m[5]);
 if(bytes>512||(Number(m[4])===0&&bytes!==0))throw Error('Inconsistent dashboard memory report');
 return {backend:'balatro',mode:'read-only-launcher-telemetry',
  legacy:m[1],launcher:m[2],ffiPresent:m[3]==='true',
  ownedBuffers:Number(m[4]),ownedBytes:bytes,
  nativeTransportReady:false,nativeCoreReady:false,ready:false};
}
async function inspect(host,options={},send=request){
 return parse(await send({host,port:9026,timeoutMs:5000,lua:LUA,...options}));
}
async function main(){
 const [host,portArg]=process.argv.slice(2);
 if(!host){console.error('Usage: node launcher-telemetry.cjs <switch-ip> [port]');process.exitCode=2;return;}
 try{console.log(JSON.stringify(await inspect(host,portArg?{port:Number(portArg)}:{}),null,2));}
 catch(e){console.error(JSON.stringify({backend:'balatro',ready:false,error:e.message}));process.exitCode=1;}
}
if(require.main===module)main();
module.exports={LUA,parse,inspect};
