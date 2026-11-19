#!/usr/bin/env node
'use strict';
// Direct, non-invasive inventory of the actual Balatro Lua/SDK surface.
// No FFI calls, native code mapping, pointers, services, installations or writes.
const {request}=require('./rpc.cjs');
const LUA=[
 'local app=package.loaded["bl.app"]',
 'local info=type(app)=="table" and app.info or nil',
 'local off=type(info)=="table" and info.off or nil',
 'local f=type(love)=="table" and love.ffi or nil',
 'local g=type(love)=="table" and love.graphics or nil',
 'local v=type(love)=="table" and love.filesystem or nil',
 'local function yes(b) if b then return "1" else return "0" end end',
 'return "IZ2S_LOADER_SURFACE_V1"',
 ' ..";ffi="..yes(type(f)=="table" and type(f.declare)=="function")',
 ' ..";sdk="..yes(type(info)=="table" and type(info.sdk_base)=="number" and info.sdk_base>0)',
 ' ..";getter="..yes(type(off)=="table" and type(off.sock_error)=="number")',
 ' ..";memcpy="..yes(type(off)=="table" and type(off.memcpy)=="number")',
 ' ..";graphics="..yes(type(g)=="table" and type(g.present)=="function")',
 ' ..";filesystem="..yes(type(v)=="table" and type(v.read)=="function")',
 ' ..";nro="..yes(type(package.loaded["iz2s.nro"])=="table")',
 ' ..";native="..yes(type(package.loaded["iz2s.native"])=="table")',
].join('\n');
function parse(reply){
 if(typeof reply!=='string'||!reply.startsWith('-> '))throw Error('Invalid loader surface framing');
 const pattern=/^IZ2S_LOADER_SURFACE_V1;ffi=([01]);sdk=([01]);getter=([01]);memcpy=([01]);graphics=([01]);filesystem=([01]);nro=([01]);native=([01])$/;
 const m=pattern.exec(reply.slice(3).trim());
 if(!m)throw Error('Invalid loader surface response');
 const [,ffi,sdk,getter,memcpy,graphics,filesystem,nro,native]=m;
 return {backend:'balatro',mode:'in-title-loader-interface',
  available:{
   ffiDeclaration:ffi==='1',sdkBaseMetadata:sdk==='1',
   sdkGetterOffset:getter==='1',sdkMemcpyOffset:memcpy==='1',
   loveGraphicsPresent:graphics==='1',loveFilesystemPresent:filesystem==='1',
   iz2sNroModuleReported:nro==='1',iz2sNativeModuleReported:native==='1',
  },
  observationsOnly:true,
  // Presence of modules or LÖVE wrappers is not verified ABI2 loader ownership.
  nativeSessionVerified:false,consoleSdFilesystemVerified:false,
  addressableNativeRpcVerified:false,serviceIpcVerified:false,
  executableMappingVerified:false,supervisorThreadVerified:false,
  nativeTransportReady:false,originalBookReaderExecuted:false,ready:false};
}
async function inspect(host,{port=9026,send=request}={}){
 if(typeof host!=='string'||!host.trim()||/\s/.test(host))throw Error('Invalid console host');
 if(!Number.isSafeInteger(port)||port<1||port>65535)throw Error('Invalid port');
 return parse(await send({host,port,lua:LUA,timeoutMs:5000}));
}
async function main(){
 const [host,rawPort]=process.argv.slice(2);
 if(!host){console.error('Usage: node native-loader-surface.cjs <switch-ip> [port]');process.exitCode=2;return;}
 try{console.log(JSON.stringify(await inspect(host,{port:rawPort?Number(rawPort):9026}),null,2));}
 catch(e){console.error(JSON.stringify({phase:'error',backend:'balatro',ready:false,error:e.message}));process.exitCode=1;}
}
if(require.main===module)main();
module.exports={LUA,parse,inspect};
