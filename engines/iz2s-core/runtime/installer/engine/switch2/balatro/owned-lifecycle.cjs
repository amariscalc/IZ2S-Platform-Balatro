#!/usr/bin/env node
'use strict';
// Scoped LuaJIT-owned memory lifecycle: allocate, mutate, verify, zero,
// release Lua references. Garbage collection is NOT proof of native free.
const {request}=require('./rpc.cjs');
const LUA=[
 'local ok,ffi=pcall(require,"ffi")',
 'if not ok then return "IZ2S_OWNED_LIFE_V1;state=blocked;detail=ffi_missing" end',
 'local worked,result=pcall(function()',
 ' local src=ffi.new("uint8_t[64]")',
 ' local dst=ffi.new("uint8_t[64]")',
 ' local sum=0',
 ' for i=0,63 do src[i]=(i*13+7)%256 end',
 ' ffi.copy(dst,src,64)',
 ' for i=0,63 do',
 '  local expected=(i*13+7)%256',
 '  if tonumber(src[i])~=expected or tonumber(dst[i])~=expected then error("copy") end',
 '  sum=sum+tonumber(dst[i])',
 ' end',
 ' ffi.fill(src,64,0)',
 ' ffi.fill(dst,64,0)',
 ' for i=0,63 do if tonumber(src[i])~=0 or tonumber(dst[i])~=0 then error("clear") end end',
 ' src=nil;dst=nil',
 ' return sum',
 'end)',
 'if not worked then return "IZ2S_OWNED_LIFE_V1;state=failed;detail=verification_failed" end',
 'return "IZ2S_OWNED_LIFE_V1;state=verified;detail=none;sum="..tostring(result)',
].join('\n');
const EXPECTED=Array.from({length:64},(_,i)=>(i*13+7)%256).reduce((a,b)=>a+b,0);
function parse(reply){
 if(typeof reply!=='string'||!reply.startsWith('-> '))throw Error('Invalid lifecycle RPC framing');
 const raw=reply.slice(3).trim();
 if(raw===`IZ2S_OWNED_LIFE_V1;state=verified;detail=none;sum=${EXPECTED}`)
  return {backend:'balatro',mode:'owned-lua-ffi-lifecycle',state:'verified',
   bytes:64,sum:EXPECTED,allocationVerified:true,copyVerified:true,
   readWriteVerified:true,zeroed:true,referencesReleased:true,
   nativeHeapFreeVerified:false,arbitraryMemoryAccessVerified:false,
   nativeTransportReady:false,nativeCoreReady:false,ready:false};
 const m=/^IZ2S_OWNED_LIFE_V1;state=(blocked|failed);detail=(ffi_missing|verification_failed)$/.exec(raw);
 if(!m||((m[1]==='blocked')!==(m[2]==='ffi_missing')))throw Error('Malformed lifecycle status');
 return {backend:'balatro',mode:'owned-lua-ffi-lifecycle',state:m[1],detail:m[2],
  allocationVerified:false,copyVerified:false,readWriteVerified:false,
  zeroed:false,referencesReleased:false,nativeHeapFreeVerified:false,
  arbitraryMemoryAccessVerified:false,nativeTransportReady:false,
  nativeCoreReady:false,ready:false};
}
async function inspect(host,options={},send=request){
 return parse(await send({host,port:9026,timeoutMs:5000,lua:LUA,...options}));
}
async function main(){
 const [host,portArg]=process.argv.slice(2);
 if(!host){console.error('Usage: node owned-lifecycle.cjs <switch-ip> [port]');process.exitCode=2;return;}
 try{const result=await inspect(host,portArg?{port:Number(portArg)}:{});
  console.log(JSON.stringify(result,null,2));if(result.state!=='verified')process.exitCode=1;
 }catch(e){console.error(JSON.stringify({backend:'balatro',ready:false,error:e.message}));process.exitCode=1;}
}
if(require.main===module)main();
module.exports={LUA,EXPECTED,parse,inspect};
