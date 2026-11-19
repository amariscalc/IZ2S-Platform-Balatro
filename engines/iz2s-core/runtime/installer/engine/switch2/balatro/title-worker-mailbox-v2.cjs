#!/usr/bin/env node
'use strict';
// V2 worker only: fixed commands, graceful exit, no join/release.
// Never changes the previous V1 mailbox state.
const {request}=require('./rpc.cjs');
const START=[
 'if rawget(_G,"__IZ2S_BOOK_READER_MAILBOX_V1") then return "IZ2S_MAILBOX_V2;phase=previous-worker-active" end',
 'local key="__IZ2S_BOOK_READER_MAILBOX_V2"',
 'if rawget(_G,key) then return "IZ2S_MAILBOX_V2;phase=already-started" end',
 'local t=type(love)=="table" and love.thread or nil',
 'local f=type(love)=="table" and love.filesystem or nil',
 'if not(t and f and type(t.getChannel)=="function" and type(t.newThread)=="function" and type(f.newFileData)=="function") then return "IZ2S_MAILBOX_V2;phase=unsupported" end',
 'local s={phase="starting",seq=0,ack=0,pending=false}',
 'rawset(_G,key,s)',
 'local stage="channels"',
 'local ok=pcall(function()',
 ' s.input=t.getChannel("iz2s_book_reader_mailbox_v2_in")',
 ' s.output=t.getChannel("iz2s_book_reader_mailbox_v2_out")',
 ' s.input:clear();s.output:clear()',
 ' stage="filedata"',
 ' local code=[[',
 '  local i=love.thread.getChannel("iz2s_book_reader_mailbox_v2_in")',
 '  local o=love.thread.getChannel("iz2s_book_reader_mailbox_v2_out")',
 '  while true do',
 '   local cmd=i:demand()',
 '   if cmd=="ping:1" then o:push("pong:1")',
 '   elseif cmd=="checksum:2" then o:push("checksum:2:42")',
 '   elseif cmd=="stop:3" then o:push("stopped:3");break',
 '   else o:push("unexpected");break end',
 '  end',
 ' ]]',
 ' s.data=f.newFileData(code,"iz2s-book-reader-mailbox-v2.lua")',
 ' stage="create"',
 ' s.worker=t.newThread(s.data)',
 ' stage="start"',
 ' s.worker:start()',
 'end)',
 's.phase=ok and "started" or stage.."-error"',
 'return "IZ2S_MAILBOX_V2;phase="..s.phase'
].join('\n');
function command(op,n){
 return [
  'local s=rawget(_G,"__IZ2S_BOOK_READER_MAILBOX_V2")',
  'if type(s)~="table" or s.phase~="started" then return "IZ2S_MAILBOX_V2;phase=not-started" end',
  'if s.seq~='+String(n-1)+' or s.ack~='+String(n-1)+' or s.pending then return "IZ2S_MAILBOX_V2;phase=out-of-order" end',
  's.pending=true',
  'local ok=pcall(function() s.input:push("'+op+':'+n+'") end)',
  'if not ok then s.phase="send-error";return "IZ2S_MAILBOX_V2;phase=send-error" end',
  's.seq='+n,
  'return "IZ2S_MAILBOX_V2;phase='+op+'-sent"'
 ].join('\n');
}
const STATUS=[
 'local s=rawget(_G,"__IZ2S_BOOK_READER_MAILBOX_V2")',
 'if type(s)~="table" then return "IZ2S_MAILBOX_V2;phase=not-started" end',
 'if s.phase~="started" then return "IZ2S_MAILBOX_V2;phase="..s.phase end',
 'if s.pending then',
 ' local ok,msg=pcall(function() return s.output:pop() end)',
 ' if not ok then s.phase="receive-error";return "IZ2S_MAILBOX_V2;phase=receive-error" end',
 ' if msg==nil then return "IZ2S_MAILBOX_V2;phase=pending" end',
 ' local expected=s.seq==1 and "pong:1" or s.seq==2 and "checksum:2:42" or s.seq==3 and "stopped:3" or ""',
 ' if msg~=expected then s.phase="reply-mismatch";return "IZ2S_MAILBOX_V2;phase=reply-mismatch" end',
 ' s.ack=s.seq;s.pending=false',
 'end',
 'if s.ack==3 then',
 ' local ok,running=pcall(function() return s.worker:isRunning() end)',
 ' if not ok then return "IZ2S_MAILBOX_V2;phase=thread-state-error" end',
 ' if running then return "IZ2S_MAILBOX_V2;phase=stop-acknowledged" end',
 ' s.phase="stopped";return "IZ2S_MAILBOX_V2;phase=stopped"',
 'end',
 'if s.ack==2 then return "IZ2S_MAILBOX_V2;phase=checksum-verified" end',
 'if s.ack==1 then return "IZ2S_MAILBOX_V2;phase=ping-verified" end',
 'return "IZ2S_MAILBOX_V2;phase=started"'
].join('\n');
const SCRIPTS=Object.freeze({start:START,ping:command('ping',1),checksum:command('checksum',2),stop:command('stop',3),status:STATUS});
const PHASES=new Set(['previous-worker-active','already-started','unsupported','channels-error','filedata-error','create-error','start-error','started','not-started','out-of-order','send-error','ping-sent','checksum-sent','stop-sent','pending','receive-error','reply-mismatch','ping-verified','checksum-verified','stop-acknowledged','thread-state-error','stopped']);
function parse(reply){
 if(typeof reply!=='string'||!reply.startsWith('-> '))throw Error('Invalid V2 RPC framing');
 const m=/^IZ2S_MAILBOX_V2;phase=([a-z-]+)$/.exec(reply.slice(3).trim());
 if(!m||!PHASES.has(m[1]))throw Error('Invalid V2 RPC response');
 return {backend:'balatro',mode:'title-worker-v2',phase:m[1],workerStoppedVerified:m[1]==='stopped',workerJoined:false,workerReleased:false,nativeSupervisorRunning:false,ready:false};
}
async function inspect(host,op,{port=9026,send=request}={}){
 if(typeof host!=='string'||!host||/\s/.test(host))throw Error('Invalid Balatro host');
 if(!Object.prototype.hasOwnProperty.call(SCRIPTS,op))throw Error('Invalid V2 operation');
 if(!Number.isInteger(port)||port<1||port>65535)throw Error('Invalid RPC port');
 return parse(await send({host,port,lua:SCRIPTS[op],timeoutMs:5000,maxReplyBytes:1024}));
}
async function main(){
 const [host,op]=process.argv.slice(2);
 if(!host||!op){console.error('Usage: node title-worker-mailbox-v2.cjs <switch-ip> start|ping|checksum|stop|status');process.exitCode=2;return;}
 try{console.log(JSON.stringify(await inspect(host,op),null,2));}
 catch(e){console.error(JSON.stringify({phase:'error',ready:false,error:e.message}));process.exitCode=1;}
}
if(require.main===module)main();
module.exports={SCRIPTS,PHASES,parse,inspect};
