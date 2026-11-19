'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {SCRIPTS,PHASES,parse,inspect}=require('../engines/iz2s-core/runtime/installer/engine/switch2/balatro/title-worker-mailbox-v2.cjs');
test('V2 worker has an ordered explicit stop without joining or release',()=>{
 assert.match(SCRIPTS.start,/previous-worker-active/);
 assert.match(SCRIPTS.start,/cmd=="stop:3"/);
 assert.match(SCRIPTS.start,/o:push\("stopped:3"\);break/);
 assert.match(SCRIPTS.status,/s.worker:isRunning\(\)/);
 for(const script of Object.values(SCRIPTS))assert.doesNotMatch(script,/worker:wait|worker:release|ro:dmnt|mapCode|svc|ffi/);
});
test('commands require exact previous acknowledgment',()=>{
 assert.match(SCRIPTS.ping,/s.seq~=0 or s.ack~=0 or s.pending/);
 assert.match(SCRIPTS.checksum,/s.seq~=1 or s.ack~=1 or s.pending/);
 assert.match(SCRIPTS.stop,/s.seq~=2 or s.ack~=2 or s.pending/);
});
test('stop acknowledgment is not thread termination',()=>{
 assert.equal(parse('-> IZ2S_MAILBOX_V2;phase=stop-acknowledged').workerStoppedVerified,false);
 assert.equal(parse('-> IZ2S_MAILBOX_V2;phase=stopped').workerStoppedVerified,true);
 assert.equal(parse('-> IZ2S_MAILBOX_V2;phase=stopped').nativeSupervisorRunning,false);
});
test('strict parser and single bounded requests',async()=>{
 for(const state of PHASES)assert.equal(parse('-> IZ2S_MAILBOX_V2;phase='+state).phase,state);
 assert.throws(()=>parse('-> IZ2S_MAILBOX_V2;phase=native-success'));
 let count=0;
 for(const op of ['start','ping','checksum','status'])await inspect('192.168.1.232',op,{send:async args=>{
  count++;assert.equal(args.timeoutMs,5000);return '-> IZ2S_MAILBOX_V2;phase=started';
 }});
 assert.equal(count,4);
});

test('known crashing stop action is disabled locally without sending any RPC',async()=>{
 let sent=0;
 await assert.rejects(()=>inspect('192.168.1.232','stop',{send:async()=>{sent++;return '-> IZ2S_MAILBOX_V2;phase=stop-sent';}}),/stop is disabled/);
 assert.equal(sent,0);
});
