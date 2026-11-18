'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {OPS,KEY,script,parse}=require('../engines/iz2s-core/runtime/installer/engine/switch2/balatro/app-session.cjs');
test('session exposes fixed lifecycle and menu operations',()=>{
 assert.deepEqual(OPS,['start','status','step','stop','up','down','select','back']);
 assert.throws(()=>script('eval'),/Unsupported/);
 assert.throws(()=>script('step',0),/step value/);
 assert.throws(()=>script('step',1001),/step value/);
 assert.throws(()=>script('step',1.5),/step value/);
});
test('application state persists through raw Lua globals, not filesystem',()=>{
 const start=script('start');
 const status=script('status');
 assert.match(start,/rawset\(_G,KEY,app\)/);
 assert.match(status,/rawget\(_G,KEY\)/);
 assert.match(script('stop'),/rawset\(_G,KEY,nil\)/);
 assert.ok(start.includes(KEY));
 for(const op of OPS)assert.doesNotMatch(script(op,op==='step'?2:undefined),
   /love\.ffi|ffi\.|\.invoke\(|\.declare\(|love\.filesystem|pm:shell|pm:dmnt|loadstring|os\.execute/);
});
test('parse bounded running and idle replies, never native ready',()=>{
 const r=parse('-> IZ2S_SESSION_V1;phase=running;steps=4;id=balatro-lua-1\n');
 assert.equal(r.phase,'running');
 assert.equal(r.steps,4);
 assert.equal(r.nativeCoreLaunched,false);
 assert.equal(r.privilegedSessionVerified,false);
 assert.equal(parse('-> IZ2S_SESSION_V1;phase=idle;steps=0;id=none').phase,'idle');
});
test('reject inconsistent and spurious status fields',()=>{
 for(const s of [
  '-> IZ2S_SESSION_V1;phase=running;steps=1;id=none',
  '-> IZ2S_SESSION_V1;phase=idle;steps=2;id=none',
  '-> IZ2S_SESSION_V1;phase=running;steps=1;id=balatro-lua-1;ready=true',
  '-> IZ2S_SESSION_V1;phase=running;steps=-1;id=balatro-lua-1',
  '-> error',
 ])assert.throws(()=>parse(s));
});

test('start attaches a reversible graphical overlay to Balatro console drawing',()=>{
 const code=script('start');
 assert.match(code, /pcall\(require,"bl\.console"\)/);
 assert.match(code, /local function drawOverlay\(\)/);
 assert.match(code, /console\.draw=wrapper/);
 assert.match(code, /app\.overlayActive=attachOverlay\(\)/);
 assert.doesNotMatch(code, /love\.draw\s*=/);
});
test('stop restores only the renderer hook owned by IZ2S',()=>{
 const code=script('stop');
 assert.match(code, /console\.draw==app\.overlayDraw/);
 assert.match(code, /console\.draw=app\.previousDraw/);
 assert.match(code, /rawset\(_G,KEY,nil\)/);
});
test('overlay acknowledgment is distinct from native readiness',()=>{
 const attached=parse('-> IZ2S_SESSION_V1;phase=running;steps=5;id=balatro-lua-1;overlay=attached');
 assert.equal(attached.overlay,'attached');
 assert.equal(attached.nativeCoreLaunched,false);
 assert.equal(attached.privilegedSessionVerified,false);
 assert.equal(parse('-> IZ2S_SESSION_V1;phase=running;steps=0;id=balatro-lua-1;overlay=unavailable').overlay,'unavailable');
 assert.equal(parse('-> IZ2S_SESSION_V1;phase=idle;steps=0;id=none;overlay=none').overlay,'none');
 assert.throws(()=>parse('-> IZ2S_SESSION_V1;phase=running;steps=0;id=balatro-lua-1;overlay=none'));
});

test('graphical five-item menu and reversible controller hooks are generated',()=>{
 const source=script('start');
 assert.match(source,/STOP LUA APP/);
 assert.match(source,/local gamepad=\{dpup="up",dpdown="down",a="select",b="back"\}/);
 assert.match(source,/install\("gamepadpressed",gamepad\)/);
 assert.match(source,/handlers\[name\]==pair.wrapper/);
 assert.match(source,/handlers\[name\]=pair.original/);
 assert.match(source,/return original\(a,b,\.\.\.\)/);
 assert.match(source,/console\.draw=app\.previousDraw/);
 assert.doesNotMatch(source,/love\.draw\s*=/);
});
test('menu actions are bounded and cannot invoke native operations',()=>{
 for(const operation of ['up','down','select','back']){
  const source=script(operation);
  assert.match(source,/menuAction\(operation\)/);
  assert.doesNotMatch(source,/love\.ffi|ffi\.|\.invoke\(|\.declare\(|pm:shell|pm:dmnt/);
 }
});
