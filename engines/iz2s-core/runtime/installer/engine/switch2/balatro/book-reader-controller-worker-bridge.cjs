#!/usr/bin/env node
'use strict';
// V4 title-local bridge: Book Reader controller A -> fixed worker acknowledgment.
// Does not execute native IZ2S or load a package. Never terminates/joins threads.
// A fresh Balatro process is needed if a prior V1/V2/V3 worker exists.
const {request}=require('./rpc.cjs');
const START=[
 'if rawget(_G,"__IZ2S_BOOK_READER_MAILBOX_V1") or rawget(_G,"__IZ2S_BOOK_READER_MAILBOX_V2") or rawget(_G,"__IZ2S_BOOK_READER_MAILBOX_V3") then return "IZ2S_BOOK_BRIDGE_V1;phase=older-worker-present" end',
 'local key="__IZ2S_BOOK_READER_CONTROLLER_BRIDGE_V1"',
 'if rawget(_G,key)~=nil then return "IZ2S_BOOK_BRIDGE_V1;phase=already-started" end',
 'local f=type(love)=="table" and love.filesystem or nil',
 'local t=type(love)=="table" and love.thread or nil',
 'if not(f and t and type(f.newFileData)=="function" and type(t.newThread)=="function" and type(t.getChannel)=="function") then return "IZ2S_BOOK_BRIDGE_V1;phase=unsupported" end',
 'local s={phase="initializing",armedAt=-1,dispatched=false,ack=false}',
 'rawset(_G,key,s)',
 'local stage="channels"',
 'local ok=pcall(function()',
 ' s.input=t.getChannel("iz2s_book_reader_bridge_in")',
 ' s.output=t.getChannel("iz2s_book_reader_bridge_out")',
 ' s.input:clear();s.output:clear()',
 ' stage="filedata"',
 ' local code=[[',
 '  local tin=love.thread.getChannel("iz2s_book_reader_bridge_in")',
 '  local tout=love.thread.getChannel("iz2s_book_reader_bridge_out")',
 '  local served=false',
 '  while true do',
 '   local msg=tin:demand()',
 '   if msg=="book-reader:1" and not served then',
 '    served=true;tout:push("book-reader-received:1")',
 '   else tout:push("rejected") end',
 '  end',
 ' ]]',
 ' s.data=f.newFileData(code,"iz2s-book-reader-controller-bridge.lua")',
 ' stage="create"',
 ' s.worker=t.newThread(s.data)',
 ' stage="start"',
 ' s.worker:start()',
 'end)',
 's.phase=ok and "started" or stage.."-error"',
 'return "IZ2S_BOOK_BRIDGE_V1;phase="..s.phase'
].join('\n');
const ARM=[
 'local s=rawget(_G,"__IZ2S_BOOK_READER_CONTROLLER_BRIDGE_V1")',
 'if type(s)~="table" or s.phase~="started" then return "IZ2S_BOOK_BRIDGE_V1;phase=not-started" end',
 'if s.armedAt>=0 then return "IZ2S_BOOK_BRIDGE_V1;phase=already-armed" end',
 'local a=rawget(_G,"__IZ2S_CANONICAL_FOCUS_LUA_V1")',
 'if type(a)~="table" or type(a.detail)~="table" or a.detail.id~="book-reader" then return "IZ2S_BOOK_BRIDGE_V1;phase=not-selected" end',
 'local n=tonumber(a.bookReaderLaunchRequests) or 0',
 'if n<0 or n>999999998 or n~=math.floor(n) then return "IZ2S_BOOK_BRIDGE_V1;phase=invalid-counter" end',
 's.armedAt=n',
 'return "IZ2S_BOOK_BRIDGE_V1;phase=armed"'
].join('\n');
const DISPATCH=[
 'local s=rawget(_G,"__IZ2S_BOOK_READER_CONTROLLER_BRIDGE_V1")',
 'if type(s)~="table" or s.phase~="started" then return "IZ2S_BOOK_BRIDGE_V1;phase=not-started" end',
 'if s.armedAt<0 then return "IZ2S_BOOK_BRIDGE_V1;phase=not-armed" end',
 'if s.dispatched then return "IZ2S_BOOK_BRIDGE_V1;phase=already-dispatched" end',
 'local a=rawget(_G,"__IZ2S_CANONICAL_FOCUS_LUA_V1")',
 'if type(a)~="table" or type(a.detail)~="table" or a.detail.id~="book-reader" then s.phase="selection-changed";return "IZ2S_BOOK_BRIDGE_V1;phase=selection-changed" end',
 'local n=tonumber(a.bookReaderLaunchRequests) or -1',
 'if n==s.armedAt then return "IZ2S_BOOK_BRIDGE_V1;phase=awaiting-button" end',
 'if n~=s.armedAt+1 then s.phase="counter-skipped";return "IZ2S_BOOK_BRIDGE_V1;phase=counter-skipped" end',
 's.dispatched=true',
 'local ok=pcall(function() s.input:push("book-reader:1") end)',
 'if not ok then s.phase="send-uncertain";return "IZ2S_BOOK_BRIDGE_V1;phase=send-uncertain" end',
 'return "IZ2S_BOOK_BRIDGE_V1;phase=dispatched"'
].join('\n');
const STATUS=[
 'local s=rawget(_G,"__IZ2S_BOOK_READER_CONTROLLER_BRIDGE_V1")',
 'if type(s)~="table" then return "IZ2S_BOOK_BRIDGE_V1;phase=not-started" end',
 'if s.phase~="started" then return "IZ2S_BOOK_BRIDGE_V1;phase="..s.phase end',
 'if s.ack then return "IZ2S_BOOK_BRIDGE_V1;phase=worker-acknowledged" end',
 'if not s.dispatched then return "IZ2S_BOOK_BRIDGE_V1;phase=not-dispatched" end',
 'local ok,v=pcall(function() return s.output:pop() end)',
 'if not ok then s.phase="receive-error";return "IZ2S_BOOK_BRIDGE_V1;phase=receive-error" end',
 'if v==nil then return "IZ2S_BOOK_BRIDGE_V1;phase=pending" end',
 'if v~="book-reader-received:1" then s.phase="wrong-reply";return "IZ2S_BOOK_BRIDGE_V1;phase=wrong-reply" end',
 's.ack=true',
 'return "IZ2S_BOOK_BRIDGE_V1;phase=worker-acknowledged"'
].join('\n');
const SCRIPTS=Object.freeze({start:START,arm:ARM,dispatch:DISPATCH,status:STATUS});
const PHASES=new Set(['older-worker-present','already-started','unsupported','channels-error','filedata-error','create-error','start-error','started','not-started','already-armed','not-selected','invalid-counter','armed','not-armed','already-dispatched','selection-changed','awaiting-button','counter-skipped','send-uncertain','dispatched','not-dispatched','receive-error','pending','wrong-reply','worker-acknowledged']);
function parse(reply){
 if(typeof reply!=='string'||!reply.startsWith('-> '))throw Error('Invalid bridge RPC framing');
 const m=/^IZ2S_BOOK_BRIDGE_V1;phase=([a-z-]+)$/.exec(reply.slice(3).trim());
 if(!m||!PHASES.has(m[1]))throw Error('Invalid bridge response');
 return {backend:'balatro',mode:'book-reader-controller-worker-bridge',phase:m[1],
  controllerRequestDeliveredToWorker:m[1]==='worker-acknowledged',
  originalNativeSupervisorStarted:false,originalBookReaderExecuted:false,ready:false};
}
async function inspect(host,op,{port=9026,send=request}={}){
 if(typeof host!=='string'||!host||/\s/.test(host))throw Error('Invalid Balatro host');
 if(!Object.prototype.hasOwnProperty.call(SCRIPTS,op))throw Error('Unknown bridge operation');
 if(!Number.isInteger(port)||port<1||port>65535)throw Error('Invalid RPC port');
 return parse(await send({host,port,lua:SCRIPTS[op],timeoutMs:5000,maxReplyBytes:1024}));
}
async function main(){
 const [host,op]=process.argv.slice(2);
 if(!host||!op){console.error('Usage: node book-reader-controller-worker-bridge.cjs <switch-ip> start|arm|dispatch|status');process.exitCode=2;return;}
 try{console.log(JSON.stringify(await inspect(host,op),null,2));}
 catch(e){console.error(JSON.stringify({phase:'error',ready:false,error:e.message}));process.exitCode=1;}
}
if(require.main===module)main();
module.exports={SCRIPTS,PHASES,parse,inspect};
