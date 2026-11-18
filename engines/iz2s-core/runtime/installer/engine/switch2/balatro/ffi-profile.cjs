#!/usr/bin/env node
'use strict';
// Read-only inspection of Lua-side FFI wrapper signatures. No FFI invocation.
const {request}=require('./rpc.cjs');
const LUA=[
 'local l=type(love)=="table" and love.ffi or nil',
 'local function describe(k)',
 ' local f=type(l)=="table" and l[k] or nil',
 ' if type(f)~="function" then return "missing,0,false" end',
 ' local info=type(debug)=="table" and type(debug.getinfo)=="function" and debug.getinfo(f,"Su") or nil',
 ' if type(info)~="table" then return "unknown,0,false" end',
 ' local what=info.what=="C" and "C" or info.what=="Lua" and "Lua" or "unknown"',
 ' local n=type(info.nparams)=="number" and math.max(0,math.min(info.nparams,100)) or 0',
 ' local vararg=info.isvararg==true and "true" or "false"',
 ' return what..","..tostring(n)..","..vararg',
 'end',
 'return "IZ2S_FFI_PROFILE_V1;declare="..describe("declare")..";invoke="..describe("invoke")',
].join('\n');
function parse(reply){
 if(typeof reply!=='string'||!reply.startsWith('-> IZ2S_FFI_PROFILE_V1;'))
  throw Error('Unexpected FFI profile framing');
 const m=/^IZ2S_FFI_PROFILE_V1;declare=(C|Lua|missing|unknown),([0-9]{1,3}),(true|false);invoke=(C|Lua|missing|unknown),([0-9]{1,3}),(true|false)$/.exec(reply.slice(3).trim());
 if(!m||Number(m[2])>100||Number(m[5])>100)
  throw Error('Malformed FFI profile');
 const describe=(type,params,vararg)=>({
  implementation:type,parameters:Number(params),varargs:vararg==='true',
 });
 return {backend:'balatro',mode:'read-only-ffi-profile',
  declare:describe(m[1],m[2],m[3]),invoke:describe(m[4],m[5],m[6]),
  ffiCalled:false,nativeOperationsVerified:false,nativeTransportReady:false,ready:false};
}
async function profile(host,options={},send=request){
 return parse(await send({host,port:9026,timeoutMs:5000,lua:LUA,...options}));
}
async function main(){
 const [host,port]=process.argv.slice(2);
 if(!host){console.error('Usage: node ffi-profile.cjs <switch-ip> [port]');process.exitCode=2;return;}
 try{console.log(JSON.stringify(await profile(host,port?{port:Number(port)}:{}),null,2));}
 catch(error){console.error(JSON.stringify({ready:false,error:error.message}));process.exitCode=1;}
}
if(require.main===module)main();
module.exports={LUA,parse,profile};
