#!/usr/bin/env node
'use strict';
// Read-only provenance of Balatro's existing ffi_call helper functions.
// Returns function kind, relative source group and definition line only.
// No function execution, closure values, paths, native pointers or memory.
const {request}=require('./rpc.cjs');
const NAMES=Object.freeze(['compile','construct','declare','decode','describe','ensure_ready','gp_invoke','gp_plan','invoke','marshal','metatype','preflight','prime','reset','sentinel','u64_eq','u64_is_zero']);
const LUA=[
 'local f=type(love)=="table" and love.ffi or nil',
 'local up=type(debug)=="table" and debug.getupvalue or nil',
 'local getinfo=type(debug)=="table" and debug.getinfo or nil',
 'local declare=type(f)=="table" and f.declare or nil',
 'local helpers=nil',
 'if type(up)=="function" and type(declare)=="function" then',
 ' for i=1,24 do',
 '  local ok,n,v=pcall(up,declare,i)',
 '  if not ok or n==nil then break end',
 '  if n=="ffi_call" and type(v)=="table" then helpers=v;break end',
 ' end',
 'end',
 'local names={"compile","construct","declare","decode","describe","ensure_ready","gp_invoke","gp_plan","invoke","marshal","metatype","preflight","prime","reset","sentinel","u64_eq","u64_is_zero"}',
 'local sources={}',
 'local function source_group(s)',
 ' if type(s)~="string" then return 0 end',
 ' for i,v in ipairs(sources) do if v==s then return i end end',
 ' if #sources>=17 then return 0 end',
 ' sources[#sources+1]=s',
 ' return #sources',
 'end',
 'local records={}',
 'for _,name in ipairs(names) do',
 ' local fn=type(helpers)=="table" and helpers[name] or nil',
 ' local kind,group,line="missing",0,0',
 ' if type(fn)=="function" then',
 '  kind="unknown"',
 '  if type(getinfo)=="function" then',
 '   local ok,meta=pcall(getinfo,fn,"S")',
 '   if ok and type(meta)=="table" then',
 '    kind=meta.what=="Lua" and "lua" or (meta.what=="C" and "cfunc" or "unknown")',
 '    group=source_group(meta.source)',
 '    if type(meta.linedefined)=="number" and meta.linedefined>=0 and meta.linedefined<=999999 then line=math.floor(meta.linedefined) end',
 '   end',
 '  end',
 ' end',
 ' records[#records+1]=name..":"..kind..":"..group..":"..line',
 'end',
 'return "IZ2S_FFI_HELPERS_V1;"..table.concat(records,",")',
].join('\n');
function parse(reply){
 if(typeof reply!=='string'||!reply.startsWith('-> '))throw Error('Invalid FFI helper framing');
 const m=/^IZ2S_FFI_HELPERS_V1;([a-z0-9_:,]+)$/.exec(reply.slice(3).trim());
 if(!m)throw Error('Invalid FFI helper response');
 const entries=m[1].split(',');
 if(entries.length!==NAMES.length)throw Error('Wrong FFI helper count');
 const helpers={};
 for(let i=0;i<entries.length;i++){
  const entry=entries[i].split(':');
  if(entry.length!==4||entry[0]!==NAMES[i]||!['missing','unknown','lua','cfunc'].includes(entry[1])||!/^(0|[1-9]|1[0-7])$/.test(entry[2])||!/^(0|[1-9][0-9]{0,5})$/.test(entry[3]))throw Error('Invalid FFI helper record');
  helpers[NAMES[i]]={kind:entry[1],sourceGroup:Number(entry[2]),lineDefined:Number(entry[3])};
 }
 return {backend:'balatro',mode:'read-only-ffi-helper-provenance',phase:'helper-provenance-observed',
  helpers,sourcePathsExposed:false,sourceBodiesExposed:false,upvalueValuesExposed:false,
  ffiCallsPerformed:false,nativeSupervisorRunning:false,executableMappingVerified:false,ready:false};
}
async function inspect(host,{port=9026,send=request}={}){
 if(typeof host!=='string'||!host||/\s/.test(host))throw Error('Invalid host');
 if(!Number.isInteger(port)||port<1||port>65535)throw Error('Invalid port');
 return parse(await send({host,port,lua:LUA,timeoutMs:5000,maxReplyBytes:4096}));
}
async function main(){
 const [host,portRaw]=process.argv.slice(2);
 if(!host){console.error('Usage: node native-ffi-helper-provenance.cjs <switch-ip> [port]');process.exitCode=2;return;}
 try{console.log(JSON.stringify(await inspect(host,{port:portRaw?Number(portRaw):9026}),null,2));}
 catch(e){console.error(JSON.stringify({phase:'error',ready:false,error:e.message}));process.exitCode=1;}
}
if(require.main===module)main();
module.exports={NAMES,LUA,parse,inspect};
