#!/usr/bin/env node
'use strict';
// Read-only classification of *existing* Balatro FFI interfaces.
// Inspects Lua function metadata via debug.getinfo only: never calls FFI,
// touches pointers, invokes SDK offsets, or changes execution contexts.
const {request}=require('./rpc.cjs');
const FFI=['declare','describe','invoke','metatype','native_ready','u64_eq','u64_is_zero'];
const LUA=[
 'local f=type(love)=="table" and love.ffi or nil',
 'local dbg=type(debug)=="table" and debug.getinfo or nil',
 'local names={"declare","describe","invoke","metatype","native_ready","u64_eq","u64_is_zero"}',
 'local function classify(name)',
 ' if type(f)~="table" or type(f[name])~="function" then return "missing" end',
 ' if type(dbg)~="function" then return "unknown" end',
 ' local ok,v=pcall(dbg,f[name],"S")',
 ' if not ok or type(v)~="table" then return "unknown" end',
 ' if v.what=="C" then return "cfunc" end',
 ' if v.what=="Lua" or v.what=="main" then return "lua" end',
 ' return "unknown"',
 'end',
 'local out={}',
 'for i,n in ipairs(names) do out[#out+1]=n..":"..classify(n) end',
 'local app=package.loaded["bl.app"]',
 'local info=type(app)=="table" and app.info or nil',
 'local off=type(info)=="table" and info.off or nil',
 'local function present(k) return type(off)=="table" and type(off[k])=="number" and "1" or "0" end',
 'return "IZ2S_FFI_SHAPES_V1;ffi="..table.concat(out,",")..',
 ' ";context="..present("ctx_save")..present("ctx_restore")..present("fiber_capture")..present("fiber_switch")',
].join('\n');
function parse(reply){
 if(typeof reply!=='string'||!reply.startsWith('-> '))throw Error('Invalid FFI metadata framing');
 const m=/^IZ2S_FFI_SHAPES_V1;ffi=([a-z0-9_:,]+);context=([01]{4})$/.exec(reply.slice(3).trim());
 if(!m)throw Error('Invalid FFI metadata response');
 const entries=m[1].split(',');
 if(entries.length!==FFI.length)throw Error('Unexpected FFI function count');
 const functions={};
 for(let i=0;i<FFI.length;i++){
  const [name,kind,...extra]=entries[i].split(':');
  if(extra.length||name!==FFI[i]||!['missing','unknown','cfunc','lua'].includes(kind))throw Error('Unexpected FFI function entry');
  functions[name]=kind;
 }
 const c=m[2];
 return {backend:'balatro',mode:'read-only-ffi-function-classification',phase:'ffi-metadata-observed',
  ffiFunctionKinds:functions,
  contextOffsetMetadataPresent:{ctxSave:c[0]==='1',ctxRestore:c[1]==='1',fiberCapture:c[2]==='1',fiberSwitch:c[3]==='1'},
  ffiFunctionsCalled:false,contextSwitchAttempted:false,arbitraryNativeCallVerified:false,
  executableMappingVerified:false,originalNativeSupervisorStarted:false,ready:false};
}
async function inspect(host,{port=9026,send=request}={}){
 if(typeof host!=='string'||!host||/\s/.test(host))throw Error('Invalid host');
 if(!Number.isInteger(port)||port<1||port>65535)throw Error('Invalid port');
 return parse(await send({host,port,lua:LUA,timeoutMs:5000,maxReplyBytes:2048}));
}
async function main(){
 const [host,port]=process.argv.slice(2);
 if(!host){console.error('Usage: node native-ffi-metadata.cjs <switch-ip> [port]');process.exitCode=2;return;}
 try{console.log(JSON.stringify(await inspect(host,{port:port?Number(port):9026}),null,2));}
 catch(e){console.error(JSON.stringify({phase:'error',ready:false,error:e.message}));process.exitCode=1;}
}
if(require.main===module)main();
module.exports={FFI,LUA,parse,inspect};
