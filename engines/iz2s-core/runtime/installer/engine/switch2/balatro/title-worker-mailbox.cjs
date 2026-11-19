#!/usr/bin/env node
'use strict';
// Balatro-only retained Lua worker mailbox. Commands are fixed, title-local,
// and do not touch kernel services, native memory, code mapping or filesystem.
// START once per title session. No wait, thread release, or automatic retry.
const {request}=require('./rpc.cjs');
const KEY='__IZ2S_BOOK_READER_MAILBOX_V1';
const CHANNEL='iz2s_book_reader_mailbox_v1';
const luaStart=[
 'local key="__IZ2S_BOOK_READER_MAILBOX_V1"',
 'if rawget(_G,key)~=nil then return "IZ2S_MAILBOX_V1;phase=already-started" end',
 'local t=type(love)=="table" and love.thread or nil',
 'local f=type(love)=="table" and love.filesystem or nil',
 'if not(t and f and type(t.getChannel)=="function" and type(t.newThread)=="function" and type(f.newFileData)=="function") then',
 ' return "IZ2S_MAILBOX_V1;phase=unsupported" end',
 'local state={phase="starting",sequence=0,received=0}',
 'rawset(_G,key,state)',
 'local phase="channels"',
 'local ok=pcall(function()',
 ' state.inbox=t.getChannel("iz2s_book_reader_mailbox_v1_in")',
 ' state.outbox=t.getChannel("iz2s_book_reader_mailbox_v1_out")',
 ' state.inbox:clear();state.outbox:clear()',
 ' phase="filedata"',
 ' local code=[[',
 '  local tin=love.thread.getChannel("iz2s_book_reader_mailbox_v1_in")',
 '  local tout=love.thread.getChannel("iz2s_book_reader_mailbox_v1_out")',
 '  while true do',
 '   local packet=tin:demand()',
 '   if packet=="ping:1" then tout:push("pong:1")',
 '   elseif packet=="checksum:2" then tout:push("checksum:2:42")',
 '   else tout:push("unsupported") end',
 '  end',
 ' ]]',
 ' state.data=f.newFileData(code,"iz2s-book-reader-mailbox.lua")',
 ' phase="create"',
 ' state.worker=t.newThread(state.data)',
 ' phase="start"',
 ' state.worker:start()',
 'end)',
 'state.phase=ok and "started" or phase.."-error"',
 'return "IZ2S_MAILBOX_V1;phase="..state.phase'
].join('\n');
const luaCommand=[
 'local s=rawget(_G,"__IZ2S_BOOK_READER_MAILBOX_V1")',
 'if type(s)~="table" or s.phase~="started" then return "IZ2S_MAILBOX_V1;phase=not-started" end',
 'if s.sequence~=0 then return "IZ2S_MAILBOX_V1;phase=command-already-sent" end',
 'local ok=pcall(function() s.inbox:push("ping:1");s.sequence=1 end)',
 'return "IZ2S_MAILBOX_V1;phase="..(ok and "sent" or "send-error")'
].join('\n');
const luaStatus=[
 'local s=rawget(_G,"__IZ2S_BOOK_READER_MAILBOX_V1")',
 'if type(s)~="table" or s.phase~="started" then return "IZ2S_MAILBOX_V1;phase=not-started" end',
 'if s.received==1 then return "IZ2S_MAILBOX_V1;phase=verified" end',
 'if s.sequence~=1 then return "IZ2S_MAILBOX_V1;phase=waiting-command" end',
 'local ok,msg=pcall(function() return s.outbox:pop() end)',
 'if not ok then return "IZ2S_MAILBOX_V1;phase=receive-error" end',
 'if msg==nil then return "IZ2S_MAILBOX_V1;phase=pending" end',
 'if msg~="pong:1" then return "IZ2S_MAILBOX_V1;phase=unexpected-response" end',
 's.received=1',
 'return "IZ2S_MAILBOX_V1;phase=verified"'
].join('\n');
// The currently running worker already accepts checksum:2. Extend its
// controller without replacing or restarting the retained title worker.
const luaChecksum=[
 'local s=rawget(_G,"__IZ2S_BOOK_READER_MAILBOX_V1")',
 'if type(s)~="table" or s.phase~="started" then return "IZ2S_MAILBOX_V1;phase=not-started" end',
 'if s.received~=1 then return "IZ2S_MAILBOX_V1;phase=ping-not-verified" end',
 'if s.checksumSent then return "IZ2S_MAILBOX_V1;phase=checksum-already-sent" end',
 's.checksumSent=true',
 'local ok=pcall(function() s.inbox:push("checksum:2") end)',
 'if not ok then return "IZ2S_MAILBOX_V1;phase=checksum-send-error" end',
 'return "IZ2S_MAILBOX_V1;phase=checksum-sent"'
].join('\n');
const luaChecksumStatus=[
 'local s=rawget(_G,"__IZ2S_BOOK_READER_MAILBOX_V1")',
 'if type(s)~="table" or s.phase~="started" then return "IZ2S_MAILBOX_V1;phase=not-started" end',
 'if s.checksumReceived then return "IZ2S_MAILBOX_V1;phase=checksum-verified" end',
 'if not s.checksumSent then return "IZ2S_MAILBOX_V1;phase=checksum-not-sent" end',
 'local ok,msg=pcall(function() return s.outbox:pop() end)',
 'if not ok then return "IZ2S_MAILBOX_V1;phase=checksum-receive-error" end',
 'if msg==nil then return "IZ2S_MAILBOX_V1;phase=checksum-pending" end',
 'if msg~="checksum:2:42" then return "IZ2S_MAILBOX_V1;phase=checksum-mismatch" end',
 's.checksumReceived=true',
 'return "IZ2S_MAILBOX_V1;phase=checksum-verified"'
].join('\n');
const SCRIPTS=Object.freeze({start:luaStart,send:luaCommand,status:luaStatus,
 checksum:luaChecksum,checksumStatus:luaChecksumStatus});
const PHASES=new Set(['already-started','unsupported','channels-error','filedata-error','create-error','start-error',
 'started','not-started','command-already-sent','sent','send-error','waiting-command','pending','receive-error',
 'unexpected-response','verified','ping-not-verified','checksum-already-sent',
 'checksum-send-error','checksum-sent','checksum-not-sent','checksum-receive-error',
 'checksum-pending','checksum-mismatch','checksum-verified']);
function parse(reply){
 if(typeof reply!=='string'||!reply.startsWith('-> '))throw Error('Invalid mailbox RPC framing');
 const m=/^IZ2S_MAILBOX_V1;phase=([a-z-]+)$/.exec(reply.slice(3).trim());
 if(!m||!PHASES.has(m[1]))throw Error('Malformed mailbox response');
 return {backend:'balatro',mode:'persistent-title-worker-mailbox',phase:m[1],
  commandRoundtripVerified:m[1]==='verified',
  secondCommandRoundtripVerified:m[1]==='checksum-verified',
  workerReferencesRetained:true,workerJoined:false,
  nativeTransportReady:false,nativeSupervisorRunning:false,ready:false};
}
async function inspect(host,op,{port=9026,send=request}={}){
 if(typeof host!=='string'||!host||/\s/.test(host))throw Error('Invalid Balatro host');
 if(!Object.prototype.hasOwnProperty.call(SCRIPTS,op))throw Error('Unknown mailbox operation');
 if(!Number.isInteger(port)||port<1||port>65535)throw Error('Invalid RPC port');
 return parse(await send({host,port,lua:SCRIPTS[op],timeoutMs:5000,maxReplyBytes:1024}));
}
async function main(){
 const [host,op]=process.argv.slice(2);
 if(!host||!op){console.error('Usage: node title-worker-mailbox.cjs <switch-ip> start|send|status|checksum|checksumStatus');process.exitCode=2;return;}
 try{console.log(JSON.stringify(await inspect(host,op),null,2));}
 catch(e){console.error(JSON.stringify({phase:'error',ready:false,error:e.message}));process.exitCode=1;}
}
if(require.main===module)main();
module.exports={KEY,CHANNEL,SCRIPTS,PHASES,parse,inspect};
