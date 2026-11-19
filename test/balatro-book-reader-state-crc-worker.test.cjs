'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const api=require('../engines/iz2s-core/runtime/installer/engine/switch2/balatro/book-reader-state-crc-worker.cjs');
test('retained worker verifies actual 1024-byte original state CRC32',()=>{
 const code=api.SCRIPTS.start;
 assert.match(code,/local function crc32\(b\)/);
 assert.match(code,/3988292384/);
 assert.match(code,/u32\(b,181\)==1024/);
 assert.match(code,/crc32\(data\)==u32\(b,185\)/);
 assert.match(code,/#sh~=2048/);
 assert.match(code,/state-crc-verified:1/);
 assert.doesNotMatch(code,/worker:wait|worker:release|break\s*end|ffi|ro:dmnt|mapCode/);
});
test('stage requires bounded verified header and state, not arbitrary data',async()=>{
 await assert.rejects(()=>api.inspect('192.168.1.232','stage',{headerHex:'00'.repeat(512),stateHex:'ff'}),/1024-byte state/);
 const out=await api.inspect('192.168.1.232','stage',{
  headerHex:'ab'.repeat(512),stateHex:'cd'.repeat(1024),
  send:async options=>{
   assert.equal(options.timeoutMs,5000);
   assert.match(options.lua,/s.header="abab/);
   assert.match(options.lua,/s.stateHex="cdcd/);
   assert.ok(Buffer.byteLength(options.lua)<8192);
   return '-> IZ2S_BOOK_STATE_CRC_WORKER_V1;phase=header-staged';
  }
 });
 assert.equal(out.phase,'header-staged');
});
test('controller dispatch delivers staged bytes to title worker',()=>{
 const focus=fs.readFileSync(path.join(__dirname,'../engines/iz2s-core/runtime/installer/engine/switch2/balatro/canonical-focus.lua'),'utf8');
 assert.match(focus,/__IZ2S_BOOK_READER_STATE_CRC_WORKER_V1/);
 assert.match(focus,/s.input:push\("header:"\.\.s.header\.\.":"\.\.s.stateHex\)/);
 assert.match(focus,/app.bookReaderLaunchRequests==s.armedAt\+1/);
 const compact=focus.split('\n').map(x=>x.trim()).filter(x=>x&&!x.startsWith('--')).join('\n');
 assert.ok(Buffer.byteLength(compact)<8192);
});
test('successful CRC verified result does not claim native execution',()=>{
 const result=api.parse('-> IZ2S_BOOK_STATE_CRC_WORKER_V1;phase=worker-state-crc-verified');
 assert.equal(result.originalStateCrc32VerifiedInWorker,true);
 assert.equal(result.originalNativeSupervisorStarted,false);
 assert.equal(result.originalBookReaderExecuted,false);
 assert.equal(result.ready,false);
});

test('CRC worker routing is not overwritten by fallback to legacy controller bridge',()=>{
 const focus=fs.readFileSync(path.join(__dirname,'../engines/iz2s-core/runtime/installer/engine/switch2/balatro/canonical-focus.lua'),'utf8');
 assert.match(focus,/if not stateCrcMode and not headerMode then s=rawget\(_G,"__IZ2S_BOOK_READER_CONTROLLER_BRIDGE_V1"\) end/);
 assert.doesNotMatch(focus,/if not headerMode then s=rawget\(_G,"__IZ2S_BOOK_READER_CONTROLLER_BRIDGE_V1"\) end/);
});
