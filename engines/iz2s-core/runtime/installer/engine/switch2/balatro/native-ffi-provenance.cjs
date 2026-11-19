#!/usr/bin/env node
'use strict';
// Title-local provenance for already loaded Lua FFI wrappers.
// Source text, absolute paths, native pointers and upvalue values are never returned.
// No FFI function or SDK offset is invoked.
const {request}=require('./rpc.cjs');
const NAMES=Object.freeze(['declare','describe','invoke','metatype','native_ready','u64_eq','u64_is_zero']);
const LUA=[
 'local f=type(love)=="table" and love.ffi or nil',
 'local d=type(debug)=="table" and debug.getinfo or nil',
 'local names={"declare","describe","invoke","metatype","native_ready","u64_eq","u64_is_zero"}',
 'local origins={}',
 'local function origin(src)',
 '  if type(src)~="string" then return "unknown",0 end',
 '  local kind=src:sub(1,1)=="@" and "file" or (src:sub(1,1)=="=" and "chunk" or "dynamic")',
 '  for i,v in ipairs(origins) do if v==src then return kind,i end end',
 '  if #origins>=7 then return kind,0 end',
 '  origins[#origins+1]=src',
 '  return kind,#origins',
 'end',
 'local out={}',
 'for _,name in ipairs(names) do',
 ' local what,kind,group,line="missing","unknown",0,0',
 ' if type(f)=="table" and type(f[name])=="function" then',
 '  what="unknown"',
 '  if type(d)=="function" then',
 '   local ok,meta=pcall(d,f[name],"S")',
 '   if ok and type(meta)=="table" then',
 '    what=meta.what=="Lua" and "lua" or (meta.what=="C" and "cfunc" or "unknown")',
 '    kind,group=origin(meta.source)',
 '    if type(meta.linedefined)=="number" and meta.linedefined>=0 and meta.linedefined<=999999 then line=math.floor(meta.linedefined) end',
 '   end',
 '  end',
 ' end',
 ' out[#out+1]=name..":"..what..":"..kind..":"..group..":"..line',
 'end',
 'return "IZ2S_FFI_PROVENANCE_V1;"..table.concat(out,",")',
].join('\n');
function parse(reply){
 if(typeof reply!=='string'||!reply.startsWith('-> '))throw Error('Invalid FFI provenance framing');
 const m=/^IZ2S_FFI_PROVENANCE_V1;([a-z0-9_:,]+)$/.exec(reply.slice(3).trim());
 if(!m)throw Error('Invalid FFI provenance response');
 const entries=m[1].split(',');
 if(entries.length!==NAMES.length)throw Error('Invalid FFI provenance count');
 const wrappers={};
 for(let i=0;i<entries.length;i++){
  const tokens=entries[i].split(':');
  if(tokens.length!==5||tokens[0]!==NAMES[i]||
   !['lua','cfunc','missing','unknown'].includes(tokens[1])||
   !['file','chunk','dynamic','unknown'].includes(tokens[2])||
   !/^[0-7]$/.test(tokens[3])||!/^(0|[1-9][0-9]{0,5})$/.test(tokens[4]))
   throw Error('Invalid FFI provenance entry');
  const [,kind,sourceKind,group,line]=tokens;
  if(kind==='missing'&&(sourceKind!=='unknown'||group!=='0'||line!=='0'))throw Error('Contradictory FFI provenance');
  wrappers[NAMES[i]]={implementationKind:kind,sourceKind,sourceGroup:Number(group),lineDefined:Number(line)};
 }
 return {backend:'balatro',mode:'ffi-wrapper-provenance',phase:'provenance-observed',
  wrappers,sourcePathsExposed:false,sourceCodeExposed:false,ffiFunctionsCalled:false,
  nativeSupervisorRunning:false,executableMappingVerified:false,ready:false};
}
async function inspect(host,{port=9026,send=request}={}){
 if(typeof host!=='string'||!host||/\s/.test(host))throw Error('Invalid host');
 if(!Number.isInteger(port)||port<1||port>65535)throw Error('Invalid port');
 return parse(await send({host,port,lua:LUA,timeoutMs:5000,maxReplyBytes:2048}));
}
async function main(){
 const [host,rawPort]=process.argv.slice(2);
 if(!host){console.error('Usage: node native-ffi-provenance.cjs <switch-ip> [port]');process.exitCode=2;return;}
 try{console.log(JSON.stringify(await inspect(host,{port:rawPort?Number(rawPort):9026}),null,2));}
 catch(e){console.error(JSON.stringify({phase:'error',ready:false,error:e.message}));process.exitCode=1;}
}
if(require.main===module)main();
module.exports={NAMES,LUA,parse,inspect};
