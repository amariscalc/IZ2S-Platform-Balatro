#!/usr/bin/env node
'use strict';
// First minimal native CALL in Balatro: SDK socket last-error getter (no args).
// The launcher already calls this in bl/socket.lua; no handles/memory are created.
// No arbitrary addresses, user-chosen symbols, raw cdata invocation or retries.
const {request}=require('./rpc.cjs');
const LUA=[
 'local bridge=type(love)=="table" and love.ffi or nil',
 'local a=package.loaded["bl.app"]',
 'local info=type(a)=="table" and a.info or nil',
 'if type(bridge)~="table" or type(bridge.native_ready)~="function" or',
 ' type(bridge.declare)~="function" then',
 ' return "IZ2S_CALL_V1;state=blocked;detail=missing_api"',
 'end',
 'local ok,ready=pcall(bridge.native_ready)',
 'if not ok or ready~=true then',
 ' return "IZ2S_CALL_V1;state=blocked;detail=preflight_rejected"',
 'end',
 'if type(info)~="table" or type(info.sdk_base)~="number" or',
 ' type(info.off)~="table" or type(info.off.sock_error)~="number" then',
 ' return "IZ2S_CALL_V1;state=blocked;detail=offset_unavailable"',
 'end',
 '-- bl/socket.lua already invokes the no-argument sock_error SDK getter.',
 'local declared,fn=pcall(bridge.declare,"int",{},info.sdk_base+info.off.sock_error)',
 'if not declared or type(fn)~="function" then',
 ' return "IZ2S_CALL_V1;state=blocked;detail=declare_rejected"',
 'end',
 'local invoked,value=pcall(fn)',
 'if not invoked or type(value)~="number" or value~=math.floor(value) or',
 ' value< -2147483648 or value>2147483647 then',
 ' return "IZ2S_CALL_V1;state=failed;detail=call_rejected"',
 'end',
 'return "IZ2S_CALL_V1;state=called;detail=none;result="..string.format("%.0f",value)',
].join('\n');
const BOUNDS=/^IZ2S_CALL_V1;state=called;detail=none;result=(-?(?:0|[1-9][0-9]{0,9}))$/;
function parse(reply){
 if(typeof reply!=='string'||!reply.startsWith('-> '))throw Error('Invalid native call response framing');
 const payload=reply.slice(3).trim();
 const match=BOUNDS.exec(payload);
 if(match){
  const value=Number(match[1]);
  if(!Number.isSafeInteger(value)||value< -2147483648||value>2147483647)
   throw Error('Invalid native getter result');
  return {backend:'balatro',mode:'read-only-sdk-native-call',
   state:'called',function:'sdk:sock_error',result:value,
   nativeFunctionCalled:true,nativeCallVerified:true,
   memoryTransportVerified:false,privilegedSessionVerified:false,
   nativeCoreReady:false,ready:false};
 }
 const fail=/^IZ2S_CALL_V1;state=(blocked|failed);detail=(missing_api|preflight_rejected|offset_unavailable|declare_rejected|call_rejected)$/.exec(payload);
 if(!fail||(fail[1]==='blocked'&&fail[2]==='call_rejected')||
   (fail[1]==='failed'&&fail[2]!=='call_rejected'))
  throw Error('Invalid native call status');
 return {backend:'balatro',mode:'read-only-sdk-native-call',
  state:fail[1],detail:fail[2],nativeFunctionCalled:fail[1]==='failed',
  nativeCallVerified:false,memoryTransportVerified:false,
  privilegedSessionVerified:false,nativeCoreReady:false,ready:false};
}
async function inspect(host,options={},send=request){
 return parse(await send({host,port:9026,timeoutMs:7000,lua:LUA,...options}));
}
async function main(){
 const [host,portArg]=process.argv.slice(2);
 if(!host){console.error('Usage: node native-call-smoke.cjs <switch-ip> [port]');process.exitCode=2;return;}
 try{
  const result=await inspect(host,portArg?{port:Number(portArg)}:{});
  console.log(JSON.stringify(result,null,2));
  if(result.state!=='called')process.exitCode=1;
 }catch(error){
  console.error(JSON.stringify({backend:'balatro',state:'error',ready:false,error:error.message}));
  process.exitCode=1;
 }
}
if(require.main===module)main();
module.exports={LUA,parse,inspect};
