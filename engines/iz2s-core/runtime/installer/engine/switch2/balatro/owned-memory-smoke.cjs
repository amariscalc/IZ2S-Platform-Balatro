#!/usr/bin/env node
'use strict';
// Check only LuaJIT FFI memory belonging to this RPC chunk.
// No arbitrary pointer, process memory inspection, native allocation or IPC.
const {request}=require('./rpc.cjs');
const LUA=[
 'local ok,ffi=pcall(require,"ffi")',
 'if not ok or type(ffi)~="table" then',
 ' return "IZ2S_OWNED_V1;state=unavailable;detail=ffi_missing"',
 'end',
 'local worked,value=pcall(function()',
 ' local buffer=ffi.new("uint8_t[16]")',
 ' for i=0,15 do buffer[i]=(i*17)%256 end',
 ' local sum=0',
 ' for i=0,15 do',
 '  local x=tonumber(buffer[i])',
 '  if x~=(i*17)%256 then error("mismatch") end',
 '  sum=sum+x',
 ' end',
 ' ffi.fill(buffer,16,0)',
 ' for i=0,15 do if tonumber(buffer[i])~=0 then error("clear_failed") end end',
 ' return sum',
 'end)',
 'if not worked then return "IZ2S_OWNED_V1;state=failed;detail=buffer_mismatch" end',
 'return "IZ2S_OWNED_V1;state=verified;detail=none;sum="..tostring(value)',
].join('\n');
function parse(reply){
 if(typeof reply!=='string'||!reply.startsWith('-> '))throw Error('Invalid FFI buffer RPC framing');
 const body=reply.slice(3).trim();
 if(body==='IZ2S_OWNED_V1;state=verified;detail=none;sum=2040')
  return {backend:'balatro',mode:'self-owned-ffi-buffer',state:'verified',
    bytes:16,sum:2040,readWriteVerified:true,clearVerified:true,
    arbitraryMemoryAccessVerified:false,nativeMemoryTransportReady:false,
    nativeCoreReady:false,ready:false};
 const m=/^IZ2S_OWNED_V1;state=(unavailable|failed);detail=(ffi_missing|buffer_mismatch)$/.exec(body);
 if(!m||((m[1]==='unavailable')!==(m[2]==='ffi_missing')))
  throw Error('Invalid FFI buffer status');
 return {backend:'balatro',mode:'self-owned-ffi-buffer',state:m[1],detail:m[2],
  readWriteVerified:false,clearVerified:false,
  arbitraryMemoryAccessVerified:false,nativeMemoryTransportReady:false,
  nativeCoreReady:false,ready:false};
}
async function inspect(host,options={},send=request){
 return parse(await send({host,port:9026,timeoutMs:5000,lua:LUA,...options}));
}
async function main(){
 const [host,portArg]=process.argv.slice(2);
 if(!host){console.error('Usage: node owned-memory-smoke.cjs <switch-ip> [port]');process.exitCode=2;return;}
 try{
  const result=await inspect(host,portArg?{port:Number(portArg)}:{});
  console.log(JSON.stringify(result,null,2));
  if(result.state!=='verified')process.exitCode=1;
 }catch(error){
  console.error(JSON.stringify({backend:'balatro',ready:false,error:error.message}));
  process.exitCode=1;
 }
}
if(require.main===module)main();
module.exports={LUA,parse,inspect};
