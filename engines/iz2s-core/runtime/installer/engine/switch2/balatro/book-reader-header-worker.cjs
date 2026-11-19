#!/usr/bin/env node
'use strict';
// Book Reader controller A -> persistent worker ABI2 section-table validation.
// Does not execute native IZ2S or load a package. Never terminates/joins threads.
// A fresh Balatro process is needed if a prior V1/V2/V3 worker exists.
const {request}=require('./rpc.cjs');
const fs=require('node:fs/promises'),crypto=require('node:crypto');
const codec=require('../../../../../../../core/console/sd-launcher/package.cjs');
const {verify}=require('./original-book-reader-handoff.cjs');
const START=[
 'if rawget(_G,"__IZ2S_BOOK_READER_MAILBOX_V1") or rawget(_G,"__IZ2S_BOOK_READER_MAILBOX_V2") or rawget(_G,"__IZ2S_BOOK_READER_MAILBOX_V3") or rawget(_G,"__IZ2S_BOOK_READER_CONTROLLER_BRIDGE_V1") then return "IZ2S_BOOK_HEADER_WORKER_V1;phase=older-worker-present" end',
 'local key="__IZ2S_BOOK_READER_HEADER_WORKER_V1"',
 'if rawget(_G,key)~=nil then return "IZ2S_BOOK_HEADER_WORKER_V1;phase=already-started" end',
 'local f=type(love)=="table" and love.filesystem or nil',
 'local t=type(love)=="table" and love.thread or nil',
 'if not(f and t and type(f.newFileData)=="function" and type(t.newThread)=="function" and type(t.getChannel)=="function") then return "IZ2S_BOOK_HEADER_WORKER_V1;phase=unsupported" end',
 'local s={phase="initializing",armedAt=-1,dispatched=false,ack=false,header=nil}',
 'rawset(_G,key,s)',
 'local stage="channels"',
 'local ok=pcall(function()',
 ' s.input=t.getChannel("iz2s_book_reader_header_worker_in")',
 ' s.output=t.getChannel("iz2s_book_reader_header_worker_out")',
 ' s.input:clear();s.output:clear()',
 ' stage="filedata"',
 ' local code=[[',
 '  local tin=love.thread.getChannel("iz2s_book_reader_header_worker_in")',
 '  local tout=love.thread.getChannel("iz2s_book_reader_header_worker_out")',
 '  local served=false',
 '  local function u32(b,p) local a,c,d,e=b:byte(p,p+3);return a+c*256+d*65536+e*16777216 end',
 '  while true do',
 '   local msg=tin:demand()',
 '   if type(msg)=="string" and msg:sub(1,7)=="header:" and not served then',
 '    served=true',
 '    local hex=msg:sub(8)',
 '    if #hex~=1024 or hex:find("[^0-9a-f]") then tout:push("header-rejected")',
 '    else',
 '     local b=hex:gsub("..",function(h)return string.char(tonumber(h,16)) end)',
 '     local id=b:sub(25,72):match("^([^%z]+)")',
 '     local valid=b:sub(1,8)=="IZSDAPP1" and u32(b,9)==2 and u32(b,13)==512',
 '     valid=valid and id=="book-reader" and u32(b,17)>=512 and u32(b,17)<=33554432',
 '     local total=u32(b,17)',
 '     local privateBytes=u32(b,137)',
 '     local nativeDataBytes=u32(b,157)',
 '     valid=valid and u32(b,21)%2==1 and nativeDataBytes>0',
 '     valid=valid and nativeDataBytes<=33554432 and nativeDataBytes%4096==0',
 '     valid=valid and privateBytes<=134217728 and privateBytes%4096==0',
 '     local ends=512',
 '     local lengths={}',
 '     for i=0,11 do',
 '      local pos=177+i*16',
 '      local off=u32(b,pos)',
 '      local len=u32(b,pos+4)',
 '      local crc=u32(b,pos+8)',
 '      local reserved=u32(b,pos+12)',
 '      lengths[i+1]=len',
 '      valid=valid and reserved==0',
 '      if len==0 then',
 '       valid=valid and off==0 and crc==0',
 '      else',
 '       valid=valid and off>=ends and off%4==0 and off<=total and len<=total-off',
 '       if off>=ends and len<=total-off then ends=off+len end',
 '      end',
 '     end',
 '     valid=valid and lengths[1]==1024 and lengths[2]<=7340032',
 '     valid=valid and lengths[9]==131072 and lengths[8]<=privateBytes',
 '     valid=valid and lengths[11]>=4 and lengths[11]<=16777216 and lengths[11]%4==0',
 '     valid=valid and lengths[12]<=nativeDataBytes',
 '     tout:push(valid and "header-verified:1" or "header-rejected")',
 '    end',
 '   else tout:push("rejected") end',
 '  end',
 ' ]]',
 ' s.data=f.newFileData(code,"iz2s-book-reader-header-worker.lua")',
 ' stage="create"',
 ' s.worker=t.newThread(s.data)',
 ' stage="start"',
 ' s.worker:start()',
 'end)',
 's.phase=ok and "started" or stage.."-error"',
 'return "IZ2S_BOOK_HEADER_WORKER_V1;phase="..s.phase'
].join('\n');
const ARM=[
 'local s=rawget(_G,"__IZ2S_BOOK_READER_HEADER_WORKER_V1")',
 'if type(s)~="table" or s.phase~="started" then return "IZ2S_BOOK_HEADER_WORKER_V1;phase=not-started" end',
 'if s.armedAt>=0 then return "IZ2S_BOOK_HEADER_WORKER_V1;phase=already-armed" end',
 'local a=rawget(_G,"__IZ2S_CANONICAL_FOCUS_LUA_V1")',
 'if type(a)~="table" or type(a.detail)~="table" or a.detail.id~="book-reader" then return "IZ2S_BOOK_HEADER_WORKER_V1;phase=not-selected" end',
 'local n=tonumber(a.bookReaderLaunchRequests) or 0',
 'if n<0 or n>999999998 or n~=math.floor(n) then return "IZ2S_BOOK_HEADER_WORKER_V1;phase=invalid-counter" end',
 'if type(s.header)~="string" or #s.header~=1024 then return "IZ2S_BOOK_HEADER_WORKER_V1;phase=header-not-staged" end',
 's.armedAt=n',
 'return "IZ2S_BOOK_HEADER_WORKER_V1;phase=armed"'
].join('\n');
const DISPATCH=[
 'local s=rawget(_G,"__IZ2S_BOOK_READER_HEADER_WORKER_V1")',
 'if type(s)~="table" or s.phase~="started" then return "IZ2S_BOOK_HEADER_WORKER_V1;phase=not-started" end',
 'if s.armedAt<0 then return "IZ2S_BOOK_HEADER_WORKER_V1;phase=not-armed" end',
 'if s.dispatched then return "IZ2S_BOOK_HEADER_WORKER_V1;phase=already-dispatched" end',
 'local a=rawget(_G,"__IZ2S_CANONICAL_FOCUS_LUA_V1")',
 'if type(a)~="table" or type(a.detail)~="table" or a.detail.id~="book-reader" then s.phase="selection-changed";return "IZ2S_BOOK_HEADER_WORKER_V1;phase=selection-changed" end',
 'local n=tonumber(a.bookReaderLaunchRequests) or -1',
 'if n==s.armedAt then return "IZ2S_BOOK_HEADER_WORKER_V1;phase=awaiting-button" end',
 'if n~=s.armedAt+1 then s.phase="counter-skipped";return "IZ2S_BOOK_HEADER_WORKER_V1;phase=counter-skipped" end',
 's.dispatched=true',
 'local ok=pcall(function() s.input:push("header:"..s.header) end)',
 'if not ok then s.phase="send-uncertain";return "IZ2S_BOOK_HEADER_WORKER_V1;phase=send-uncertain" end',
 'return "IZ2S_BOOK_HEADER_WORKER_V1;phase=dispatched"'
].join('\n');
const STATUS=[
 'local s=rawget(_G,"__IZ2S_BOOK_READER_HEADER_WORKER_V1")',
 'if type(s)~="table" then return "IZ2S_BOOK_HEADER_WORKER_V1;phase=not-started" end',
 'if s.phase~="started" then return "IZ2S_BOOK_HEADER_WORKER_V1;phase="..s.phase end',
 'if s.ack then return "IZ2S_BOOK_HEADER_WORKER_V1;phase=worker-acknowledged" end',
 'if not s.dispatched then return "IZ2S_BOOK_HEADER_WORKER_V1;phase=not-dispatched" end',
 'local ok,v=pcall(function() return s.output:pop() end)',
 'if not ok then s.phase="receive-error";return "IZ2S_BOOK_HEADER_WORKER_V1;phase=receive-error" end',
 'if v==nil then return "IZ2S_BOOK_HEADER_WORKER_V1;phase=pending" end',
 'if v~="header-verified:1" then s.phase="wrong-reply";return "IZ2S_BOOK_HEADER_WORKER_V1;phase=wrong-reply" end',
 's.ack=true',
 'return "IZ2S_BOOK_HEADER_WORKER_V1;phase=worker-acknowledged"'
].join('\n');
const STAGE_TEMPLATE=[
 'local s=rawget(_G,"__IZ2S_BOOK_READER_HEADER_WORKER_V1")',
 'if type(s)~="table" or s.phase~="started" then return "IZ2S_BOOK_HEADER_WORKER_V1;phase=not-started" end',
 'if s.armedAt>=0 or s.header then return "IZ2S_BOOK_HEADER_WORKER_V1;phase=already-staged" end',
 's.header="__HEADER_HEX__"',
 'return "IZ2S_BOOK_HEADER_WORKER_V1;phase=header-staged"'
].join('\n');
const SCRIPTS=Object.freeze({start:START,arm:ARM,dispatch:DISPATCH,status:STATUS});
async function verifiedHeader(file,expectedSha256){
 const checked=await verify(file,{expectedSha256});
 const bytes=await fs.readFile(checked.packageFile);
 if(bytes.length!==checked.packageBytes||crypto.createHash('sha256').update(bytes).digest('hex')!==checked.packageSha256)throw Error('Package changed after verification');
 const hdr=codec.decodeHeader(bytes.subarray(0,512),bytes.length);
 if(hdr.id!=='book-reader'||hdr.version!==2||hdr.nativeAbi!==2)throw Error('Original Book Reader ABI2 required');
 return bytes.subarray(0,512).toString('hex');
}
const PHASES=new Set(['older-worker-present','already-started','unsupported','channels-error','filedata-error','create-error','start-error','started','not-started','already-armed','not-selected','invalid-counter','armed','not-armed','already-dispatched','selection-changed','awaiting-button','counter-skipped','send-uncertain','dispatched','not-dispatched','receive-error','pending','wrong-reply','worker-acknowledged','header-staged','header-not-staged','already-staged']);
function parse(reply){
 if(typeof reply!=='string'||!reply.startsWith('-> '))throw Error('Invalid bridge RPC framing');
 const m=/^IZ2S_BOOK_HEADER_WORKER_V1;phase=([a-z-]+)$/.exec(reply.slice(3).trim());
 if(!m||!PHASES.has(m[1]))throw Error('Invalid bridge response');
 return {backend:'balatro',mode:'book-reader-controller-worker-bridge',phase:m[1],
  controllerRequestDeliveredToWorker:m[1]==='worker-acknowledged',
  originalHeaderParsedInWorker:m[1]==='worker-acknowledged',
  originalNativeSupervisorStarted:false,originalBookReaderExecuted:false,ready:false};
}
async function inspect(host,op,{port=9026,send=request,headerHex}={}){
 if(typeof host!=='string'||!host||/\s/.test(host))throw Error('Invalid Balatro host');
 if(op!=='stage'&&!Object.prototype.hasOwnProperty.call(SCRIPTS,op))throw Error('Unknown bridge operation');
 if(op==='stage'&&!/^[0-9a-f]{1024}$/.test(headerHex||''))throw Error('Verified 512-byte header required');
 if(!Number.isInteger(port)||port<1||port>65535)throw Error('Invalid RPC port');
 return parse(await send({host,port,lua:op==='stage'?STAGE_TEMPLATE.replace('__HEADER_HEX__',headerHex):SCRIPTS[op],timeoutMs:5000,maxReplyBytes:1024}));
}
async function main(){
 const [host,op,file,sha]=process.argv.slice(2);
 if(!host||!op){console.error('Usage: node book-reader-controller-worker-bridge.cjs <switch-ip> start|stage|arm|dispatch|status [launcher.iza] [sha256]');process.exitCode=2;return;}
 try{console.log(JSON.stringify(await inspect(host,op,op==='stage'?{headerHex:await verifiedHeader(file,sha)}:{}),null,2));}
 catch(e){console.error(JSON.stringify({phase:'error',ready:false,error:e.message}));process.exitCode=1;}
}
if(require.main===module)main();
module.exports={SCRIPTS,STAGE_TEMPLATE,PHASES,parse,inspect,verifiedHeader};
