'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {PROBE,parse,observe}=require('../engines/iz2s-core/runtime/installer/engine/switch2/balatro/controller-observe.cjs');
const RUNNING='-> IZ2S_INPUT_V1;phase=running;menu=2;page=home;steps=5;overlay=true;gamepad=true;keyboard=false;drawFault=false';
test('strictly parses active input and overlay telemetry',()=>{
 const state=parse(RUNNING);
 assert.deepEqual(state,{phase:'running',menu:2,page:'home',steps:5,overlay:true,
  gamepad:true,keyboard:false,drawFault:false,nativeCoreLaunched:false});
 assert.deepEqual(parse('-> IZ2S_INPUT_V1;phase=idle'),{phase:'idle'});
});
test('rejects unexpected fields, bad states, and malformed booleans',()=>{
 for(const raw of [
  RUNNING+';native=true',
  RUNNING.replace('menu=2','menu=6'),
  RUNNING.replace('gamepad=true','gamepad=yes'),
  RUNNING.replace('page=home','page=unknown'),
  RUNNING.replace('steps=5','steps=-1'),
  RUNNING.slice(3),
 ])assert.throws(()=>parse(raw));
});
test('observer sends fixed read-only Lua and does not modify state',async()=>{
 const calls=[];
 const result=await observe('127.0.0.1',{},async request=>{
  calls.push(request);
  return RUNNING;
 });
 assert.equal(result.gamepad,true);
 assert.equal(calls.length,1);
 assert.equal(calls[0].lua,PROBE);
 assert.equal(calls[0].port,9026);
 assert.equal(calls[0].timeoutMs,5000);
 assert.doesNotMatch(PROBE,/rawset\s*\(|\.invoke\s*\(|\.declare\s*\(/);
});
