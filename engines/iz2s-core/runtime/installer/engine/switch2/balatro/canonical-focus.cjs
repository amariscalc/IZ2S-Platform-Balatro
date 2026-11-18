#!/usr/bin/env node
'use strict';
// Port of the canonical IZ2S menu layout/navigation, NOT the native runtime.
const fs=require('node:fs'),path=require('node:path');
const {request}=require('./rpc.cjs');
const MODEL=fs.readFileSync(path.join(__dirname,'canonical-focus-model.lua'),'utf8');
const TEMPLATE=fs.readFileSync(path.join(__dirname,'canonical-focus.lua'),'utf8');
const OPS=Object.freeze(['start','status','left','right','select','back','stop']);
function script(op){
 if(!OPS.includes(op))throw Error('Unsupported canonical focus operation');
 const action='local OP="status"',model='-- __MODEL_SOURCE__';
 if(!TEMPLATE.includes(action)||!TEMPLATE.includes(model)||
   !MODEL.includes('return M'))throw Error('Invalid canonical focus source');
 const code=TEMPLATE.replace(action,'local OP="'+op+'"').replace(model,MODEL);
 if(Buffer.byteLength(code)>8192)throw Error('Canonical focus payload exceeds Balatro RPC limit');
 return code;
}
function parse(reply,op){
 if(typeof reply!=='string'||!reply.startsWith('-> '))throw Error('Invalid focus RPC framing');
 const m=/^IZ2S_FOCUS_V1;phase=(idle|blocked|running);view=(none|conflict|home|picker);selected=(0|[1-9][0-9]?);installed=(0|[1-9][0-9]?);frames=(0|[1-9][0-9]{0,8});inputs=(0|[1-9][0-9]{0,8});errors=(0|[1-9][0-9]{0,8})$/.exec(reply.slice(3).trim());
 if(!m)throw Error('Invalid canonical focus response');
 const [,phase,view,rawSelection,rawInstalled,rawFrames,rawInputs,rawErrors]=m;
 const selected=Number(rawSelection),installed=Number(rawInstalled);
 if(installed>15||selected>installed||
    (phase==='idle'&&(view!=='none'||selected!==0||installed!==0))||
    (phase==='blocked'&&(view!=='conflict'||selected!==0||installed!==0))||
    (phase==='running'&&!['home','picker'].includes(view))||
    (op==='stop'&&phase!=='idle')||
    (phase==='blocked'&&op!=='start'))
  throw Error('Contradictory canonical focus state');
 return {backend:'balatro',mode:'canonical-iz2s-lua-view-port',
  phase,view,selected,installed,renderedFrames:Number(rawFrames),
  controllerEvents:Number(rawInputs),drawErrors:Number(rawErrors),
  usesOriginalLayoutSource:true,catalogVerified:false,
  nativeSupervisorRunning:false,nativeCoreReady:false,ready:false};
}
async function execute(host,op,options={},send=request){
 return parse(await send({host,port:9026,timeoutMs:5000,lua:script(op),...options}),op);
}
async function main(){
 const [host,op='status',portArg]=process.argv.slice(2);
 if(!host||!OPS.includes(op)){
  console.error('Usage: node canonical-focus.cjs <switch-ip> start|status|left|right|select|back|stop [port]');
  process.exitCode=2;return;
 }
 try{console.log(JSON.stringify(await execute(host,op,portArg?{port:Number(portArg)}:{}),null,2));}
 catch(e){console.error(JSON.stringify({backend:'balatro',phase:'error',ready:false,error:e.message}));process.exitCode=1;}
}
if(require.main===module)main();
module.exports={MODEL,TEMPLATE,OPS,script,parse,execute};
