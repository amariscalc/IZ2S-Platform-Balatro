#!/usr/bin/env node
'use strict';
// Title-local IZ2S frontend; no arbitrary FFI, IPC, or NRO execution.
const fs=require('node:fs');
const path=require('node:path');
const {request}=require('./rpc.cjs');
const TEMPLATE=fs.readFileSync(path.join(__dirname,'launcher-menu.lua'),'utf8');
const OPS=Object.freeze(['start','status','up','down','select','back','stop']);
function script(op){
 if(!OPS.includes(op))throw Error('Unsupported launcher operation');
 const marker='local OP="status"';
 if(!TEMPLATE.includes(marker))throw Error('Invalid launcher Lua template');
 const program=TEMPLATE.replace(marker,`local OP="${op}"`);
 if(Buffer.byteLength(program)>8192)throw Error('Launcher script exceeds RPC size limit');
 return program;
}
function parse(reply,op){
 if(typeof reply!=='string'||!reply.startsWith('-> '))throw Error('Unexpected launcher RPC framing');
 const m=/^IZ2S_LAUNCHER_V1;phase=(running|idle);menu=([0-6]);page=(none|home|dashboard|rpc|memory|native|about);overlay=(true|false);controls=(true|false)$/.exec(reply.slice(3).trim());
 if(!m)throw Error('Invalid launcher response');
 const result={backend:'balatro',mode:'title-local-iz2s-frontend',
  phase:m[1],menu:Number(m[2]),page:m[3],overlay:m[4]==='true',
  controls:m[5]==='true',nativeCoreLaunched:false,nativeCoreReady:false,ready:false};
 if((result.phase==='idle'&&(result.menu!==0||result.page!=='none'||result.overlay||result.controls))||
    (result.phase==='running'&&(result.menu<1||result.page==='none')))
  throw Error('Contradictory launcher response');
 if(op==='stop'&&result.phase!=='idle')throw Error('Launcher did not stop');
 return result;
}
async function execute(host,op,options={},send=request){
 const reply=await send({host,port:9026,timeoutMs:5000,lua:script(op),...options});
 return parse(reply,op);
}
async function main(){
 const [host,op,portArg]=process.argv.slice(2);
 if(!host||!OPS.includes(op)){
  console.error('Usage: node launcher-menu.cjs <switch-ip> start|status|up|down|select|back|stop [port]');
  process.exitCode=2;return;
 }
 try{const r=await execute(host,op,portArg?{port:Number(portArg)}:{});
  console.log(JSON.stringify(r,null,2));
 }catch(e){console.error(JSON.stringify({backend:'balatro',ready:false,error:e.message}));process.exitCode=1;}
}
if(require.main===module)main();
module.exports={TEMPLATE,OPS,script,parse,execute};
