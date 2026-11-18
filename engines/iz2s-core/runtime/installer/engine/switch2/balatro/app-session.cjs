#!/usr/bin/env node
'use strict';
const fs=require('node:fs');
const path=require('node:path');
const {request}=require('./rpc.cjs');
// Fixed Lua lives in its own file to avoid JS quote/comma regressions.
const OPS=Object.freeze(['start','status','step','stop','up','down','select','back']);
const KEY='__IZ2S_BALATRO_APP_V1';
const template=fs.readFileSync(path.join(__dirname,'app-menu.lua'),'utf8');
function script(operation,value){
  if(!OPS.includes(operation))throw Error('Unsupported operation');
  if(operation==='step'&&(!Number.isSafeInteger(value)||value<1||value>1000))
    throw Error('step value must be an integer from 1 to 1000');
  const step=operation==='step'?value:1;
  const program=template.replace('local operation="status"',`local operation="${operation}"`)
    .replace('local step=1',`local step=${step}`);
  if(!program.includes(`local operation="${operation}"`)||!program.includes(`local step=${step}`))
    throw Error('Lua template substitution failed');
  if(program.length>8192)throw Error('Lua request exceeds transport size limit');
  return program;
}
function parse(reply){
  if(typeof reply!=='string'||!reply.startsWith('-> IZ2S_SESSION_V1;'))
    throw Error('Unexpected Balatro session reply');
  const fields={};
  for(const part of reply.trim().slice(3).split(';').slice(1)){
    const index=part.indexOf('=');
    if(index<1)throw Error('Invalid session reply field');
    const key=part.slice(0,index);
    if(!['phase','steps','id','overlay'].includes(key)||Object.hasOwn(fields,key))
      throw Error('Unexpected session reply field');
    fields[key]=part.slice(index+1);
  }
  if((Object.keys(fields).length!==3&&Object.keys(fields).length!==4)||
     (fields.overlay!==undefined&&!['attached','unavailable','none'].includes(fields.overlay))||
     (fields.phase==='idle'&&fields.overlay&&fields.overlay!=='none')||
     (fields.phase==='running'&&fields.overlay==='none')||
     !['running','idle'].includes(fields.phase)||
     !/^\d{1,9}$/.test(fields.steps)||
     (fields.phase==='idle'&&(fields.id!=='none'||fields.steps!=='0'))||
     (fields.phase==='running'&&fields.id!=='balatro-lua-1'))
    throw Error('Invalid session response state');
  return {application:'IZ2S Balatro Lua',phase:fields.phase,
    steps:Number(fields.steps),id:fields.id,overlay:fields.overlay??'unknown',scope:'title-local',
    nativeCoreLaunched:false,privilegedSessionVerified:false};
}
async function execute(host,operation,value,options={}){
  return parse(await request({host,lua:script(operation,value),...options}));
}
async function main(){
  const [host,operation,arg]=process.argv.slice(2);
  if(!host||!OPS.includes(operation)){
    console.error('Usage: node app-session.cjs <console-ip> start|status|step|stop|up|down|select|back [step-count]');
    process.exitCode=2;return;
  }
  try{
    const value=operation==='step'?Number(arg):undefined;
    const result=await execute(host,operation,value);
    process.stdout.write(JSON.stringify(result,null,2)+'\n');
  }catch(error){
    console.error(JSON.stringify({application:'IZ2S Balatro Lua',error:error.message}));
    process.exitCode=1;
  }
}
if(require.main===module)main();
module.exports={OPS,KEY,script,parse,execute};
