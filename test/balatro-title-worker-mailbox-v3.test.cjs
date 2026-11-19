'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {SCRIPTS,PHASES,parse,inspect}=require('../engines/iz2s-core/runtime/installer/engine/switch2/balatro/title-worker-mailbox-v3.cjs');
test('worker parks but never exits, joins or releases',()=>{
 assert.match(SCRIPTS.start,/parked=true;output:push\("parked:2"\)/);
 assert.match(SCRIPTS.start,/input:demand\(\)/);
 assert.match(SCRIPTS.start,/old-worker-present/);
 for(const code of Object.values(SCRIPTS))
  assert.doesNotMatch(code,/worker:wait|worker:release|break\s*end|ro:dmnt|svc|mapCode|ffi/);
});
test('ordered single-shot commands and no stop verb',()=>{
 assert.deepEqual(Object.keys(SCRIPTS),['start','ping','park','status']);
 assert.match(SCRIPTS.ping,/s.sent~=0 or s.received~=0 or s.pending/);
 assert.match(SCRIPTS.park,/s.sent~=1 or s.received~=1 or s.pending/);
});
test('only actual parked and running status is accepted as success',()=>{
 const good=parse('-> IZ2S_MAILBOX_V3;phase=parked-alive');
 assert.equal(good.parkedWorkerStillRunning,true);
 assert.equal(good.nativeSupervisorRunning,false);
 assert.equal(good.ready,false);
 for(const phase of PHASES)assert.equal(parse('-> IZ2S_MAILBOX_V3;phase='+phase).phase,phase);
 assert.throws(()=>parse('-> IZ2S_MAILBOX_V3;phase=stopped'));
});
test('one bounded RPC per operation',async()=>{
 let count=0;
 for(const op of ['start','ping','park','status'])
  await inspect('192.168.1.232',op,{send:async x=>{count++;assert.equal(x.timeoutMs,5000);return '-> IZ2S_MAILBOX_V3;phase=started';}});
 assert.equal(count,4);
 await assert.rejects(()=>inspect('192.168.1.232','stop'),/Unknown V3 operation/);
});
