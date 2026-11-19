#!/usr/bin/env node
'use strict';
// Isolates title-local LÖVE Channel operations WITHOUT creating or joining
// any LÖVE worker. Used after a post-worker crash was observed on hardware.
const {request}=require('./rpc.cjs');
const LUA=[
 'local t=type(love)=="table" and love.thread or nil',
 'local function has(o,k) return type(o)=="table" and type(o[k])=="function" end',
 'if not has(t,"getChannel") then return "IZ2S_CHANNEL_ONLY_V1;phase=unsupported" end',
 'local stage="get-channel"',
 'local ok,result=pcall(function()',
 ' local channel=t.getChannel("iz2s_book_reader_channel_only_v1")',
 ' stage="clear-before"',
 ' channel:clear()',
 ' stage="push"',
 ' channel:push("IZ2S_CHANNEL_ONLY_42")',
 ' stage="pop"',
 ' local got=channel:pop()',
 ' stage="clear-after"',
 ' channel:clear()',
 ' if got~="IZ2S_CHANNEL_ONLY_42" then return "mismatch" end',
 ' return "verified"',
 'end)',
 'return "IZ2S_CHANNEL_ONLY_V1;phase="..(ok and result or stage.."-error")'
].join('\n');
const STATES=Object.freeze(['unsupported','verified','mismatch','get-channel-error','clear-before-error','push-error','pop-error','clear-after-error']);
function parse(reply){
 if(typeof reply!=='string'||!reply.startsWith('-> '))throw Error('Invalid channel-only RPC framing');
 const m=/^IZ2S_CHANNEL_ONLY_V1;phase=([a-z-]+)$/.exec(reply.slice(3).trim());
 if(!m||!STATES.includes(m[1]))throw Error('Malformed channel-only RPC response');
 return {backend:'balatro',mode:'title-channel-without-worker',phase:m[1],
  titleChannelRoundtripVerified:m[1]==='verified',workerCreated:false,
  workerLifecycleSafe:null,originalNativeSupervisorStarted:false,ready:false};
}
async function inspect(host,{port=9026,send=request}={}){
 if(typeof host!=='string'||!host||/\s/.test(host))throw Error('Invalid Balatro host');
 if(!Number.isInteger(port)||port<1||port>65535)throw Error('Invalid RPC port');
 return parse(await send({host,port,lua:LUA,timeoutMs:5000,maxReplyBytes:1024}));
}
async function main(){
 const [host,rawPort]=process.argv.slice(2);
 if(!host){console.error('Usage: node title-channel-only.cjs <switch-ip> [port]');process.exitCode=2;return}
 try{console.log(JSON.stringify(await inspect(host,{port:rawPort?Number(rawPort):9026}),null,2))}
 catch(error){console.error(JSON.stringify({backend:'balatro',phase:'error',ready:false,error:String(error.message||error)}));process.exitCode=1}
}
if(require.main===module)main();
module.exports={LUA,STATES,parse,inspect};
