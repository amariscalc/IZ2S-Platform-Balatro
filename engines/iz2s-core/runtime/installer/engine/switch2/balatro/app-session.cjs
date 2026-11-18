#!/usr/bin/env node
'use strict';
const {request}=require('./rpc.cjs');

// Persistent application-layer component stored in Balatro's Lua _G.
// All Lua programs are fixed, bounded and execute only in the existing title.
// This is NOT a native NRO or privileged IZ2S core.
const OPS=Object.freeze(['start','status','step','stop','up','down','select','back']);
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
    '    local h=300',
    '    local x,y=math.floor(screenW*0.035),math.floor(screenH*0.22)',
    '    g.setColor(0.09,0.13,0.10,0.97)',
    '    g.rectangle("fill",x,y,w,h,8,8)',
    '    g.setColor(0.69,0.91,0.22,1)',
    '    g.rectangle("line",x,y,w,h,8,8)',
    '    g.print("IZ2S  /  BALATRO",x+18,y+17)',
    '    g.setColor(1,1,1,1)',
    "g.print(\"STEPS: \"..tostring(app.steps),x+18,y+50)",
    "if app.page==\"home\" then",
    "  local items={\"ADD +1\",\"ADD +5\",\"STATUS\",\"ABOUT\",\"STOP LUA APP\"}",
    "  for i,label in ipairs(items) do",
    "    if i==app.menu then g.setColor(0.70,0.92,0.23,1)",
    "    else g.setColor(0.85,0.89,0.85,1) end",
    "    g.print((i==app.menu and \"> \" or \"  \")..label,x+18,y+69+i*27)",
    "  end",
    "elseif app.page==\"status\" then",
    "  g.print(\"STATUS: RUNNING\",x+18,y+105)",
    "  g.print(\"STEPS: \"..tostring(app.steps),x+18,y+142)",
    "else",
    "  g.print(\"IZ2S APPLICATION LAYER\",x+18,y+105)",
    "  g.print(\"BALATRO LUA RPC / NO NATIVE PROCESS\",x+18,y+142)",
    "end",
    "g.setColor(0.68,0.80,0.70,1)",
    "g.print(\"DPAD UP/DOWN  A SELECT  B BACK\",x+18,y+264)",
    '    g.print("NATIVE CORE NOT LAUNCHED",x+18,y+281)',
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
    "local function shutdown()",
    "  if not app then return end",
    "  if app.overlayDraw then",
    "    local ok,console=pcall(require,\"bl.console\")",
    "    if ok and type(console)==\"table\" and console.draw==app.overlayDraw then",
    "      console.draw=app.previousDraw",
    "    end",
    "  end",
    "  local handlers=love and love.handlers",
    "  if type(handlers)==\"table\" and type(app.inputHooks)==\"table\" then",
    "    for name,pair in pairs(app.inputHooks) do",
    "      if handlers[name]==pair.wrapper then handlers[name]=pair.original end",
    "    end",
    "  end",
    "  announce(\"STOPPED - Lua component released\")",
    "  rawset(_G,KEY,nil)",
    "  app=nil",
    "end",
    "local function menuAction(op)",
    "  if not app then return end",
    "  if op==\"up\" then",
    "    app.page=\"home\"",
    "    app.menu=((app.menu+3)%5)+1",
    "  elseif op==\"down\" then",
    "    app.page=\"home\"",
    "    app.menu=(app.menu%5)+1",
    "  elseif op==\"back\" then",
    "    if app.page==\"home\" then shutdown() else app.page=\"home\" end",
    "  elseif op==\"select\" then",
    "    if app.page~=\"home\" then app.page=\"home\";return end",
    "    if app.menu==1 or app.menu==2 then",
    "      app.steps=math.min(999999999,app.steps+(app.menu==1 and 1 or 5))",
    "      announce(\"STEP \"..tostring(app.steps))",
    "    elseif app.menu==3 then app.page=\"status\"",
    "    elseif app.menu==4 then app.page=\"about\"",
    "    elseif app.menu==5 then shutdown() end",
    "  end",
    "end",
    "local function attachInput()",
    "  local handlers=love and love.handlers",
    "  if type(handlers)~=\"table\" then return false end",
    "  app.inputHooks=app.inputHooks or {}",
    "  local gamepad={dpup=\"up\",dpdown=\"down\",a=\"select\",b=\"back\"}",
    "  local keyboard={up=\"up\",down=\"down\",[\"return\"]=\"select\",escape=\"back\"}",
    "  local function install(name,mapping)",
    "    if app.inputHooks[name] and handlers[name]==app.inputHooks[name].wrapper then return true end",
    "    local original=handlers[name]",
    "    if type(original)~=\"function\" then return false end",
    "    local function wrapper(a,b,...)",
    "      local key=name==\"gamepadpressed\" and b or a",
    "      local op=mapping[key]",
    "      if op and rawget(_G,KEY)==app then",
    "        local ok=pcall(menuAction,op)",
    "        if ok then return end",
    "      end",
    "      return original(a,b,...)",
    "    end",
    "    app.inputHooks[name]={original=original,wrapper=wrapper}",
    "    handlers[name]=wrapper",
    "    return true",
    "  end",
    "  local gamepadActive=install(\"gamepadpressed\",gamepad)",
    "  install(\"keypressed\",keyboard)",
    "  return gamepadActive",
    "end",
    'if operation=="start" then',
    '  if app and app.uiVersion~=2 then shutdown() end',
    '  if not app then',
    '    app={id="balatro-lua-1",steps=0,active=true,uiVersion=2,menu=1,page="home"}',
    '    rawset(_G,KEY,app)',
    '    announce("STARTED - Lua component active")',
    '  end',
    '  app.overlayActive=attachOverlay()',
    '  app.inputActive=attachInput()'
    'elseif operation=="step" then',
    '  if app and app.active then',
    '    app.steps=math.min(999999999,app.steps+'+step+')',
    '    announce("STEP "..tostring(app.steps))',
    '  end',
    'elseif operation=="stop" then',
    '  shutdown()',
    'elseif operation=="up" or operation=="down" or operation=="select" or operation=="back" then',
    '  menuAction(operation)',
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
