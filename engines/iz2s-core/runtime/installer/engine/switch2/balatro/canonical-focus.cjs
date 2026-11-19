#!/usr/bin/env node
'use strict';
// Port of the canonical IZ2S menu layout/navigation, NOT the native runtime.
const fs=require('node:fs'),path=require('node:path');
const {request}=require('./rpc.cjs');
const MODEL=fs.readFileSync(path.join(__dirname,'canonical-focus-model.lua'),'utf8');
const TEMPLATE=fs.readFileSync(path.join(__dirname,'canonical-focus.lua'),'utf8');
const OPS=Object.freeze(['start','status','left','right','select','back','stop']);
const MODEL_KEY='__IZ2S_CANONICAL_FOCUS_MODEL_V1';
function compact(source){
 return source.split('\n').map(line=>line.trim())
  .filter(line=>line.length>0&&!line.startsWith('--')).join('\n');
}
function withinLimit(code){
 if(Buffer.byteLength(code)>8192)throw Error('Canonical focus payload exceeds Balatro RPC limit');
 return code;
}
function modelScript(){
 if(!MODEL.includes('return M'))throw Error('Invalid canonical focus model');
 return withinLimit(compact('local Model=(function()\n'+MODEL+
  '\nend)()\nrawset(_G,"'+MODEL_KEY+'",Model)\nreturn "IZ2S_FOCUS_MODEL_V1;state=ready"'));
}
function script(op){
 if(!OPS.includes(op))throw Error('Unsupported canonical focus operation');
 const action='local OP="status"';
 if(!TEMPLATE.includes(action)||!TEMPLATE.includes(MODEL_KEY))
  throw Error('Invalid canonical focus source');
 return withinLimit(compact(TEMPLATE.replace(action,'local OP="'+op+'"')));
}
function parseModel(reply){
 if(typeof reply!=='string'||reply.trim()!=='-> IZ2S_FOCUS_MODEL_V1;state=ready')
  throw Error('Canonical focus model failed to initialize');
}
function parse(reply,op){
 if(typeof reply!=='string'||!reply.startsWith('-> '))throw Error('Invalid focus RPC framing');
 const m=/^IZ2S_FOCUS_V1;phase=(idle|blocked|running);view=(none|conflict|home|picker|detail);selected=(0|[1-9][0-9]?);installed=(0|[1-9][0-9]?);frames=(0|[1-9][0-9]{0,8});inputs=(0|[1-9][0-9]{0,8});errors=(0|[1-9][0-9]{0,8});drawhook=([01]);inputhook=([01]);callbacks=(0|[1-9][0-9]{0,8});consolecalls=(0|[1-9][0-9]{0,8});consolefailures=(0|[1-9][0-9]{0,8});packages=(0|[1-9][0-9]?)$/.exec(reply.slice(3).trim());
 if(!m)throw Error('Invalid canonical focus response');
 const [,phase,view,rawSelection,rawInstalled,rawFrames,rawInputs,rawErrors,drawHook,inputHook,callbacks,consoleCalls,consoleFailures,packageCount]=m;
 const selected=Number(rawSelection),installed=Number(rawInstalled);
 if(installed>15||Number(packageCount)>16||
    (view==='detail'&&Number(packageCount)===0)||selected>(['picker','detail'].includes(view)?15:installed)||
    (phase==='idle'&&(view!=='none'||selected!==0||installed!==0))||
    (phase==='blocked'&&(view!=='conflict'||selected!==0||installed!==0))||
    (phase==='running'&&!['home','picker','detail'].includes(view))||
    (op==='stop'&&phase!=='idle')||
    (phase!=='running'&&(drawHook==='1'||inputHook==='1'||Number(callbacks)!==0||Number(consoleCalls)!==0||Number(consoleFailures)!==0||Number(packageCount)!==0))||
    (phase==='blocked'&&op!=='start'))
  throw Error('Contradictory canonical focus state');
 return {backend:'balatro',mode:'canonical-iz2s-lua-view-port',
  phase,view,selected,installed,renderedFrames:Number(rawFrames),
  controllerEvents:Number(rawInputs),drawErrors:Number(rawErrors),
  drawHookInstalled:drawHook==='1',inputHookInstalled:inputHook==='1',
  drawCallbacks:Number(callbacks),consoleDrawCalls:Number(consoleCalls),
  consoleDrawFailures:Number(consoleFailures),availablePackages:Number(packageCount),
  usesOriginalLayoutSource:true,catalogVerified:false,
  nativeSupervisorRunning:false,nativeCoreReady:false,ready:false};
}
async function execute(host,op,options={},send=request){
 const transport={host,port:9026,timeoutMs:5000,...options};
 if(op==='start')parseModel(await send({...transport,lua:modelScript()}));
 return parse(await send({...transport,lua:script(op)}),op);
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
module.exports={MODEL,TEMPLATE,OPS,MODEL_KEY,modelScript,parseModel,script,parse,execute};
