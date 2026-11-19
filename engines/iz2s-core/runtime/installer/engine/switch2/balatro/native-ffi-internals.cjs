#!/usr/bin/env node
'use strict';
// Read-only characterization of already-loaded Lua FFI internals.
// Only lexically captured value TYPES and bounded ffi_call field NAMES/TYPES.
// Never serializes values, reads native addresses, calls FFI, or mutates state.
const {request}=require('./rpc.cjs');
const LUA=[
 'local ffi=type(love)=="table" and love.ffi or nil',
 'local dbg=type(debug)=="table" and debug.getupvalue or nil',
 'local info=type(debug)=="table" and debug.getinfo or nil',
 'local function upvalue(fn,key)',
 ' if type(fn)~="function" or type(dbg)~="function" then return nil,false end',
 ' for i=1,24 do',
 '  local ok,name,value=pcall(dbg,fn,i)',
 '  if not ok or name==nil then break end',
 '  if name==key then return value,true end',
 ' end',
 ' return nil,false',
 'end',
 'local function shape(fn)',
 ' if type(fn)~="function" then return "missing" end',
 ' if type(info)~="function" then return "unknown" end',
 ' local ok,v=pcall(info,fn,"S")',
 ' if not ok or type(v)~="table" then return "unknown" end',
 ' if v.what=="Lua" then return "lua" end',
 ' if v.what=="C" then return "cfunc" end',
 ' return "unknown"',
 'end',
 'local invoke=type(ffi)=="table" and ffi.invoke or nil',
 'local declare=type(ffi)=="table" and ffi.declare or nil',
 'local backend,b=upvalue(invoke,"backend")',
 'local victim,v=upvalue(invoke,"victim")',
 'local other,w=upvalue(declare,"victim")',
 'local t,p=upvalue(declare,"ffi_call")',
 'local relation=(v and w) and (victim==other and "same" or "different") or "unknown"',
 'local entries={}',
 'if p and type(t)=="table" then',
 ' for k,value in pairs(t) do',
 '  if type(k)=="string" and k:match("^[a-z][a-z0-9_]*$") and #k<=32 then',
 '   local kind=type(value)',
 '   if kind=="function" or kind=="table" or kind=="number" or kind=="boolean" or kind=="string" then',
 '    if #entries<64 then entries[#entries+1]=k..":"..kind end',
 '   end',
 '  end',
 ' end',
 ' table.sort(entries)',
 'end',
 'if #entries>32 then while #entries>32 do entries[#entries]=nil end end',
 'local list=#entries>0 and table.concat(entries,",") or "none"',
 'return "IZ2S_FFI_INTERNALS_V1;backend="..(b and shape(backend) or "missing")..',
 ' ";victim="..(v and shape(victim) or "missing")..',
 ' ";victimshared="..relation..";table="..(p and type(t)=="table" and "present" or "missing")..',
 ' ";fields="..list',
].join('\n');
const VALUES=new Set(['function','table','number','boolean','string']);
function parse(reply){
 if(typeof reply!=='string'||!reply.startsWith('-> '))throw Error('Invalid FFI internals framing');
 const m=/^IZ2S_FFI_INTERNALS_V1;backend=(lua|cfunc|missing|unknown);victim=(lua|cfunc|missing|unknown);victimshared=(same|different|unknown);table=(present|missing);fields=(none|[a-z0-9_:,]+)$/.exec(reply.slice(3).trim());
 if(!m)throw Error('Invalid FFI internals response');
 const fields={};
 if(m[5]!=='none'){
  const parts=m[5].split(',');
  if(parts.length>32)throw Error('Excessive FFI fields');
  for(const part of parts){
   const items=part.split(':');
   if(items.length!==2||!/^[a-z][a-z0-9_]{0,31}$/.test(items[0])||!VALUES.has(items[1])||Object.hasOwn(fields,items[0]))throw Error('Invalid FFI field');
   fields[items[0]]=items[1];
  }
 }
 if(m[4]==='missing'&&Object.keys(fields).length)throw Error('Contradictory FFI field report');
 return {backend:'balatro',mode:'ffi-shared-table-inventory',phase:'ffi-internals-observed',
  backendFunctionKind:m[1],victimFunctionKind:m[2],sharedVictimIdentity:m[3],
  ffiCallTablePresent:m[4]==='present',ffiCallFields:fields,
  valuesExposed:false,ffiFunctionsCalled:false,nativeFunctionsCalled:false,
  physicalSdReadVerified:false,executableMappingVerified:false,ready:false};
}
async function inspect(host,{port=9026,send=request}={}){
 if(typeof host!=='string'||!host||/\s/.test(host))throw Error('Invalid host');
 if(!Number.isInteger(port)||port<1||port>65535)throw Error('Invalid port');
 return parse(await send({host,port,lua:LUA,timeoutMs:5000,maxReplyBytes:4096}));
}
async function main(){
 const [host,portArg]=process.argv.slice(2);
 if(!host){console.error('Usage: node native-ffi-internals.cjs <switch-ip> [port]');process.exitCode=2;return;}
 try{console.log(JSON.stringify(await inspect(host,{port:portArg?Number(portArg):9026}),null,2));}
 catch(e){console.error(JSON.stringify({phase:'error',ready:false,error:e.message}));process.exitCode=1;}
}
if(require.main===module)main();
module.exports={LUA,parse,inspect};
