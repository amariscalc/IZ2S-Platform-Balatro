'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {LUA,STATES,parse,inspect}=require('../engines/iz2s-core/runtime/installer/engine/switch2/balatro/title-channel-only.cjs');
test('isolates channel push/pop without any thread allocation or wait',()=>{
 assert.match(LUA,/channel:push/);
 assert.match(LUA,/channel:pop/);
 assert.doesNotMatch(LUA,/newThread|worker:start|worker:wait|ffi|ro:dmnt/);
});
test('reports verified channel independent of thread stability',()=>{
 const r=parse('-> IZ2S_CHANNEL_ONLY_V1;phase=verified');
 assert.equal(r.titleChannelRoundtripVerified,true);
 assert.equal(r.workerCreated,false);
 assert.equal(r.workerLifecycleSafe,null);
 assert.equal(r.ready,false);
});
test('every stage error is explicit',()=>{
 for(const state of STATES)assert.equal(parse('-> IZ2S_CHANNEL_ONLY_V1;phase='+state).phase,state);
 assert.throws(()=>parse('-> IZ2S_CHANNEL_ONLY_V1;phase=success'));
});
test('one read/write RPC only, no retry',async()=>{
 let calls=0;
 const r=await inspect('192.168.1.232',{send:async a=>{
  calls++;assert.equal(a.timeoutMs,5000);
  return '-> IZ2S_CHANNEL_ONLY_V1;phase=verified';
 }});
 assert.equal(calls,1);assert.equal(r.phase,'verified');
});
