'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {SCRIPTS,parse,inspect}=require('../engines/iz2s-core/runtime/installer/engine/switch2/balatro/title-worker-mailbox.cjs');
test('persistent worker accepts a fixed mailbox command and returns fixed result',()=>{
 assert.match(SCRIPTS.start,/tin:demand\(\)/);
 assert.match(SCRIPTS.start,/tout:push\("pong:1"\)/);
 assert.match(SCRIPTS.send,/s.inbox:push\("ping:1"\)/);
 assert.match(SCRIPTS.status,/s.outbox:pop\(\)/);
 assert.match(SCRIPTS.start,/rawset\(_G,key,state\)/);
 for(const script of Object.values(SCRIPTS)){
  assert.doesNotMatch(script,/worker:wait|worker:release|ro:dmnt|mapCode|svc|ffi/);
 }
});
test('duplicate start and command cannot replay previous action',()=>{
 assert.match(SCRIPTS.start,/already-started/);
 assert.match(SCRIPTS.send,/command-already-sent/);
});
test('parsing never represents mailbox as native supervisor',()=>{
 for(const p of ['started','sent','pending','verified','receive-error']){
  const r=parse('-> IZ2S_MAILBOX_V1;phase='+p);
  assert.equal(r.commandRoundtripVerified,p==='verified');
  assert.equal(r.nativeSupervisorRunning,false);
  assert.equal(r.ready,false);
 }
 assert.throws(()=>parse('-> IZ2S_MAILBOX_V1;phase=native-running'));
});
test('each CLI operation sends exactly one bounded Lua request',async()=>{
 let count=0;
 for(const op of ['start','send','status']){
  await inspect('192.168.1.232',op,{send:async r=>{
   count++;assert.equal(r.timeoutMs,5000);return '-> IZ2S_MAILBOX_V1;phase=started';
  }});
 }
 assert.equal(count,3);
});
