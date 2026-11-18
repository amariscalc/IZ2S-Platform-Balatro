#!/usr/bin/env node
'use strict';
// Read-only, title-local native bridge preflight. No FFI calls, pointer
// dereferences, allocations, service access, memory reads/writes or NRO loads.
const {request}=require('./rpc.cjs');
const {inspect}=require('./compatibility.cjs');
const PROBE=[
  'local bridge=type(love)=="table" and love.ffi or nil',
  'local app=package.loaded["bl.app"]',
  'local info=type(app)=="table" and app.info or nil',
  'return "bridge_table="..tostring(type(bridge)=="table")',
  ' .. ";declare_present="..tostring(type(bridge)=="table" and type(bridge.declare)=="function")',
  ' .. ";invoke_present="..tostring(type(bridge)=="table" and type(bridge.invoke)=="function")',
  ' .. ";sdk_base_present="..tostring(type(info)=="table" and info.sdk_base~=nil)',
].join('\n');
const KEYS=Object.freeze(['bridge_table','declare_present','invoke_present','sdk_base_present']);
function parse(reply){
  if(typeof reply!=='string'||!reply.startsWith('-> '))throw Error('Unexpected Balatro preflight response');
  const parts=reply.slice(3).trim().split(';');
  if(parts.length!==KEYS.length)throw Error('Unexpected Balatro preflight field count');
  const fields=Object.create(null);
  for(const part of parts){
    const index=part.indexOf('=');
    if(index<1)throw Error('Malformed preflight field');
    const key=part.slice(0,index),value=part.slice(index+1);
    if(!KEYS.includes(key)||Object.hasOwn(fields,key)||!['true','false'].includes(value))
      throw Error('Unexpected or duplicate preflight field');
    fields[key]=value==='true';
  }
  if(KEYS.some(key=>!Object.hasOwn(fields,key)))throw Error('Missing preflight field');
  return Object.fromEntries(KEYS.map(key=>[key,fields[key]]));
}
function report(evidence){
  if(!evidence||typeof evidence!=='object'||Array.isArray(evidence)||
     KEYS.some(key=>typeof evidence[key]!=='boolean'))
    throw Error('Invalid preflight evidence');
  return {
    backend:'balatro',mode:'read-only-preflight',evidence,
    bridgeInterfaceReported:evidence.bridge_table&&evidence.declare_present&&evidence.invoke_present,
    sdkBaseReported:evidence.sdk_base_present,
    sdkInstructionVerification:'not-performed',
    nativeCallAttempted:false,nroLoadAttempted:false,
    iz2s:inspect({native_declare:evidence.declare_present,
      native_invoke:evidence.invoke_present,sdk_base_present:evidence.sdk_base_present}),
  };
}
async function audit(host,options={}){
  return report(parse(await request({host,lua:PROBE,...options})));
}
async function main(){
  const [host,portArg]=process.argv.slice(2);
  if(!host||process.argv.includes('--help')){
    console.log('Usage: node native-preflight.cjs <switch-ip> [port]');
    process.exitCode=host?0:2;return;
  }
  try { console.log(JSON.stringify(await audit(host,{port:portArg?Number(portArg):9026}),null,2)); }
  catch(error){console.error(JSON.stringify({backend:'balatro',ready:false,error:error.message}));process.exitCode=1;}
}
if(require.main===module)main();
module.exports={PROBE,KEYS,parse,report,audit};
