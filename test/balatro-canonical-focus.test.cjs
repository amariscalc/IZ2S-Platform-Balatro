'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {MODEL,TEMPLATE,script,parse,execute,OPS}=require('../engines/iz2s-core/runtime/installer/engine/switch2/balatro/canonical-focus.cjs');
const ROOT=path.resolve(__dirname,'..');
test('canonical focus Lua model ports the upstream layout constants and equations',()=>{
 const original=fs.readFileSync(path.join(ROOT,'engines/CivSwitch/launcher/app/shaders/focus-layout.glsl'),'utf8');
 const layout=fs.readFileSync(path.join(ROOT,'engines/CivSwitch/launcher/app/shaders/launcher-layout.glsl'),'utf8');
 for(const literal of ['850.0','1200.0','560.0','300.0','402.0','218.0','116.0']){
  assert.ok(original.includes(literal),'Upstream focus layout missing '+literal);
 }
 assert.match(MODEL,/local dx=x-850/);
 assert.match(MODEL,/local u=dx\/1200/);
 assert.match(MODEL,/402\+\(index-flow\)\*218/);
 assert.match(MODEL,/M\.maxInstalled=15/);
 assert.match(layout,/IZ_PAGE_SIZE=5u/);
 assert.match(MODEL,/M\.pageSize=5/);
 assert.match(MODEL,/213\/255/);
 assert.match(TEMPLATE,/NO VERIFIED APPLICATIONS/);
});
test('source-composed payload stays within 8192-byte RPC boundary',()=>{
 for(const op of OPS){
  const code=script(op);
  assert.ok(Buffer.byteLength(code)<=8192,op);
  assert.ok(!code.includes('__MODEL_SOURCE__'));
  assert.ok(code.includes('function M.railY'));
 }
});
test('running focus state is a Lua view port, never a native supervisor',()=>{
 const r=parse('-> IZ2S_FOCUS_V1;phase=running;view=home;selected=0;installed=0;frames=128;inputs=4;errors=0','status');
 assert.equal(r.renderedFrames,128);
 assert.equal(r.controllerEvents,4);
 assert.equal(r.installed,0);
 assert.equal(r.nativeSupervisorRunning,false);
 assert.equal(r.catalogVerified,false);
 assert.equal(r.ready,false);
});
test('empty picker and clean stop are represented without claiming installation',()=>{
 const r=parse('-> IZ2S_FOCUS_V1;phase=running;view=picker;selected=0;installed=0;frames=200;inputs=3;errors=0','select');
 assert.equal(r.view,'picker');
 assert.equal(parse('-> IZ2S_FOCUS_V1;phase=idle;view=none;selected=0;installed=0;frames=0;inputs=0;errors=0','stop').phase,'idle');
 assert.throws(()=>parse('-> IZ2S_FOCUS_V1;phase=running;view=home;selected=5;installed=0;frames=0;inputs=0;errors=0','status'));
});
test('fixed payload is sent once and never synthesizes fake catalogue',async()=>{
 let n=0;
 const r=await execute('192.168.1.232','status',{},async q=>{
  n++;assert.equal(q.port,9026);assert.equal(q.lua,script('status'));
  return '-> IZ2S_FOCUS_V1;phase=idle;view=none;selected=0;installed=0;frames=0;inputs=0;errors=0';
 });
 assert.equal(n,1);assert.equal(r.ready,false);
 assert.doesNotMatch(MODEL,/Foldrift|Cheese|Zelda|Doom/);
});
