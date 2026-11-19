#!/usr/bin/env node
'use strict';
// Fixed read-only shape-only inspection of preexisting Lua FFI dependencies.
// Never returns upvalue values, pointers, native addresses or function bodies.
// Never invokes FFI wrappers or touches context/SD/memory.
const {request}=require('./rpc.cjs');
const WRAPPERS=Object.freeze(['invoke','declare','describe','metatype','native_ready','u64_eq','u64_is_zero']);
const KEYS=Object.freeze(['backend','ffi','victim','info','ffi_call']);
const LUA=[
 'local f=type(love)=="table" and love.ffi or nil',
 'local dbg=type(debug)=="table" and debug.getupvalue or nil',
 'local wrappers={"invoke","declare","describe","metatype","native_ready","u64_eq","u64_is_zero"}',
 'local keys={"backend","ffi","victim","info","ffi_call"}',
 'local types={}',
 'local shared={}',
 'for _,name in ipairs(wrappers) do',
 ' local fn=type(f)=="table" and f[name] or nil',
 ' local captures={}',
 ' if type(fn)=="function" and type(dbg)=="function" then',
 '  for i=1,24 do',
 '   local ok,k,v=pcall(dbg,fn,i)',
 '   if not ok or k==nil then break end',
 '   if type(k)=="string" then captures[k]=v end',
 '  end',
 ' end',
 ' local parts={}',
 ' for _,key in ipairs(keys) do',
 '  local found=false',
 '  for i=1,24 do',
 '   if type(fn)~="function" or type(dbg)~="function" then break end',
 '   local ok,k=pcall(function() local n=dbg(fn,i);return n end)',
 '   if not ok or k==nil then break end',
 '   if k==key then found=true;break end',
 '  end',
 '  parts[#parts+1]=found and type(captures[key]) or "absent"',
 ' end',
 ' types[#types+1]=name..":"..table.concat(parts,",")',
 ' if name=="declare" or name=="describe" or name=="metatype" or name=="native_ready" then',
 '  shared[name]=captures["ffi_call"]',
 ' end',
 'end',
 'local relation="unknown"',
 'if shared.declare~=nil and shared.describe~=nil and shared.metatype~=nil and shared.native_ready~=nil then',
 ' relation=shared.declare==shared.describe and shared.declare==shared.metatype and shared.declare==shared.native_ready and "same" or "different"',
 'end',
 'return "IZ2S_FFI_SHAPES_V2;types="..table.concat(types,";")..";shared="..relation',
].join('\n');
const TYPES=new Set(['absent','nil','boolean','number','string','table','function','userdata','thread','cdata']);
function parse(reply){
 if(typeof reply!=='string'||!reply.startsWith('-> '))throw Error('Invalid FFI shapes framing');
 const m=/^IZ2S_FFI_SHAPES_V2;types=([^ \r\n]+);shared=(same|different|unknown)$/.exec(reply.slice(3).trim());
 if(!m)throw Error('Invalid FFI shapes reply');
 const records=m[1].split(';');
 if(records.length!==WRAPPERS.length)throw Error('Invalid FFI shapes record count');
 const shapes={};
 for(let i=0;i<records.length;i++){
  const j=records[i].indexOf(':');
  if(j<0||records[i].slice(0,j)!==WRAPPERS[i])throw Error('Invalid FFI shapes record order');
  const items=records[i].slice(j+1).split(',');
  if(items.length!==KEYS.length||items.some(v=>!TYPES.has(v)))throw Error('Invalid FFI shapes type');
  shapes[WRAPPERS[i]]=Object.fromEntries(KEYS.map((key,k)=>[key,items[k]]));
 }
 return {backend:'balatro',mode:'ffi-upvalue-shapes',phase:'upvalue-types-observed',
  wrappers:shapes,sharedFfiCallIdentity:m[2],
  upvalueValuesExposed:false,ffiFunctionsCalled:false,nativeFunctionsCalled:false,
  executableMappingVerified:false,ready:false};
}
async function inspect(host,{port=9026,send=request}={}){
 if(typeof host!=='string'||!host||/\s/.test(host))throw Error('Invalid host');
 if(!Number.isInteger(port)||port<1||port>65535)throw Error('Invalid port');
 return parse(await send({host,port,lua:LUA,timeoutMs:5000,maxReplyBytes:4096}));
}
async function main(){
 const [host,rawPort]=process.argv.slice(2);
 if(!host){console.error('Usage: node native-ffi-upvalue-shapes.cjs <switch-ip> [port]');process.exitCode=2;return}
 try{console.log(JSON.stringify(await inspect(host,{port:rawPort?Number(rawPort):9026}),null,2))}
 catch(e){console.error(JSON.stringify({phase:'error',ready:false,error:e.message}));process.exitCode=1}
}
if(require.main===module)main();
module.exports={WRAPPERS,KEYS,LUA,parse,inspect};
