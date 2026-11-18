'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {LUA,parse,run}=require('../engines/iz2s-core/runtime/installer/engine/switch2/balatro/rpc-roundtrip.cjs');
test('strict RPC response parser',()=>{
 assert.deepEqual(parse('-> IZ2S_RT_V1;op=read;value=42','read'),{op:'read',value:'42'});
 for(const invalid of ['-> IZ2S_RT_V1;op=read;value=nil','-> IZ2S_RT_V1;op=read;value=43',
  '-> IZ2S_RT_V1;op=begin;value=42;extra=yes','IZ2S_RT_V1;op=read;value=42'])
  assert.throws(()=>parse(invalid,'read'));
});
test('separate RPC connections retain title-local state and clean up',async()=>{
 let state;
 const requests=[];
 const send=async({lua})=>{
   requests.push(lua);
   if(lua===LUA.begin){state=42;return '-> IZ2S_RT_V1;op=begin;value=42';}
   if(lua===LUA.read)return '-> IZ2S_RT_V1;op=read;value='+String(state??'nil');
   if(lua===LUA.clear){state=undefined;return '-> IZ2S_RT_V1;op=clear;value=nil';}
   throw Error('Unexpected script');
 };
 const result=await run('127.0.0.1',{},send);
 assert.equal(result.passed,true);
 assert.equal(result.ready,false);
 assert.equal(result.executedNativeCalls,false);
 assert.equal(state,undefined);
 assert.deepEqual(requests,[LUA.begin,LUA.read,LUA.clear]);
});
test('failed read does not cause retries and attempts cleanup',async()=>{
 const calls=[];
 const send=async({lua})=>{
   calls.push(lua);
   if(lua===LUA.begin)return '-> IZ2S_RT_V1;op=begin;value=42';
   if(lua===LUA.read)return '-> IZ2S_RT_V1;op=read;value=nil';
   return '-> IZ2S_RT_V1;op=clear;value=nil';
 };
 await assert.rejects(run('127.0.0.1',{},send),/state mismatch/);
 assert.deepEqual(calls,[LUA.begin,LUA.read,LUA.clear]);
});
test('ambiguous begin reply still attempts cleanup',async()=>{
 const calls=[];
 const send=async({lua})=>{
   calls.push(lua);
   return lua===LUA.clear?'-> IZ2S_RT_V1;op=clear;value=nil':'corrupted';
 };
 await assert.rejects(run('127.0.0.1',{},send),/Unexpected RPC framing/);
 assert.deepEqual(calls,[LUA.begin,LUA.clear]);
});
