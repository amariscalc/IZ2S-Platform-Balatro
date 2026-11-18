#!/usr/bin/env node
'use strict';
const {request}=require('./rpc.cjs');

// Persistent application-layer component stored in Balatro's Lua _G.
// All Lua programs are fixed, bounded and execute only in the existing title.
// This is NOT a native NRO or privileged IZ2S core.
const OPS=Object.freeze(['start','status','step','stop']);
const KEY='__IZ2S_BALATRO_APP_V1';
function script(operation,value){
  if(!OPS.includes(operation))throw Error('Unsupported operation');
  if(operation==='step'&&(!Number.isSafeInteger(value)||value<1||value>1000))
    throw Error('step value must be an integer from 1 to 1000');
  const step=operation==='step'?value:1;
  const fixed=[
    'local KEY="__IZ2S_BALATRO_APP_V1"',
    'local operation="'+operation+'"',
    'local app=rawget(_G,KEY)',
    'local function announce(message)',
    '  local ok,logger=pcall(require,"bl.log")',
    '  if ok and type(logger)=="table" and type(logger.log)=="function" then',
    '    pcall(logger.log,"[IZ2S APP] "..message)',
    '  end',
    'end',
    'if operation=="start" then',
    '  if not app then',
    '    app={id="balatro-lua-1",steps=0,active=true}',
    '    rawset(_G,KEY,app)',
    '    announce("STARTED - Lua component active")',
    '  end',
    'elseif operation=="step" then',
    '  if app and app.active then',
    '    app.steps=app.steps+'+step,
    '    announce("STEP "..tostring(app.steps))',
    '  end',
    'elseif operation=="stop" then',
    '  if app then announce("STOPPED - Lua component released") end',
    '  rawset(_G,KEY,nil)',
    '  app=nil',
    'end',
    'if not app then return "IZ2S_SESSION_V1;phase=idle;steps=0;id=none" end',
    'return "IZ2S_SESSION_V1;phase=running;steps="..tostring(app.steps)..";id="..app.id',
  ];
  return fixed.join('\n');
}
function parse(reply){
  if(typeof reply!=='string'||!reply.startsWith('-> IZ2S_SESSION_V1;'))
    throw Error('Unexpected Balatro session reply');
  const fields={};
  for(const part of reply.trim().slice(3).split(';').slice(1)){
    const index=part.indexOf('=');
    if(index<1)throw Error('Invalid session reply field');
    const key=part.slice(0,index);
    if(!['phase','steps','id'].includes(key)||Object.hasOwn(fields,key))
      throw Error('Unexpected session reply field');
    fields[key]=part.slice(index+1);
  }
  if(Object.keys(fields).length!==3||!['running','idle'].includes(fields.phase)||
     !/^\d{1,9}$/.test(fields.steps)||
     (fields.phase==='idle'&&(fields.id!=='none'||fields.steps!=='0'))||
     (fields.phase==='running'&&fields.id!=='balatro-lua-1'))
    throw Error('Invalid session response state');
  return {application:'IZ2S Balatro Lua',phase:fields.phase,
    steps:Number(fields.steps),id:fields.id,scope:'title-local',
    nativeCoreLaunched:false,privilegedSessionVerified:false};
}
async function execute(host,operation,value,options={}){
  return parse(await request({host,lua:script(operation,value),...options}));
}
async function main(){
  const [host,operation,arg]=process.argv.slice(2);
  if(!host||!OPS.includes(operation)){
    console.error('Usage: node app-session.cjs <console-ip> start|status|step|stop [step-count]');
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
