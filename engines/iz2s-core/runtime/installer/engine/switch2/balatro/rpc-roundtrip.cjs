#!/usr/bin/env node
'use strict';
// Fixed, title-local Lua round trip. No FFI, system API, save or native access.
const {request}=require('./rpc.cjs');
const KEY='__IZ2S_RPC_ROUNDTRIP_V1';
const LUA=Object.freeze({
  begin: 'rawset(_G,"'+KEY+'",42); return "IZ2S_RT_V1;op=begin;value=42"',
  read: 'local n=rawget(_G,"'+KEY+'"); return "IZ2S_RT_V1;op=read;value="..tostring(n)',
  clear: 'rawset(_G,"'+KEY+'",nil); return "IZ2S_RT_V1;op=clear;value=nil"',
});
function parse(reply,operation){
  if(typeof reply!=='string'||!reply.startsWith('-> '))throw Error('Unexpected RPC framing');
  const payload=reply.slice(3).trim();
  const match=/^IZ2S_RT_V1;op=(begin|read|clear);value=(42|nil)$/.exec(payload);
  if(!match||match[1]!==operation)throw Error('Invalid round-trip reply');
  const expected=operation==='clear'?'nil':'42';
  if(match[2]!==expected)throw Error('Title-local round-trip state mismatch');
  return {op:match[1],value:match[2]};
}
async function run(host, options={}, send=request){
  const results=[];
  // Do not retry automatically: an ambiguous response may mean execution happened.
  try{
    for(const op of ['begin','read']){
      const reply=await send({host,port:9026,timeoutMs:5000,lua:LUA[op],...options});
      results.push(parse(reply,op));
    }
    return {backend:'balatro',mode:'title-local-rpc',passed:true,
      persistentAcrossConnections:true,steps:results,executedNativeCalls:false,
      nativeCompatible:false,ready:false};
  }finally{
    // Best-effort cleanup only after begin may have been sent; never mask the first error.
    if(results.length){
      try{parse(await send({host,port:9026,timeoutMs:5000,lua:LUA.clear,...options}),'clear');}
      catch(e){if(results.length===2)throw Error('Round trip succeeded but cleanup failed: '+e.message);}
    }
  }
}
async function main(){
  const [host,portString]=process.argv.slice(2);
  if(!host||process.argv.includes('--help')){
    console.log('Usage: node rpc-roundtrip.cjs <switch-ip> [port]');
    process.exitCode=host?0:2;return;
  }
  try{console.log(JSON.stringify(await run(host,portString?{port:Number(portString)}:{}),null,2));}
  catch(e){console.error(JSON.stringify({backend:'balatro',passed:false,ready:false,error:e.message}));process.exitCode=1;}
}
if(require.main===module)main();
module.exports={KEY,LUA,parse,run};
