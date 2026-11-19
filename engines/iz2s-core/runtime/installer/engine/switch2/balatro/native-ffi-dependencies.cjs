#!/usr/bin/env node
'use strict';
// Read-only lexical dependency inventory for the Lua FFI wrappers.
// Returns bounded upvalue NAMES, never values, pointers, addresses or code.
// No FFI function is invoked, and no native memory or context is touched.
const {request}=require('./rpc.cjs');
const NAMES=Object.freeze(['invoke','declare','describe','metatype','native_ready','u64_eq','u64_is_zero']);
const LUA=[
 'local f=type(love)=="table" and love.ffi or nil',
 'local dbg=type(debug)=="table" and debug.getupvalue or nil',
 'local names={"invoke","declare","describe","metatype","native_ready","u64_eq","u64_is_zero"}',
 'local function capture(name)',
 ' if type(f)~="table" or type(f[name])~="function" then return "missing" end',
 ' if type(dbg)~="function" then return "unavailable" end',
 ' local result={}',
 ' for i=1,24 do',
 '  local ok,k=pcall(function() local n=dbg(f[name],i);return n end)',
 '  if not ok then return "error" end',
 '  if k==nil then break end',
 '  if type(k)=="string" and k:match("^[%a_][%w_]*$") and #k<=32 then',
 '   result[#result+1]=k',
 '  else result[#result+1]="anonymous" end',
 ' end',
 ' return #result==0 and "none" or table.concat(result,".")',
 'end',
 'local out={}',
 'for _,n in ipairs(names) do out[#out+1]=n..":"..capture(n) end',
 'return "IZ2S_FFI_UPVALUES_V1;"..table.concat(out,";")',
].join('\n');
function parse(reply){
 if(typeof reply!=='string'||!reply.startsWith('-> '))throw Error('Invalid FFI dependency framing');
 const raw=reply.slice(3).trim();
 const m=/^IZ2S_FFI_UPVALUES_V1;(.*)$/.exec(raw);
 if(!m)throw Error('Invalid FFI dependency response');
 const entries=m[1].split(';');
 if(entries.length!==NAMES.length)throw Error('Invalid number of FFI dependency records');
 const dependencies={};
 for(let i=0;i<NAMES.length;i++){
  const pivot=entries[i].indexOf(':');
  if(pivot<0||entries[i].slice(0,pivot)!==NAMES[i])throw Error('Wrong FFI dependency order');
  const v=entries[i].slice(pivot+1);
  if(['missing','unavailable','error','none'].includes(v)){
   dependencies[NAMES[i]]={state:v,names:[]};continue;
  }
  const keys=v.split('.');
  if(keys.length>24||keys.some(k=>!/^[A-Za-z_][A-Za-z0-9_]{0,31}$/.test(k)))throw Error('Invalid FFI dependency key');
  dependencies[NAMES[i]]={state:'observed',names:keys};
 }
 return {backend:'balatro',mode:'ffi-wrapper-lexical-dependencies',phase:'upvalue-names-observed',
  dependencies,upvalueValuesExposed:false,ffiFunctionsCalled:false,
  nativeCallsPerformed:false,executableMappingVerified:false,ready:false};
}
async function inspect(host,{port=9026,send=request}={}){
 if(typeof host!=='string'||!host||/\s/.test(host))throw Error('Invalid host');
 if(!Number.isInteger(port)||port<1||port>65535)throw Error('Invalid port');
 return parse(await send({host,port,lua:LUA,timeoutMs:5000,maxReplyBytes:4096}));
}
async function main(){
 const [host,portRaw]=process.argv.slice(2);
 if(!host){console.error('Usage: node native-ffi-dependencies.cjs <switch-ip> [port]');process.exitCode=2;return;}
 try{console.log(JSON.stringify(await inspect(host,{port:portRaw?Number(portRaw):9026}),null,2));}
 catch(error){console.error(JSON.stringify({phase:'error',ready:false,error:error.message}));process.exitCode=1}
}
if(require.main===module)main();
module.exports={NAMES,LUA,parse,inspect};
