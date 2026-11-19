'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {LUA,STATES,parse,inspect}=require('../engines/iz2s-core/runtime/installer/engine/switch2/balatro/title-worker-channel.cjs');
test('worker sends a fixed computed message through a private title-local channel',()=>{
 assert.match(LUA,/newFileData/);
 assert.match(LUA,/channel:push\("IZ2S_WORKER_RESULT_42"\)/);
 assert.match(LUA,/channel:pop\(\)/);
 assert.match(LUA,/worker:wait\(\)/);
 assert.match(LUA,/channel:clear\(\)/);
 assert.doesNotMatch(LUA,/ro:dmnt|svc|mapCode|ffi\.call/);
});
test('success asserts only title-local message exchange',()=>{
 const r=parse('-> IZ2S_WORKER_CHANNEL_V1;phase=verified\n');
 assert.equal(r.titleWorkerMessageRoundtripVerified,true);
 assert.equal(r.originalNativeSupervisorStarted,false);
 assert.equal(r.serviceIpcVerified,false);
 assert.equal(r.ready,false);
});
test('all failures are explicit and reject unknown success',()=>{
 for(const state of STATES){
  const r=parse('-> IZ2S_WORKER_CHANNEL_V1;phase='+state);
  assert.equal(r.titleWorkerMessageRoundtripVerified,state==='verified');
 }
 for(const v of ['','-> IZ2S_WORKER_CHANNEL_V1;phase=success',
  'IZ2S_WORKER_CHANNEL_V1;phase=verified'])assert.throws(()=>parse(v));
});
test('one bounded hardware request only',async()=>{
 let calls=0;
 const r=await inspect('192.168.1.232',{send:async opts=>{
  calls++;assert.equal(opts.timeoutMs,7000);
  return '-> IZ2S_WORKER_CHANNEL_V1;phase=verified';
 }});
 assert.equal(calls,1);assert.equal(r.phase,'verified');
});
