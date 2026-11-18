#!/usr/bin/env node
'use strict';
// Runs upstream Balatro's own native bridge preflight and PURE signature compiler.
// native_ready reads known code bytes; no call is dispatched to a native target.
const {request}=require('./rpc.cjs');
const LUA=[
 'local b=type(love)=="table" and love.ffi or nil',
 'if type(b)~="table" or type(b.native_ready)~="function" then',
 ' return "IZ2S_BRIDGE_V1;state=unavailable;abi=unavailable;detail=missing"',
 'end',
 'local success,ready,why=pcall(b.native_ready)',
 'if not success then',
 ' return "IZ2S_BRIDGE_V1;state=error;abi=unavailable;detail=preflight_error"',
 'end',
 'if not ready then',
 ' return "IZ2S_BRIDGE_V1;state=blocked;abi=unavailable;detail=preflight_rejected"',
 'end',
 'local ok,mod=pcall(require,"bl.ffi_call")',
 'if not ok or type(mod)~="table" or type(mod.compile)~="function" then',
 ' return "IZ2S_BRIDGE_V1;state=verified;abi=unavailable;detail=compiler_missing"',
 'end',
 'local compiled,plan=pcall(mod.compile,{ret="double",args={"double","double"}})',
 'if not compiled or type(plan)~="table" or type(plan.ret)~="table" then',
 ' return "IZ2S_BRIDGE_V1;state=verified;abi=rejected;detail=compile_failed"',
 'end',
 'return "IZ2S_BRIDGE_V1;state=verified;abi=accepted;detail=none"',
].join('\n');
const REGEX=/^IZ2S_BRIDGE_V1;state=(unavailable|error|blocked|verified);abi=(unavailable|rejected|accepted);detail=(missing|preflight_error|preflight_rejected|compiler_missing|compile_failed|none)$/;
function parse(reply){
 if(typeof reply!=='string'||!reply.startsWith('-> '))throw Error('Invalid native bridge RPC framing');
 const m=REGEX.exec(reply.slice(3).trim());
 if(!m)throw Error('Invalid native bridge report');
 const [,state,abi,detail]=m;
 if(!(
  (state==='unavailable'&&abi==='unavailable'&&detail==='missing')||
  (state==='error'&&abi==='unavailable'&&detail==='preflight_error')||
  (state==='blocked'&&abi==='unavailable'&&detail==='preflight_rejected')||
  (state==='verified'&&abi==='unavailable'&&detail==='compiler_missing')||
  (state==='verified'&&abi==='rejected'&&detail==='compile_failed')||
  (state==='verified'&&abi==='accepted'&&detail==='none')
 ))throw Error('Contradictory native bridge report');
 return {
  backend:'balatro',mode:'upstream-native-bridge-preflight',
  state,abi,detail,
  bridgeCodeBytesVerified:state==='verified',
  signatureCompilerAccepted:abi==='accepted',
  nativeCallAttempted:false,nativeOperationExecuted:false,
  privilegedSessionVerified:false,nativeCoreReady:false,ready:false,
 };
}
async function inspect(host,options={},send=request){
 return parse(await send({host,port:9026,timeoutMs:5000,lua:LUA,...options}));
}
async function main(){
 const [host,portArg]=process.argv.slice(2);
 if(!host){console.error('Usage: node native-bridge-check.cjs <switch-ip> [port]');process.exitCode=2;return;}
 try{console.log(JSON.stringify(await inspect(host,portArg?{port:Number(portArg)}:{}),null,2));}
 catch(error){console.error(JSON.stringify({backend:'balatro',ready:false,error:error.message}));process.exitCode=1;}
}
if(require.main===module)main();
module.exports={LUA,REGEX,parse,inspect};
