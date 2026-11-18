#!/usr/bin/env node
'use strict';
// Bounded native SDK memcpy of two LuaJIT-owned 16-byte arrays.
// No arbitrary pointers, services, IPC or executable loading.
const {request}=require('./rpc.cjs');
const LUA=[
 'local b=type(love)=="table" and love.ffi or nil',
 'local a=package.loaded["bl.app"]',
 'local info=type(a)=="table" and a.info or nil',
 'if type(b)~="table" or type(b.native_ready)~="function" or type(b.declare)~="function" then',
 ' return "IZ2S_MEMCPY_V1;state=blocked;detail=missing_api" end',
 'local ok,ready=pcall(b.native_ready)',
 'if not ok or ready~=true then return "IZ2S_MEMCPY_V1;state=blocked;detail=preflight_rejected" end',
 'if type(info)~="table" or type(info.sdk_base)~="number" or type(info.off)~="table" or type(info.off.memcpy)~="number" then',
 ' return "IZ2S_MEMCPY_V1;state=blocked;detail=offset_unavailable" end',
 'local loaded,ffi=pcall(require,"ffi")',
 'if not loaded then return "IZ2S_MEMCPY_V1;state=blocked;detail=ffi_missing" end',
 'local src,dst=ffi.new("uint8_t[16]"),ffi.new("uint8_t[16]")',
 'for i=0,15 do src[i]=(i*17)%256 end',
 'local declared,copy=pcall(b.declare,"void",{"void *","const void *","size_t"},info.sdk_base+info.off.memcpy)',
 'if not declared or type(copy)~="function" then return "IZ2S_MEMCPY_V1;state=blocked;detail=declaration_rejected" end',
 'local called=pcall(copy,dst,src,16)',
 'if not called then return "IZ2S_MEMCPY_V1;state=failed;detail=call_rejected" end',
 'local sum=0',
 'for i=0,15 do',
 ' local v=(i*17)%256',
 ' if tonumber(src[i])~=v or tonumber(dst[i])~=v then return "IZ2S_MEMCPY_V1;state=failed;detail=bytes_mismatch" end',
 ' sum=sum+tonumber(dst[i])',
 'end',
 'ffi.fill(src,16,0);ffi.fill(dst,16,0)',
 'for i=0,15 do if tonumber(src[i])~=0 or tonumber(dst[i])~=0 then',
 ' return "IZ2S_MEMCPY_V1;state=failed;detail=clear_failed" end end',
 'return "IZ2S_MEMCPY_V1;state=verified;detail=none;sum="..tostring(sum)',
].join('\n');
const BLOCKED=new Set(['missing_api','preflight_rejected','offset_unavailable','ffi_missing','declaration_rejected']);
const FAILED=new Set(['call_rejected','bytes_mismatch','clear_failed']);
function parse(reply){
 if(typeof reply!=='string'||!reply.startsWith('-> '))throw Error('Unexpected memcpy response framing');
 const raw=reply.slice(3).trim();
 if(raw==='IZ2S_MEMCPY_V1;state=verified;detail=none;sum=2040')
  return {backend:'balatro',mode:'self-owned-native-memcpy',state:'verified',
   function:'sdk:memcpy',bytes:16,sum:2040,nativeFunctionCalled:true,
   copyVerified:true,clearVerified:true,arbitraryMemoryAccessVerified:false,
   ipcVerified:false,nativeCoreReady:false,ready:false};
 const m=/^IZ2S_MEMCPY_V1;state=(blocked|failed);detail=([a-z_]+)$/.exec(raw);
 if(!m||!(m[1]==='blocked'?BLOCKED:FAILED).has(m[2]))throw Error('Invalid memcpy report');
 return {backend:'balatro',mode:'self-owned-native-memcpy',state:m[1],detail:m[2],
  nativeFunctionCalled:m[1]==='failed',copyVerified:false,clearVerified:false,
  arbitraryMemoryAccessVerified:false,ipcVerified:false,nativeCoreReady:false,ready:false};
}
async function inspect(host,options={},send=request){
 return parse(await send({host,lua:LUA,port:9026,timeoutMs:7000,...options}));
}
async function main(){
 const [host,portArg]=process.argv.slice(2);
 if(!host){console.error('Usage: node native-memcpy-smoke.cjs <switch-ip> [port]');process.exitCode=2;return;}
 try{const r=await inspect(host,portArg?{port:Number(portArg)}:{});
  console.log(JSON.stringify(r,null,2));if(r.state!=='verified')process.exitCode=1;
 }catch(e){console.error(JSON.stringify({backend:'balatro',ready:false,error:e.message}));process.exitCode=1;}
}
if(require.main===module)main();
module.exports={LUA,parse,inspect};
