#!/usr/bin/env node
'use strict';
// Actual PC <-> title-owned buffer transfer. No raw address, service IPC,
// native heap allocation, code mapping, SD install or application launch.
const fs=require('node:fs');
const path=require('node:path');
const crypto=require('node:crypto');
const {request}=require('./rpc.cjs');
const SOURCE=fs.readFileSync(path.join(__dirname,'owned-binary.lua'),'utf8');
const OPS=Object.freeze(['init','status','alloc','write','read','release','clear']);
const SESSION=/^[a-f0-9]{32}$/;
const MAX_BUFFER=65536,MAX_WRITE=1024,MAX_REPLY=16384;
const number=(n,max,label)=>{
 if(!Number.isSafeInteger(n)||n<0||n>max)throw Error('Invalid '+label);
 return n;
};
function script(op,{token,id=0,offset=0,length=0,hex=''}={}){
 if(!OPS.includes(op))throw Error('Unsupported binary operation');
 if(typeof token!=='string'||!SESSION.test(token))throw Error('Invalid owned session token');
 number(id,65535,'handle');number(offset,MAX_BUFFER,'offset');
 number(length,MAX_BUFFER,'length');
 if(typeof hex!=='string'||(hex&&!/^[0-9a-f]+$/.test(hex))||hex.length>MAX_WRITE*2)
  throw Error('Invalid hexadecimal payload');
 if(op==='write'&&(length>MAX_WRITE||hex.length!==2*length))throw Error('Invalid write size');
 if(op==='read'&&(length>MAX_WRITE||hex))throw Error('Invalid read size');
 if(op!=='write'&&hex)throw Error('Hex bytes require write');
 if(op==='alloc'&&(length<1||length>MAX_BUFFER))throw Error('Invalid allocation');
 if(['status','release','clear','init'].includes(op)&&(offset!==0||length!==0))
  throw Error('Unexpected binary transfer range');
 const replacements=[
  ['local OP="status"',`local OP="${op}"`],
  ['local TOKEN="none"',`local TOKEN="${token}"`],
  ['local ID=0',`local ID=${id}`],
  ['local OFFSET=0',`local OFFSET=${offset}`],
  ['local LENGTH=0',`local LENGTH=${length}`],
  ['local HEX=""',`local HEX="${hex}"`],
 ];
 let lua=SOURCE;
 for(const [a,b] of replacements){
  if(!lua.includes(a))throw Error('Missing Lua-owned binary anchor');
  lua=lua.replace(a,b);
 }
 if(Buffer.byteLength(lua)>8192)throw Error('Owned binary RPC exceeds 8192 bytes');
 return lua;
}
function parse(reply,op,length=0){
 if(typeof reply!=='string'||!reply.startsWith('-> '))
  throw Error('Invalid owned binary RPC framing');
 const m=/^IZ2S_BINARY_V1;state=(ok|blocked);detail=([a-z_]+);value=([0-9a-f]*)$/.exec(reply.slice(3).trim());
 if(!m)throw Error('Malformed binary RPC response');
 const [,state,detail,value]=m;
 const blocked=new Set(['in_use','ffi_missing','not_initialized','session_mismatch',
  'stale_handle','bounds','quota','invalid_hex','invalid_operation','operation_failed']);
 if(state==='blocked'){
  if(!blocked.has(detail)||value!=='0')throw Error('Contradictory binary RPC rejection');
  return {backend:'balatro',operation:op,state,detail,nativeTransportReady:false,ready:false};
 }
 if(detail!=='none')throw Error('Unexpected binary success detail');
 if(op==='read'){
  if(value.length!==2*length||!/^[a-f0-9]*$/.test(value))throw Error('Binary read length mismatch');
  return {backend:'balatro',operation:op,state,value:Buffer.from(value,'hex'),bytes:length,
   scope:'title-owned-buffer',nativeTransportReady:false,ready:false};
 }
 if(!/^(0|[1-9][0-9]{0,5})$/.test(value))throw Error('Malformed binary integer');
 const count=Number(value);
 if((op==='init'||op==='clear')&&count!==0||
   op==='write'&&count!==length||
   op==='alloc'&&(count<1||count>65535)||
   op==='status'&&count>131072||
   op==='release'&&count>131072)
  throw Error('Impossible owned binary operation result');
 return {backend:'balatro',operation:op,state,value:count,
  scope:'title-owned-buffer',nativeTransportReady:false,ready:false};
}
function create({host,port=9026,send=request,token=crypto.randomBytes(16).toString('hex')}={}){
 if(typeof host!=='string'||!host.trim()||/\s/.test(host))throw Error('Invalid console host');
 if(!Number.isInteger(port)||port<1||port>65535)throw Error('Invalid port');
 if(!SESSION.test(token)||typeof send!=='function')throw Error('Invalid session input');
 async function run(op,params={}){
  const reply=await send({host,port,timeoutMs:10000,maxReplyBytes:MAX_REPLY,lua:script(op,{...params,token})});
  return parse(reply,op,params.length||0);
 }
 return Object.freeze({
  async init(){return run('init');},
  async status(){return run('status');},
  async alloc(size){return run('alloc',{length:size});},
  async write(handle,offset,data){
   if(!Buffer.isBuffer(data)||data.length>MAX_WRITE)throw Error('Expected a bounded Buffer');
   return run('write',{id:handle,offset,length:data.length,hex:data.toString('hex')});
  },
  async read(handle,offset,length){return run('read',{id:handle,offset,length});},
  async release(handle){return run('release',{id:handle});},
  async clear(){return run('clear');},
  mode:'title-owned-rpc',nativeTransportReady:false,
 });
}
async function check(host,{port=9026,send=request}={}){
 const session=create({host,port,send});const steps=[];
 let initialized=false,handle=null;
 try{
  const start=await session.init();steps.push({operation:'init',state:start.state});
  if(start.state!=='ok')return {phase:'blocked',blocker:start.detail,steps,ready:false};
  initialized=true;
  const allocation=await session.alloc(64);
  if(allocation.state!=='ok')throw Error('Title-owned allocation rejected: '+allocation.detail);
  handle=allocation.value;steps.push({operation:'alloc',state:'ok'});
  const bytes=Buffer.from(Array.from({length:64},(_,i)=>(i*37+11)%256));
  for(let offset=0;offset<64;offset+=16){
   const part=bytes.subarray(offset,offset+16);
   const written=await session.write(handle,offset,part);
   if(written.state!=='ok')throw Error('Title-owned write failed');
  }
  const parts=[];
  for(let offset=0;offset<64;offset+=16){
   const read=await session.read(handle,offset,16);
   if(read.state!=='ok')throw Error('Title-owned read failed');
   parts.push(read.value);
  }
  if(!Buffer.concat(parts).equals(bytes))throw Error('Title-owned bytes differ after RPC round trip');
  steps.push({operation:'roundtrip',state:'verified',bytes:64});
  const released=await session.release(handle);
  if(released.state!=='ok'||released.value!==0)throw Error('Title-owned release did not clear allocation');
  handle=null;steps.push({operation:'release',state:'ok'});
  return {backend:'balatro',mode:'title-owned-binary-transport',
   phase:'verified',bytes:64,checks:steps.length,steps,
   arbitraryMemoryAccessVerified:false,serviceIpcVerified:false,
   executableMappingVerified:false,nativeTransportReady:false,
   nativeSupervisorRunning:false,ready:false};
 }finally{
  if(initialized){
   // Only the freshly created, randomly scoped session is cleared.
   try{await session.clear();}catch{}
  }
 }
}
async function main(){
 const [host,action='check',portArg]=process.argv.slice(2);
 if(!host||action!=='check'){
  console.error('Usage: node owned-binary.cjs <switch-ip> check [port]');
  process.exitCode=2;return;
 }
 try{
  const result=await check(host,{port:portArg?Number(portArg):9026});
  console.log(JSON.stringify(result,null,2));
  if(result.phase!=='verified')process.exitCode=1;
 }catch(e){
  console.error(JSON.stringify({backend:'balatro',phase:'error',ready:false,error:e.message}));
  process.exitCode=1;
 }
}
if(require.main===module)main();
module.exports={SOURCE,OPS,MAX_BUFFER,MAX_WRITE,script,parse,create,check};
