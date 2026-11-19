'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {SCRIPTS,PHASES,parse,inspect}=require('../engines/iz2s-core/runtime/installer/engine/switch2/balatro/book-reader-controller-worker-bridge.cjs');
test('requires hardware controller request after arming and keeps one dispatch',()=>{
 assert.match(SCRIPTS.arm,/s.armedAt=n/);
 assert.match(SCRIPTS.dispatch,/n==s.armedAt/);
 assert.match(SCRIPTS.dispatch,/n~=s.armedAt\+1/);
 assert.match(SCRIPTS.dispatch,/s.dispatched=true/);
 assert.match(SCRIPTS.dispatch,/already-dispatched/);
 assert.match(SCRIPTS.dispatch,/a.detail.id~="book-reader"/);
});
test('worker acknowledges fixed Book Reader message without native launch',()=>{
 assert.match(SCRIPTS.start,/msg=="book-reader:1"/);
 assert.match(SCRIPTS.start,/tout:push\("book-reader-received:1"\)/);
 assert.match(SCRIPTS.status,/s.output:pop\(\)/);
 for(const code of Object.values(SCRIPTS))assert.doesNotMatch(code,/worker:wait|worker:release|ro:dmnt|svc|mapCode|ffi/);
 const response=parse('-> IZ2S_BOOK_BRIDGE_V1;phase=worker-acknowledged');
 assert.equal(response.controllerRequestDeliveredToWorker,true);
 assert.equal(response.originalBookReaderExecuted,false);
 assert.equal(response.ready,false);
});
test('rejects existing worker and unexpected reply states',()=>{
 assert.match(SCRIPTS.start,/__IZ2S_BOOK_READER_MAILBOX_V3/);
 for(const phase of PHASES)assert.equal(parse('-> IZ2S_BOOK_BRIDGE_V1;phase='+phase).phase,phase);
 assert.throws(()=>parse('-> IZ2S_BOOK_BRIDGE_V1;phase=native-running'));
});
test('each command is one bounded Balatro RPC',async()=>{
 let count=0;
 for(const op of ['start','arm','dispatch','status']){
  await inspect('192.168.1.232',op,{send:async options=>{
   count++;assert.equal(options.timeoutMs,5000);
   return '-> IZ2S_BOOK_BRIDGE_V1;phase=started';
  }});
 }
 assert.equal(count,4);
});
