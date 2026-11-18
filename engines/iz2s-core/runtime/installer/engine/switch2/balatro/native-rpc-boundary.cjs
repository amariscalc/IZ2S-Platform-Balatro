#!/usr/bin/env node
'use strict';
// Real Balatro Lua-to-IZ2S entry boundary. This is NOT a native transport.
// A single fixed read-only status RPC works; memory/IPC/code methods fail
// locally, never sending a risky or invented native operation to the title.
const {request}=require('./rpc.cjs');
const LUA=[
 'local app=package.loaded["bl.app"]',
 'local info=type(app)=="table" and app.info or nil',
 'local ffi=type(love)=="table" and love.ffi or nil',
 'local socket=type(ffi)=="table" and type(ffi.native_ready)=="function"',
 'local sdk=type(info)=="table" and type(info.sdk_base)=="number" and info.sdk_base>0',
 'return "IZ2S_NATIVE_BOUNDARY_V1;lua=1;ffi="..(socket and "1" or "0")..";sdk="..(sdk and "1" or "0")',
].join('\n');
const UNSUPPORTED=Object.freeze([
 'read','write','query','call','callAddress','call3','call4',
 'verifyFunction','store64','batch','pair','openService','ipc',
 'loadNro','startCore','allocate','free','mapCode','startThread',
]);
class NativeBoundaryUnavailable extends Error{
 constructor(operation){
  super('Balatro Lua RPC does not implement the original IZ2S native operation: '+operation);
  this.name='NativeBoundaryUnavailable';
  this.code='IZ2S_NATIVE_TRANSPORT_UNAVAILABLE';
  this.operation=operation;
 }
}
function parse(reply){
 if(typeof reply!=='string'||!reply.startsWith('-> '))
  throw Error('Invalid native boundary RPC framing');
 const m=/^IZ2S_NATIVE_BOUNDARY_V1;lua=1;ffi=([01]);sdk=([01])$/.exec(reply.slice(3).trim());
 if(!m)throw Error('Invalid Balatro native boundary response');
 return Object.freeze({backend:'balatro',entryTransport:'lua-rpc',
  titleLuaAvailable:true,ffiReadyFunctionPresent:m[1]==='1',
  sdkBaseMetadataPresent:m[2]==='1',
  nativeRpcAvailable:false,arbitraryMemoryAvailable:false,
  executableMappingAvailable:false,originalLauncherReady:false,ready:false});
}
function create({host,port=9026,send=request}={}){
 if(typeof host!=='string'||!host.trim()||/\s/.test(host))
  throw Error('Invalid Balatro host');
 if(!Number.isInteger(port)||port<1||port>65535)
  throw Error('Invalid Balatro RPC port');
 if(typeof send!=='function')throw Error('Invalid Balatro transport');
 const result={
  id:'balatro',kind:'lua-rpc-boundary',port,
  async status(){
   return parse(await send({host,port,timeoutMs:5000,lua:LUA}));
  },
  async request(command){
   if(command==='status')return this.status();
   throw new NativeBoundaryUnavailable('request:'+String(command));
  },
 };
 for(const name of UNSUPPORTED)Object.defineProperty(result,name,{
  enumerable:true,
  value:async()=>{throw new NativeBoundaryUnavailable(name);},
 });
 return Object.freeze(result);
}
async function main(){
 const [host,portArg]=process.argv.slice(2);
 if(!host){console.error('Usage: node native-rpc-boundary.cjs <switch-ip> [port]');process.exitCode=2;return;}
 try{console.log(JSON.stringify(await create({host,port:portArg?Number(portArg):9026}).status(),null,2));}
 catch(e){console.error(JSON.stringify({backend:'balatro',ready:false,error:e.message}));process.exitCode=1;}
}
if(require.main===module)main();
module.exports={LUA,UNSUPPORTED,NativeBoundaryUnavailable,parse,create};
