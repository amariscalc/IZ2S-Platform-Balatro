#!/usr/bin/env node
'use strict';
// One-RPC, owned-only handle registry. Handles never expose raw pointers.
// No persistence beyond this request and no privileged access.
const {request}=require('./rpc.cjs');
const LUA=[
 'local ok,ffi=pcall(require,"ffi")',
 'if not ok then return "IZ2S_HANDLES_V1;state=blocked;detail=ffi_missing" end',
 'local worked,result=pcall(function()',
 ' local pool,nextid={},0',
 ' local function allocate(n)',
 '  if type(n)~="number" or n<1 or n>128 or n~=math.floor(n) then error("size") end',
 '  nextid=nextid+1',
 '  pool[nextid]={data=ffi.new("uint8_t[?]",n),size=n}',
 '  return nextid',
 ' end',
 ' local function access(id,off,len)',
 '  local b=pool[id]',
 '  if not b then error("stale") end',
 '  if type(off)~="number" or type(len)~="number" or',
 '   off~=math.floor(off) or len~=math.floor(len) or',
 '   off<0 or len<0 or off>b.size or len>b.size-off then error("bounds") end',
 '  return b.data',
 ' end',
 ' local function write(id,off,v)',
 '  if type(v)~="number" or v<0 or v>255 or v~=math.floor(v) then error("byte") end',
 '  access(id,off,1)[off]=v',
 ' end',
 ' local function read(id,off) return tonumber(access(id,off,1)[off]) end',
 ' local function copy(dst,doff,src,soff,len)',
 '  local d=access(dst,doff,len)',
 '  local s=access(src,soff,len)',
 '  if dst==src then error("overlap_refused") end',
 '  ffi.copy(d+doff,s+soff,len)',
 ' end',
 ' local function release(id)',
 '  local b=pool[id];if not b then error("stale") end',
 '  ffi.fill(b.data,b.size,0);pool[id]=nil',
 ' end',
 ' local a,b=allocate(32),allocate(32)',
 ' for i=0,31 do write(a,i,(i*7+3)%256) end',
 ' copy(b,0,a,0,32)',
 ' local sum=0',
 ' for i=0,31 do',
 '  local expected=(i*7+3)%256',
 '  if read(a,i)~=expected or read(b,i)~=expected then error("mismatch") end',
 '  sum=sum+read(b,i)',
 ' end',
 ' local function rejected(fn)',
 '  local success=pcall(fn);return not success',
 ' end',
 ' local guards=rejected(function() read(a,32) end) and',
 '  rejected(function() write(a,-1,10) end) and',
 '  rejected(function() copy(b,16,a,0,17) end) and',
 '  rejected(function() copy(a,0,a,1,4) end)',
 ' release(a)',
 ' guards=guards and rejected(function() read(a,0) end) and',
 '  rejected(function() release(a) end)',
 ' local successor=allocate(8)',
 ' guards=guards and successor~=a and successor~=b',
 ' release(successor)',
 ' release(b)',
 ' guards=guards and rejected(function() read(b,0) end)',
 ' if not guards then error("guards") end',
 ' return sum',
 'end)',
 'if not worked then return "IZ2S_HANDLES_V1;state=failed;detail=contract_failed" end',
 'return "IZ2S_HANDLES_V1;state=verified;detail=none;sum="..tostring(result)',
].join('\n');
const EXPECTED=Array.from({length:32},(_,i)=>(i*7+3)%256).reduce((a,b)=>a+b,0);
function parse(reply){
 if(typeof reply!=='string'||!reply.startsWith('-> '))throw Error('Invalid scoped handle reply');
 const body=reply.slice(3).trim();
 if(body===`IZ2S_HANDLES_V1;state=verified;detail=none;sum=${EXPECTED}`)
  return {backend:'balatro',mode:'scoped-owned-handles',state:'verified',
   handles:3,bytesCopied:32,sum:EXPECTED,boundsVerified:true,staleHandlesRejected:true,
   handleReuseRejected:true,overlappingCopyRefused:true,zeroOnRelease:true,
   nativeFreeVerified:false,persistentHandles:false,arbitraryMemoryAccessVerified:false,
   nativeTransportReady:false,ipcVerified:false,nativeCoreReady:false,ready:false};
 const m=/^IZ2S_HANDLES_V1;state=(blocked|failed);detail=(ffi_missing|contract_failed)$/.exec(body);
 if(!m||((m[1]==='blocked')!==(m[2]==='ffi_missing')))throw Error('Invalid scoped handle status');
 return {backend:'balatro',mode:'scoped-owned-handles',state:m[1],detail:m[2],
  boundsVerified:false,staleHandlesRejected:false,nativeFreeVerified:false,
  persistentHandles:false,arbitraryMemoryAccessVerified:false,nativeTransportReady:false,
  ipcVerified:false,nativeCoreReady:false,ready:false};
}
async function inspect(host,options={},send=request){
 return parse(await send({host,lua:LUA,port:9026,timeoutMs:5000,...options}));
}
async function main(){
 const [host,portArg]=process.argv.slice(2);
 if(!host){console.error('Usage: node owned-handles.cjs <switch-ip> [port]');process.exitCode=2;return;}
 try{const report=await inspect(host,portArg?{port:Number(portArg)}:{});
  console.log(JSON.stringify(report,null,2));if(report.state!=='verified')process.exitCode=1;
 }catch(e){console.error(JSON.stringify({backend:'balatro',ready:false,error:e.message}));process.exitCode=1;}
}
if(require.main===module)main();
module.exports={LUA,EXPECTED,parse,inspect};
