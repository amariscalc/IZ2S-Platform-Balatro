#!/usr/bin/env node
'use strict';
// Hardware fault isolation: retain LÖVE worker and Channel references across
// separate RPC messages. No worker:wait(), :clear() after start, or cleanup.
// A failed or uncertain start must never be retried within the same session.
const {request}=require('./rpc.cjs');
const KEY='__IZ2S_WORKER_LIFETIME_PROBE_V1';
const START=[
 'local t=type(love)=="table" and love.thread or nil',
 'local f=type(love)=="table" and love.filesystem or nil',
 'local function has(o,k) return type(o)=="table" and type(o[k])=="function" end',
 'local key="__IZ2S_WORKER_LIFETIME_PROBE_V1"',
 'if rawget(_G,key)~=nil then return "IZ2S_WORKER_LIFETIME_V1;phase=already-started" end',
 'if not(has(t,"newThread") and has(t,"getChannel") and has(f,"newFileData")) then',
 ' return "IZ2S_WORKER_LIFETIME_V1;phase=unsupported" end',
 'local state={phase="created"}',
 'rawset(_G,key,state)',
 'local stage="channel"',
 'local ok=pcall(function()',
 ' state.channel=t.getChannel("iz2s_worker_lifetime_v1")',
 ' state.channel:clear()',
 ' stage="filedata"',
 ' local code=[[local c=love.thread.getChannel("iz2s_worker_lifetime_v1"); c:push("IZ2S_LIFETIME_ACK")]]',
 ' local data=f.newFileData(code,"iz2s-worker-lifetime.lua")',
 ' stage="create"',
 ' state.worker=t.newThread(data)',
 ' state.data=data',
 ' stage="start"',
 ' state.worker:start()',
 'end)',
 'state.phase=ok and "spawned" or stage.."-error"',
 'return "IZ2S_WORKER_LIFETIME_V1;phase="..state.phase'
].join('\n');
const STATUS=[
 'local s=rawget(_G,"__IZ2S_WORKER_LIFETIME_PROBE_V1")',
 'if type(s)~="table" then return "IZ2S_WORKER_LIFETIME_V1;phase=missing" end',
 'if s.phase~="spawned" and s.phase~="running" and s.phase~="delivered" then',
 ' return "IZ2S_WORKER_LIFETIME_V1;phase="..s.phase end',
 'if s.phase=="delivered" then return "IZ2S_WORKER_LIFETIME_V1;phase=delivered" end',
 'local ok,value=pcall(function() return s.channel:pop() end)',
 'if not ok then s.phase="pop-error"',
 'elseif value=="IZ2S_LIFETIME_ACK" then s.phase="delivered"',
 'elseif value~=nil then s.phase="unexpected-message"',
 'else s.phase="running" end',
 'return "IZ2S_WORKER_LIFETIME_V1;phase="..s.phase'
].join('\n');
const STATES=new Set(['already-started','unsupported','channel-error','filedata-error',
 'create-error','start-error','spawned','running','delivered','pop-error','unexpected-message','missing']);
function parse(reply){
 if(typeof reply!=='string'||!reply.startsWith('-> '))throw Error('Invalid worker-lifetime RPC framing');
 const m=/^IZ2S_WORKER_LIFETIME_V1;phase=([a-z-]+)$/.exec(reply.slice(3).trim());
 if(!m||!STATES.has(m[1]))throw Error('Invalid worker-lifetime response');
 return {backend:'balatro',mode:'worker-lifetime-isolation',phase:m[1],
  titleWorkerMessageObserved:m[1]==='delivered',
  workerReferencesRetained:true,workerJoined:false,
  titleWorkerStableAfterReturn:null,nativeSupervisorRunning:false,ready:false};
}
async function inspect(host,op,{port=9026,send=request}={}){
 if(typeof host!=='string'||!host||/\s/.test(host))throw Error('Invalid Balatro host');
 if(op!=='start'&&op!=='status')throw Error('Use only start or status');
 if(!Number.isInteger(port)||port<1||port>65535)throw Error('Invalid RPC port');
 return parse(await send({host,port,lua:op==='start'?START:STATUS,
  timeoutMs:5000,maxReplyBytes:1024}));
}
async function main(){
 const [host,op]=process.argv.slice(2);
 if(!host||!op){console.error('Usage: node title-worker-lifetime.cjs <switch-ip> start|status');process.exitCode=2;return}
 try{console.log(JSON.stringify(await inspect(host,op),null,2))}
 catch(e){console.error(JSON.stringify({phase:'error',ready:false,error:e.message}));process.exitCode=1}
}
if(require.main===module)main();
module.exports={KEY,START,STATUS,STATES,parse,inspect};
