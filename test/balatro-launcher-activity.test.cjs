'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {LUA,parse,inspect}=require('../engines/iz2s-core/runtime/installer/engine/switch2/balatro/launcher-activity.cjs');
test('activity counters report physical draw and gamepad evidence without native readiness',()=>{
 const r=parse('-> IZ2S_ACTIVITY_V1;phase=running;frames=120;errors=0;gamepad=6;keyboard=0;fault=false');
 assert.equal(r.renderedFrames,120);
 assert.equal(r.physicalGamepadEvents,6);
 assert.equal(r.drawFault,false);
 assert.equal(r.nativeCoreReady,false);
 assert.equal(r.ready,false);
});
test('idle and malformed responses are never interpreted as successful activity',()=>{
 assert.deepEqual(parse('-> IZ2S_ACTIVITY_V1;phase=idle'),{phase:'idle',ready:false});
 for(const raw of [
  'IZ2S_ACTIVITY_V1;phase=running;frames=1;errors=0;gamepad=1;keyboard=0;fault=false',
  '-> IZ2S_ACTIVITY_V1;phase=invalid',
  '-> IZ2S_ACTIVITY_V1;phase=running;frames=-1;errors=0;gamepad=1;keyboard=0;fault=false',
  '-> IZ2S_ACTIVITY_V1;phase=running;frames=1;errors=0;gamepad=1;keyboard=0;fault=false;ready=true',
 ])assert.throws(()=>parse(raw));
});
test('activity probe is single read-only RPC and never sends synthetic inputs',async()=>{
 let called=0;
 const r=await inspect('192.168.1.232',{},async q=>{
  called++;assert.equal(q.port,9026);assert.equal(q.lua,LUA);
  return '-> IZ2S_ACTIVITY_V1;phase=running;frames=1;errors=0;gamepad=0;keyboard=0;fault=false';
 });
 assert.equal(called,1);
 assert.equal(r.physicalGamepadEvents,0);
 assert.doesNotMatch(LUA,/gamepadpressed|ffi\.new|rawset\(|navigate\(/);
});
