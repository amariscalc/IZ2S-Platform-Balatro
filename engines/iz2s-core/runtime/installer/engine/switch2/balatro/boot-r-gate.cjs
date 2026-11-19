#!/usr/bin/env node
'use strict';
// Reversible, title-local right-shoulder boot-selector experiment.
// Does NOT patch savedata, bootstrap, native calls, privilege boundaries or SD.
// R press is observed (not swallowed); launch is explicitly initiated from PC.
const {request}=require('./rpc.cjs');
const orbit=require('./canonical-orbit.cjs');
const OPS=Object.freeze(['arm','status','launch','disarm']);
const KEY='__IZ2S_R_BOOT_GATE_V1';
function lua(op){
 if(!OPS.includes(op)||op==='launch')throw Error('Unsupported Lua gate operation');
 return [
 'local OP='+JSON.stringify(op),
 'local KEY='+JSON.stringify(KEY),
 'local g=rawget(_G,KEY)',
 'local handlers=love and love.handlers',
 'local function poll()',
 ' if type(g)~="table" or g.triggered then return end',
 ' local js=love and love.joystick',
 ' if type(js)~="table" or type(js.getJoysticks)~="function" then return end',
 ' local ok,list=pcall(js.getJoysticks)',
 ' if not ok or type(list)~="table" then return end',
 ' for _,j in ipairs(list) do',
 '  if type(j)=="userdata" or type(j)=="table" then',
 '   local okPressed,down=pcall(function() return j:isGamepadDown("rightshoulder") end)',
 '   if okPressed and down then g.triggered=true;g.source="held";return end',
 '  end',
 ' end',
 'end',
 'local function owned()',
 ' return type(g)=="table" and type(handlers)=="table" and handlers.gamepadpressed==g.wrapper',
 'end',
 'if OP=="arm" then',
 ' if type(handlers)~="table" or type(handlers.gamepadpressed)~="function" then',
 '  return "IZ2S_R_GATE_V1;phase=unsupported;triggered=0;owned=0;source=none"',
 ' end',
 ' if type(g)=="table" and not owned() then',
 '  return "IZ2S_R_GATE_V1;phase=conflict;triggered=0;owned=0;source=none"',
 ' end',
 ' if type(g)~="table" then',
 '  g={triggered=false,source="none",previous=handlers.gamepadpressed}',
 '  local function wrapper(joystick,button,...)',
 '   if rawget(_G,KEY)==g and button=="rightshoulder" then',
 '    g.triggered=true;g.source="pressed"',
 '   end',
 '   return g.previous(joystick,button,...)',
 '  end',
 '  g.wrapper=wrapper',
 '  rawset(_G,KEY,g)',
 '  handlers.gamepadpressed=wrapper',
 ' end',
 ' poll()',
 'elseif OP=="status" then',
 ' if type(g)~="table" then return "IZ2S_R_GATE_V1;phase=idle;triggered=0;owned=0;source=none" end',
 ' poll()',
 'elseif OP=="disarm" then',
 ' if type(g)~="table" then return "IZ2S_R_GATE_V1;phase=idle;triggered=0;owned=0;source=none" end',
 ' if owned() then handlers.gamepadpressed=g.previous end',
 ' rawset(_G,KEY,nil)',
 ' return "IZ2S_R_GATE_V1;phase=idle;triggered=0;owned=0;source=none"',
 'end',
 'local active=owned()',
 'local phase=active and (g.triggered and "pressed" or "armed") or "conflict"',
 'return "IZ2S_R_GATE_V1;phase="..phase..";triggered="..(g.triggered and "1" or "0")..',
 ' ";owned="..(active and "1" or "0")..";source="..(g.triggered and g.source or "none")',
 ].join('\n');
}
function parse(reply){
 if(typeof reply!=='string'||!reply.startsWith('-> '))throw Error('Invalid R-gate framing');
 const m=/^IZ2S_R_GATE_V1;phase=(idle|armed|pressed|unsupported|conflict);triggered=([01]);owned=([01]);source=(none|held|pressed)$/.exec(reply.slice(3).trim());
 if(!m)throw Error('Invalid R-gate response');
 const [,phase,triggered,owned,source]=m;
 if((phase==='pressed')!==(triggered==='1')||(phase==='armed'||phase==='pressed')!==(owned==='1')||
    (triggered==='0'&&source!=='none')||(triggered==='1'&&source==='none'))
  throw Error('Contradictory R-gate response');
 return {backend:'balatro',mode:'title-local-r-shoulder-gate',phase,
  rTriggered:triggered==='1',hookOwned:owned==='1',triggerSource:source,
  persistentSavedataInstalled:false,automaticTitleBoot:false,nativeLauncherStarted:false,ready:false};
}
async function execute(host,op,{port=9026,send=request,launch=orbit.launch}={}){
 if(!OPS.includes(op))throw Error('Unsupported R-gate operation');
 if(op==='launch'){
  const state=parse(await send({host,port,lua:lua('status'),timeoutMs:5000,maxReplyBytes:1024}));
  if(state.phase!=='pressed')return {...state,launchSkipped:'R not detected; first arm and press R'};
  const result=await launch(host,{port,images:false});
  return {...state,menu:result,menuAttempted:true,nativeLauncherStarted:false,ready:false};
 }
 return parse(await send({host,port,lua:lua(op),timeoutMs:5000,maxReplyBytes:1024}));
}
async function main(){
 const [host,op='status',rawPort]=process.argv.slice(2);
 if(!host||!OPS.includes(op)){
  console.error('Usage: node boot-r-gate.cjs <switch-ip> arm|status|launch|disarm [port]');
  process.exitCode=2;return;
 }
 try{const result=await execute(host,op,{port:rawPort?Number(rawPort):9026});
  console.log(JSON.stringify(result,null,2));
  if(['conflict','unsupported'].includes(result.phase))process.exitCode=1;
 }catch(e){console.error(JSON.stringify({phase:'error',ready:false,error:e.message}));process.exitCode=1;}
}
if(require.main===module)main();
module.exports={OPS,KEY,lua,parse,execute};
