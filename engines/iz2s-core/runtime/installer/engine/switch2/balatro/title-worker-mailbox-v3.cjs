#!/usr/bin/env node
'use strict';
// V3 Balatro title-local worker. Cooperative quiesce does NOT terminate,
// join or release a LÖVE thread. This isolates "stopped processing commands"
// from the crash previously observed when the V2 worker exited.
const {request}=require('./rpc.cjs');
const KEY='__IZ2S_BOOK_READER_MAILBOX_V3';
const SCRIPT_START=[
 'if rawget(_G,"__IZ2S_BOOK_READER_MAILBOX_V1") or rawget(_G,"__IZ2S_BOOK_READER_MAILBOX_V2") then return "IZ2S_MAILBOX_V3;phase=old-worker-present" end',
 'local key="__IZ2S_BOOK_READER_MAILBOX_V3"',
 'if rawget(_G,key) then return "IZ2S_MAILBOX_V3;phase=already-created" end',
 'local t=type(love)=="table" and love.thread or nil',
 'local f=type(love)=="table" and love.filesystem or nil',
 'if not(t and f and type(t.getChannel)=="function" and type(t.newThread)=="function" and type(f.newFileData)=="function") then return "IZ2S_MAILBOX_V3;phase=unsupported" end',
 'local s={phase="initializing",sent=0,received=0,pending=false}',
 'rawset(_G,key,s)',
 'local stage="channels"',
 'local ok=pcall(function()',
 ' s.input=t.getChannel("iz2s_book_reader_v3_in")',
 ' s.output=t.getChannel("iz2s_book_reader_v3_out")',
 ' s.input:clear();s.output:clear()',
 ' stage="filedata"',
 ' local code=[[',
 '  local input=love.thread.getChannel("iz2s_book_reader_v3_in")',
 '  local output=love.thread.getChannel("iz2s_book_reader_v3_out")',
 '  local parked=false',
 '  while true do',
 '   local command=input:demand()',
 '   if command=="ping:1" and not parked then output:push("pong:1")',
 '   elseif command=="park:2" and not parked then',
 '    parked=true;output:push("parked:2")',
 '   else output:push("rejected") end',
 '  end',
 ' ]]',
 ' s.data=f.newFileData(code,"iz2s-book-reader-v3.lua")',
 ' stage="create"',
 ' s.worker=t.newThread(s.data)',
 ' stage="start"',
 ' s.worker:start()',
 'end)',
 's.phase=ok and "started" or stage.."-error"',
 'return "IZ2S_MAILBOX_V3;phase="..s.phase'
].join('\n');
function command(op,n){
 return [
 'local s=rawget(_G,"__IZ2S_BOOK_READER_MAILBOX_V3")',
 'if type(s)~="table" or s.phase~="started" then return "IZ2S_MAILBOX_V3;phase=not-started" end',
 'if s.sent~='+String(n-1)+' or s.received~='+String(n-1)+' or s.pending then return "IZ2S_MAILBOX_V3;phase=out-of-order" end',
 's.pending=true',
 'local ok=pcall(function() s.input:push("'+op+':'+n+'") end)',
 'if not ok then s.phase="send-uncertain";return "IZ2S_MAILBOX_V3;phase=send-uncertain" end',
 's.sent='+n,
 'return "IZ2S_MAILBOX_V3;phase='+op+'-sent"'
 ].join('\n');
}
const SCRIPT_STATUS=[
 'local s=rawget(_G,"__IZ2S_BOOK_READER_MAILBOX_V3")',
 'if type(s)~="table" then return "IZ2S_MAILBOX_V3;phase=not-started" end',
 'if s.phase~="started" then return "IZ2S_MAILBOX_V3;phase="..s.phase end',
 'if s.pending then',
 ' local ok,v=pcall(function() return s.output:pop() end)',
 ' if not ok then s.phase="receive-error";return "IZ2S_MAILBOX_V3;phase=receive-error" end',
 ' if v==nil then return "IZ2S_MAILBOX_V3;phase=pending" end',
 ' local expected=s.sent==1 and "pong:1" or s.sent==2 and "parked:2" or ""',
 ' if v~=expected then s.phase="reply-mismatch";return "IZ2S_MAILBOX_V3;phase=reply-mismatch" end',
 ' s.received=s.sent;s.pending=false',
 'end',
 'if s.received==2 then',
 ' local ok,running=pcall(function() return s.worker:isRunning() end)',
 ' if not ok then return "IZ2S_MAILBOX_V3;phase=thread-state-error" end',
 ' if not running then s.phase="unexpected-exit";return "IZ2S_MAILBOX_V3;phase=unexpected-exit" end',
 ' return "IZ2S_MAILBOX_V3;phase=parked-alive"',
 'end',
 'if s.received==1 then return "IZ2S_MAILBOX_V3;phase=ping-verified" end',
 'return "IZ2S_MAILBOX_V3;phase=started"'
].join('\n');
const SCRIPTS=Object.freeze({start:SCRIPT_START,ping:command('ping',1),park:command('park',2),status:SCRIPT_STATUS});
const PHASES=new Set(['old-worker-present','already-created','unsupported','channels-error','filedata-error','create-error','start-error','started','not-started','out-of-order','send-uncertain','ping-sent','park-sent','pending','receive-error','reply-mismatch','thread-state-error','unexpected-exit','ping-verified','parked-alive']);
function parse(reply){
 if(typeof reply!=='string'||!reply.startsWith('-> '))throw Error('Invalid V3 RPC framing');
 const m=/^IZ2S_MAILBOX_V3;phase=([a-z-]+)$/.exec(reply.slice(3).trim());
 if(!m||!PHASES.has(m[1]))throw Error('Invalid V3 RPC response');
 return {backend:'balatro',mode:'title-worker-v3-nonterminating',phase:m[1],
  pingVerified:m[1]==='ping-verified',
  parkedWorkerStillRunning:m[1]==='parked-alive',
  workerExitRequested:false,workerJoined:false,workerReleased:false,
  nativeSupervisorRunning:false,ready:false};
}
async function inspect(host,op,{port=9026,send=request}={}){
 if(typeof host!=='string'||!host||/\s/.test(host))throw Error('Invalid Balatro host');
 if(!Object.prototype.hasOwnProperty.call(SCRIPTS,op))throw Error('Unknown V3 operation');
 if(!Number.isInteger(port)||port<1||port>65535)throw Error('Invalid RPC port');
 return parse(await send({host,port,lua:SCRIPTS[op],timeoutMs:5000,maxReplyBytes:1024}));
}
async function main(){
 const [host,op]=process.argv.slice(2);
 if(!host||!op){console.error('Usage: node title-worker-mailbox-v3.cjs <switch-ip> start|ping|park|status');process.exitCode=2;return}
 try{console.log(JSON.stringify(await inspect(host,op),null,2))}
 catch(e){console.error(JSON.stringify({phase:'error',ready:false,error:e.message}));process.exitCode=1}
}
if(require.main===module)main();
module.exports={KEY,SCRIPTS,PHASES,parse,inspect};
