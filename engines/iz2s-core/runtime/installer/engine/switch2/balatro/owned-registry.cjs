#!/usr/bin/env node
'use strict';
// Persistent bounded registry backed by the title's own Lua _G state.
// Only handle IDs, offsets, byte values, and byte lengths cross the RPC.
const fs=require('node:fs');
const path=require('node:path');
const {request}=require('./rpc.cjs');
const KEY='__IZ2S_OWNED_REGISTRY_V1';
const TEMPLATE=fs.readFileSync(path.join(__dirname,'owned-registry.lua'),'utf8');
const OPS=Object.freeze(['init','status','alloc','write','read','copy','release','clear']);
function uint(v,max,label){
 if(!Number.isSafeInteger(v)||v<0||v>max)throw Error('Invalid '+label);
 return v;
}
function script(op,args=[]){
 if(!OPS.includes(op))throw Error('Unsupported registry operation');
 if(!Array.isArray(args)||args.length>4)throw Error('Invalid registry arguments');
 const nums=Array.from({length:4},(_,i)=>uint(args[i]??0,65535,'registry integer'));
 const markers=['local OP="status"','local A=0','local B=0','local C=0','local D=0'];
 // A valid status operation uses the default template. Validate anchors.
 if(markers.some(marker=>!TEMPLATE.includes(marker)))
  throw Error('Invalid Lua registry template');
 const source=TEMPLATE
  .replace(markers[0],`local OP="${op}"`)
  .replace(markers[1],`local A=${nums[0]}`)
  .replace(markers[2],`local B=${nums[1]}`)
  .replace(markers[3],`local C=${nums[2]}`)
  .replace(markers[4],`local D=${nums[3]}`);
 if(Buffer.byteLength(source)>8192)throw Error('Invalid Lua registry script');
 return source;
}
function parse(reply,op){
 if(typeof reply!=='string'||!reply.startsWith('-> '))throw Error('Unexpected registry RPC framing');
 const m=/^IZ2S_REG_V1;op=(init|status|alloc|write|read|copy|release|clear);state=(ok|blocked);detail=([a-z_]+);value=(0|[1-9][0-9]{0,5})$/.exec(reply.slice(3).trim());
 if(!m||m[1]!==op)throw Error('Invalid registry response');
 const [,operation,state,detail,raw]=m,value=Number(raw);
 const REASONS=new Set(['ffi_missing','already_initialized','not_initialized','quota',
  'stale_handle','bounds','invalid_byte','overlap_refused','invalid_handle',
  'invalid_operation','operation_failed']);
 if((state==='ok'&&detail!=='none'&&!(operation==='init'&&detail==='initialized'))||
    (state==='blocked'&&(!REASONS.has(detail)||value!==0))||
    (state==='ok'&&operation==='init'&&(detail!=='initialized'||value!==0))||
    (state==='ok'&&operation!=='init'&&detail!=='none'))
  throw Error('Contradictory registry result');
 return {op:operation,state,detail,value,ready:false};
}
async function execute(host,op,args=[],options={},send=request){
 const reply=await send({host,port:9026,timeoutMs:5000,lua:script(op,args),...options});
 return parse(reply,op);
}
async function main(){
 const [host,op,...raw]=process.argv.slice(2);
 if(!host||!OPS.includes(op)){
  console.error('Usage: node owned-registry.cjs <switch-ip> init|status|alloc|write|read|copy|release|clear [A B C D]');
  process.exitCode=2;return;
 }
 try{
  const args=raw.map(v=>Number(v));
  const r=await execute(host,op,args);
  console.log(JSON.stringify(r,null,2));
  if(r.state!=='ok')process.exitCode=1;
 }catch(e){console.error(JSON.stringify({backend:'balatro',ready:false,error:e.message}));process.exitCode=1;}
}
if(require.main===module)main();
module.exports={KEY,OPS,TEMPLATE,script,parse,execute};
