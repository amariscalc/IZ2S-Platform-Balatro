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
    'local function drawOverlay()',
    '  if app.drawFault or rawget(_G,KEY)~=app then return end',
    '  local g=love and love.graphics',
    '  if type(g)~="table" or type(g.push)~="function" then return end',
    '  local pushed=pcall(g.push,"all")',
    '  if not pushed then return end',
    '  local ok=pcall(function()',
    '    local screenW,screenH=g.getDimensions()',
    '    local w=math.floor(math.min(620,screenW*0.44))',
    '    local h=132',
    '    local x,y=math.floor(screenW*0.035),math.floor(screenH*0.22)',
    '    g.setColor(0.09,0.13,0.10,0.97)',
    '    g.rectangle("fill",x,y,w,h,8,8)',
    '    g.setColor(0.69,0.91,0.22,1)',
    '    g.rectangle("line",x,y,w,h,8,8)',
    '    g.print("IZ2S  /  BALATRO",x+18,y+17)',
    '    g.setColor(1,1,1,1)',
    '    g.print("LUA APP RUNNING  -  STEPS: "..tostring(app.steps),x+18,y+54)',
    '    g.print("NATIVE CORE NOT LAUNCHED",x+18,y+92)',
    '  end)',
    '  pcall(g.pop)',
    '  if not ok then app.drawFault=true end',
    'end',
    'local function attachOverlay()',
    '  local ok,console=pcall(require,"bl.console")',
    '  if not ok or type(console)~="table" or type(console.draw)~="function" then return false end',
    '  if app.overlayDraw and console.draw==app.overlayDraw then return true end',
    '  if app.overlayDraw then return false end',
    '  local previous=console.draw',
    '  local function wrapper(...)',
    '    previous(...)',
    '    if rawget(_G,KEY)==app then pcall(drawOverlay) end',
    '  end',
    '  app.previousDraw,app.overlayDraw=previous,wrapper',
    '  console.draw=wrapper',
    '  return true',
    'end',
    'if operation=="start" then',
    '  if not app then',
    '    app={id="balatro-lua-1",steps=0,active=true}',
    '    rawset(_G,KEY,app)',
    '    announce("STARTED - Lua component active")',
    '  end',
    '  app.overlayActive=attachOverlay()',
    'elseif operation=="step" then',
    '  if app and app.active then',
    '    app.steps=app.steps+'+step,
    '    announce("STEP "..tostring(app.steps))',
    '  end',
    'elseif operation=="stop" then',
    '  if app then',
    '    if app.overlayDraw then',
    '      local ok,console=pcall(require,"bl.console")',
    '      if ok and type(console)=="table" and console.draw==app.overlayDraw then',
    '        console.draw=app.previousDraw',
    '      end',
    '    end',
    '    announce("STOPPED - Lua component released")',
    '  end',
    '  rawset(_G,KEY,nil)',
    '  app=nil',
    'end',
    'if not app then return "IZ2S_SESSION_V1;phase=idle;steps=0;id=none;overlay=none" end',
    'local overlay=app.overlayActive and "attached" or "unavailable"',
    'return "IZ2S_SESSION_V1;phase=running;steps="..tostring(app.steps)..";id="..app.id..";overlay="..overlay',
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
