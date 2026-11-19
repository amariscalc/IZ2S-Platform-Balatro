'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {lua,parse,execute}=require('../engines/iz2s-core/runtime/installer/engine/switch2/balatro/boot-r-gate.cjs');
test('reversible gamepad event hook retains previous handler and avoids native and savedata writes',()=>{
 const source=lua('arm');
 assert.match(source,/rightshoulder/);
 assert.match(source,/g\.previous\(joystick,button,\.\.\.\)/);
 assert.match(lua('disarm'),/handlers\.gamepadpressed=g\.previous/);
 assert.doesNotMatch(source,/ffi\.|filesystem\.write|save|loadstring|fiber_switch|ctx_restore/);
 assert.ok(Buffer.byteLength(source)<8192);
});
test('strict status and explicit non-persistent boundary',()=>{
 const r=parse('-> IZ2S_R_GATE_V1;phase=pressed;triggered=1;owned=1;source=held');
 assert.equal(r.rTriggered,true);
 assert.equal(r.automaticTitleBoot,false);
 assert.equal(r.persistentSavedataInstalled,false);
 assert.throws(()=>parse('-> IZ2S_R_GATE_V1;phase=pressed;triggered=0;owned=1;source=none'));
});
test('no launch if right shoulder was not detected',async()=>{
 let launched=false;
 const r=await execute('192.168.1.232','launch',{send:async()=> '-> IZ2S_R_GATE_V1;phase=armed;triggered=0;owned=1;source=none',launch:async()=>{launched=true}});
 assert.equal(launched,false);
 assert.equal(r.menuAttempted,undefined);
});
test('detected R gates the existing canonical orbit launch',async()=>{
 let launched=0;
 const r=await execute('192.168.1.232','launch',{
  send:async()=> '-> IZ2S_R_GATE_V1;phase=pressed;triggered=1;owned=1;source=pressed',
  launch:async(_host,opts)=>{launched++;assert.equal(opts.images,false);return {phase:'running',ready:false}},
 });
 assert.equal(launched,1);
 assert.equal(r.menu.phase,'running');
 assert.equal(r.nativeLauncherStarted,false);
});
