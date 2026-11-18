#!/usr/bin/env node
'use strict';
// Read-only Lua debug metadata on the two previously identified wrappers.
// No calls to love.ffi.declare/invoke and no upvalue values are inspected.
const {request}=require('./rpc.cjs');
const LUA=[
 'local bridge=type(love)=="table" and love.ffi or nil',
 'local dbg=type(debug)=="table" and debug or nil',
 'local function describe(key)',
 ' local f=type(bridge)=="table" and bridge[key] or nil',
 ' if type(f)~="function" then return "unavailable" end',
 ' if type(dbg)~="table" or type(dbg.getlocal)~="function" then return "unavailable" end',
 ' local info=type(dbg.getinfo)=="function" and dbg.getinfo(f,"Su") or nil',
 ' if type(info)~="table" or info.what~="Lua" then return "unavailable" end',
 ' local n=type(info.nparams)=="number" and math.min(8,math.max(0,info.nparams)) or 0',
 ' local names={}',
 ' for i=1,n do',
 '  local ok,name=pcall(dbg.getlocal,f,i)',
 '  if not ok or type(name)~="string" then name="unknown" end',
 '  if not string.match(name,"^[%a_][%w_]*$") then name="unknown" end',
 '  names[#names+1]=name',
 ' end',
 ' local count=0',
 ' if type(dbg.getupvalue)=="function" then',
 '  for i=1,32 do',
 '   local ok,name=pcall(dbg.getupvalue,f,i)',
 '   if not ok or name==nil then break end',
 '   count=count+1',
 '  end',
 ' end',
 ' return table.concat(names,",").."@"..tostring(count)',
 'end',
 'return "IZ2S_FFI_NAMES_V1;declare="..describe("declare")..";invoke="..describe("invoke")',
].join('\n');
function parse(reply){
 if(typeof reply!=='string'||!reply.startsWith('-> IZ2S_FFI_NAMES_V1;'))
  throw Error('Unexpected FFI metadata framing');
 const m=/^IZ2S_FFI_NAMES_V1;declare=([^;]*);invoke=([^;]*)$/.exec(reply.slice(3).trim());
 if(!m)throw Error('Malformed FFI metadata reply');
 function one(field){
  if(field==='unavailable')return {available:false,parameters:[],upvalueCount:null};
  const match=/^([a-zA-Z_][\w]*(?:,[a-zA-Z_][\w]*)*)?@(0|[1-9][0-9]?)$/.exec(field);
  if(!match||Number(match[2])>32)throw Error('Invalid Lua wrapper metadata');
  const parameters=match[1]?match[1].split(','):[];
  if(parameters.length>8)throw Error('Excessive parameter metadata');
  return {available:true,parameters,upvalueCount:Number(match[2])};
 }
 return {backend:'balatro',mode:'read-only-ffi-names',
  declare:one(m[1]),invoke:one(m[2]),
  upvalueValuesRead:false,ffiCalled:false,nativeTransportReady:false,ready:false};
}
async function inspect(host,options={},send=request){
 return parse(await send({host,port:9026,timeoutMs:5000,lua:LUA,...options}));
}
async function main(){
 const [host,port]=process.argv.slice(2);
 if(!host){console.error('Usage: node ffi-names.cjs <switch-ip> [port]');process.exitCode=2;return;}
 try{console.log(JSON.stringify(await inspect(host,port?{port:Number(port)}:{}),null,2));}
 catch(error){console.error(JSON.stringify({ready:false,error:error.message}));process.exitCode=1;}
}
if(require.main===module)main();
module.exports={LUA,parse,inspect};
