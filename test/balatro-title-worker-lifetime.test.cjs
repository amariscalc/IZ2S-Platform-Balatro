'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {START,STATUS,parse,inspect}=require('../engines/iz2s-core/runtime/installer/engine/switch2/balatro/title-worker-lifetime.cjs');
test('retains worker references and does not join or release thread after start',()=>{
 assert.match(START,/rawset\(_G,key,state\)/);
 assert.match(START,/state.worker=t.newThread\(data\)/);
 assert.match(STATUS,/s.channel:pop\(\)/);
 for(const text of [START,STATUS])assert.doesNotMatch(text,/worker:wait|worker:release|ro:dmnt|mapCode|svc/);
});
test('title status and start are separate bounded RPC messages',async()=>{
 const sent=[];
 const send=async opts=>{sent.push(opts.lua);return '-> IZ2S_WORKER_LIFETIME_V1;phase='+(sent.length===1?'spawned':'delivered')};
 const a=await inspect('192.168.1.232','start',{send});
 const b=await inspect('192.168.1.232','status',{send});
 assert.equal(a.phase,'spawned');assert.equal(b.phase,'delivered');
 assert.equal(sent.length,2);assert.notEqual(sent[0],sent[1]);
 assert.equal(b.nativeSupervisorRunning,false);
});
test('malformed replies and unsafe operation names fail closed',async()=>{
 for(const phase of ['missing','already-started','running','start-error','pop-error'])
  assert.equal(parse('-> IZ2S_WORKER_LIFETIME_V1;phase='+phase).phase,phase);
 assert.throws(()=>parse('-> IZ2S_WORKER_LIFETIME_V1;phase=success'));
 await assert.rejects(()=>inspect('192.168.1.232','restart'),/start or status/);
});
