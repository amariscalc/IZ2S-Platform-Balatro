#!/usr/bin/env node
'use strict';
// Two bounded, real operations inside the Balatro title:
//  (1) write/read/delete a fixed marker in the title's private LÖVE save VFS;
//  (2) start/join an empty LÖVE worker when available.
// Neither operation acquires SD privileges, maps an executable or creates IZ2S
// supervisor ownership. Errors and timeouts are not retried.
const {request}=require('./rpc.cjs');
const LUA=[
 'local fs=type(love)=="table" and love.filesystem or nil',
 'local th=type(love)=="table" and love.thread or nil',
 'local function has(x,k) return type(x)=="table" and type(x[k])=="function" end',
 'local fsResult="unsupported"',
 'local workerResult="unsupported"',
 'local name="iz2s-book-reader-title-vfs-probe.txt"',
 'local payload="iz2s-title-private-vfs-v1"',
 'if has(fs,"write") and has(fs,"read") and has(fs,"remove") then',
 ' local ok,out=pcall(function()',
 '  local wrote=fs.write(name,payload)',
 '  if not wrote then return "write-failed" end',
 '  local got=fs.read(name)',
 '  local deleted=fs.remove(name)',
 '  if got~=payload then return "read-mismatch" end',
 '  if not deleted then return "remove-failed" end',
 '  return "verified"',
 ' end)',
 ' fsResult=ok and out or "error"',
 'end',
 'if has(th,"newThread") then',
 ' local origin="create"',
 ' local ok,out=pcall(function()',
 '  local worker=th.newThread("local n=1+1")',
 '  if type(worker)~="userdata" and type(worker)~="table" then return "invalid-worker" end',
 '  origin="start"',
 '  worker:start()',
 '  origin="wait"',
 '  worker:wait()',
 '  origin="get-error"',
 '  local err=worker:getError()',
 '  if err then return "worker-error" end',
 '  return "verified"',
 ' end)',
 ' workerResult=ok and out or (origin.."-error")',
 'end',
 'return "IZ2S_BALATRO_TITLE_OPS_V1;vfs="..fsResult..";worker="..workerResult'
].join('\n');
const RESULTS=new Set(['verified','unsupported','write-failed','read-mismatch','remove-failed','error','invalid-worker','worker-error','create-error','start-error','wait-error','get-error-error']);
function parse(reply){
 if(typeof reply!=='string'||!reply.startsWith('-> '))throw Error('Invalid Balatro response framing');
 const match=/^IZ2S_BALATRO_TITLE_OPS_V1;vfs=([a-z-]+);worker=([a-z-]+)$/.exec(reply.slice(3).trim());
 if(!match||!RESULTS.has(match[1])||!RESULTS.has(match[2]))throw Error('Invalid Balatro title operations response');
 return {backend:'balatro',mode:'live-title-owned-operations',filesystem:{titlePrivateVfsRoundtrip:match[1]},
  threading:{loveWorkerLifecycle:match[2]},
  nativeSdFilesystemVerified:false,originalSupervisorThreadVerified:false,
  privilegedIpcVerified:false,executableMappingVerified:false,
  originalBookReaderExecuted:false,ready:false};
}
async function inspect(host,{port=9026,send=request}={}){
 if(typeof host!=='string'||!host||/\s/.test(host))throw Error('Invalid Balatro host');
 if(!Number.isInteger(port)||port<1||port>65535)throw Error('Invalid RPC port');
 return parse(await send({host,port,lua:LUA,timeoutMs:7000,maxReplyBytes:1024}));
}
async function main(){
 const [host,rawPort]=process.argv.slice(2);
 if(!host){console.error('Usage: node title-owned-operations.cjs <switch-ip> [port]');process.exitCode=2;return}
 try{console.log(JSON.stringify(await inspect(host,{port:rawPort?Number(rawPort):9026}),null,2))}
 catch(error){console.error(JSON.stringify({backend:'balatro',phase:'error',ready:false,error:error.message}));process.exitCode=1}
}
if(require.main===module)main();
module.exports={LUA,RESULTS,parse,inspect};
