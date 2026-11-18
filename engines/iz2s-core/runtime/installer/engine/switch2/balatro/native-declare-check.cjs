#!/usr/bin/env node
'use strict';
// Construct a native declaration only after upstream's exact-image preflight.
// Never invoke the resulting function and never dereference a new pointer.
const {request}=require('./rpc.cjs');
const LUA=[
 'local b=type(love)=="table" and love.ffi or nil',
 'local app=package.loaded["bl.app"]',
 'local info=type(app)=="table" and app.info or nil',
 'if type(b)~="table" or type(b.native_ready)~="function" or',
 ' type(b.declare)~="function" or type(b.describe)~="function" then',
 ' return "IZ2S_DECLARE_V1;state=unavailable;detail=api_missing"',
 'end',
 'local ok,ready=pcall(b.native_ready)',
 'if not ok or ready~=true then',
 ' return "IZ2S_DECLARE_V1;state=blocked;detail=preflight_failed"',
 'end',
 'if type(info)~="table" or type(info.sdk_base)~="number" or',
 ' type(info.off)~="table" or type(info.off.socket)~="number" then',
 ' return "IZ2S_DECLARE_V1;state=blocked;detail=offset_unavailable"',
 'end',
 '-- socket signature: int socket(int domain, int type, int protocol).',
 '-- This creates a Lua closure, but does not make any socket calls.',
 'local valid,fn,plan=pcall(b.declare,"int",{"int","int","int"},',
 ' info.sdk_base+info.off.socket)',
 'if not valid or type(fn)~="function" or type(plan)~="table" then',
 ' return "IZ2S_DECLARE_V1;state=blocked;detail=declaration_rejected"',
 'end',
 'local described,dtext=pcall(b.describe,fn)',
 'if not described or type(dtext)~="string" then',
 ' return "IZ2S_DECLARE_V1;state=blocked;detail=description_failed"',
 'end',
 'return "IZ2S_DECLARE_V1;state=created;detail=none"',
].join('\n');
const VALID=Object.freeze({
 unavailable:'api_missing',
 blocked:null,
 created:'none',
});
const BLOCKED=new Set(['preflight_failed','offset_unavailable','declaration_rejected','description_failed']);
function parse(reply){
 if(typeof reply!=='string'||!reply.startsWith('-> '))throw Error('Unexpected declaration response framing');
 const m=/^IZ2S_DECLARE_V1;state=(unavailable|blocked|created);detail=([a-z_]+)$/.exec(reply.slice(3).trim());
 if(!m||!(m[1]==='blocked'?BLOCKED.has(m[2]):VALID[m[1]]===m[2]))
  throw Error('Invalid native declaration response');
 return {backend:'balatro',mode:'native-declaration-only',state:m[1],detail:m[2],
  closureConstructed:m[1]==='created',nativeFunctionCalled:false,
  nativeOperationsVerified:false,privilegedSessionVerified:false,
  nativeCoreReady:false,ready:false};
}
async function inspect(host,options={},send=request){
 return parse(await send({host,port:9026,timeoutMs:5000,lua:LUA,...options}));
}
async function main(){
 const [host,portArg]=process.argv.slice(2);
 if(!host){console.error('Usage: node native-declare-check.cjs <switch-ip> [port]');process.exitCode=2;return;}
 try{console.log(JSON.stringify(await inspect(host,portArg?{port:Number(portArg)}:{}),null,2));}
 catch(error){console.error(JSON.stringify({backend:'balatro',ready:false,error:error.message}));process.exitCode=1;}
}
if(require.main===module)main();
module.exports={LUA,parse,inspect};
