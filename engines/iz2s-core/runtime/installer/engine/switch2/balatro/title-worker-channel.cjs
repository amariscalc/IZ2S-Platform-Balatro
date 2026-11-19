#!/usr/bin/env node
'use strict';
// Hardware test: a verified Balatro LÖVE worker computes a fixed result and
// sends it back through a title-local Channel. No services, arbitrary code,
// executable mappings or kernel IPC. One attempt; never auto-retry.
const {request}=require('./rpc.cjs');
const LUA=[
 'local f=type(love)=="table" and love.filesystem or nil',
 'local t=type(love)=="table" and love.thread or nil',
 'local function has(o,k) return type(o)=="table" and type(o[k])=="function" end',
 'if not (has(f,"newFileData") and has(t,"getChannel") and has(t,"newThread")) then',
 ' return "IZ2S_WORKER_CHANNEL_V1;phase=unsupported"',
 'end',
 'local stage="channel"',
 'local ok,result=pcall(function()',
 ' local name="iz2s_book_reader_channel_probe_v1"',
 ' local channel=t.getChannel(name)',
 ' channel:clear()',
 ' stage="filedata"',
 ' local code=[[',
 '  local channel=love.thread.getChannel("iz2s_book_reader_channel_probe_v1")',
 '  channel:push("IZ2S_WORKER_RESULT_42")',
 ' ]]',
 ' local data=f.newFileData(code,"iz2s-book-reader-channel-probe.lua")',
 ' stage="create"',
 ' local worker=t.newThread(data)',
 ' stage="start"',
 ' worker:start()',
 ' stage="wait"',
 ' worker:wait()',
 ' stage="get-error"',
 ' local err=worker:getError()',
 ' if err then channel:clear(); return "worker-error" end',
 ' stage="receive"',
 ' local value=channel:pop()',
 ' channel:clear()',
 ' if value~="IZ2S_WORKER_RESULT_42" then return "reply-mismatch" end',
 ' return "verified"',
 'end)',
 'local phase=ok and result or stage.."-error"',
 'return "IZ2S_WORKER_CHANNEL_V1;phase="..phase'
].join('\n');
const STATES=Object.freeze(['verified','unsupported','channel-error','filedata-error','create-error',
 'start-error','wait-error','get-error-error','receive-error','worker-error','reply-mismatch']);
function parse(reply){
 if(typeof reply!=='string'||!reply.startsWith('-> '))throw Error('Invalid worker channel RPC framing');
 const m=/^IZ2S_WORKER_CHANNEL_V1;phase=([a-z-]+)$/.exec(reply.slice(3).trim());
 if(!m||!STATES.includes(m[1]))throw Error('Invalid worker channel response');
 return {backend:'balatro',mode:'live-title-worker-channel',phase:m[1],
  titleWorkerMessageRoundtripVerified:m[1]==='verified',
  originalNativeSupervisorStarted:false,serviceIpcVerified:false,
  executableMappingVerified:false,originalBookReaderExecuted:false,ready:false};
}
async function inspect(host,{port=9026,send=request}={}){
 if(typeof host!=='string'||!host||/\s/.test(host))throw Error('Invalid Balatro host');
 if(!Number.isSafeInteger(port)||port<1||port>65535)throw Error('Invalid RPC port');
 return parse(await send({host,port,lua:LUA,timeoutMs:7000,maxReplyBytes:1024}));
}
async function main(){
 const [host,rawPort]=process.argv.slice(2);
 if(!host){console.error('Usage: node title-worker-channel.cjs <switch-ip> [port]');process.exitCode=2;return;}
 try{console.log(JSON.stringify(await inspect(host,{port:rawPort?Number(rawPort):9026}),null,2));}
 catch(error){console.error(JSON.stringify({backend:'balatro',phase:'error',ready:false,error:String(error.message||error)}));process.exitCode=1;}
}
if(require.main===module)main();
module.exports={LUA,STATES,parse,inspect};
