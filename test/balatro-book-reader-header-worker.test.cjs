'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const root='../engines/iz2s-core/runtime/installer/engine/switch2/balatro/';
const api=require(root+'book-reader-header-worker.cjs');
test('new persistent worker validates actual 512-byte header not a static token',()=>{
 const source=api.SCRIPTS.start;
 assert.match(source,/msg:sub\(1,7\)=="header:"/);
 assert.match(source,/#hex~=1024/);
 assert.match(source,/u32\(b,9\)==2/);
 assert.match(source,/id=="book-reader"/);
 assert.match(source,/header-verified:1/);
 assert.doesNotMatch(source,/worker:wait|worker:release|break\s*end|ffi|svc|ro:dmnt/);
});
test('verified header is staged before arming and button A pushes it',()=>{
 assert.match(api.STAGE_TEMPLATE,/s.header="__HEADER_HEX__"/);
 assert.match(api.SCRIPTS.arm,/header-not-staged/);
 const focus=fs.readFileSync(path.join(__dirname,root,'canonical-focus.lua'),'utf8');
 assert.match(focus,/__IZ2S_BOOK_READER_HEADER_WORKER_V1/);
 assert.match(focus,/s.input:push\("header:"\.\.s.header\)/);
 assert.match(focus,/app.bookReaderLaunchRequests==s.armedAt\+1/);
 const compact=focus.split('\n').map(x=>x.trim()).filter(x=>x&&!x.startsWith('--')).join('\n');
 assert.ok(Buffer.byteLength(compact)<=8192);
});
test('stage demands verified header data and bounds RPC',async()=>{
 await assert.rejects(()=>api.inspect('192.168.1.232','stage',{headerHex:'abc',send:async()=>{throw Error('should not send')}}),/512-byte header/);
 const result=await api.inspect('192.168.1.232','stage',{headerHex:'00'.repeat(512),send:async opts=>{
  assert.match(opts.lua,/s.header="0000/);
  assert.equal(opts.timeoutMs,5000);
  return '-> IZ2S_BOOK_HEADER_WORKER_V1;phase=header-staged';
 }});
 assert.equal(result.phase,'header-staged');
 assert.equal(result.ready,false);
});

test('worker validates 12 ABI2 ranges, alignment and overlap without executable mapping',()=>{
 const script=api.SCRIPTS.start;
 assert.match(script,/for i=0,11 do/);
 assert.match(script,/pos=177\+i\*16/);
 assert.match(script,/off>=ends and off%4==0/);
 assert.match(script,/len<=total-off/);
 assert.match(script,/reserved==0/);
 assert.match(script,/lengths\[1\]==1024/);
 assert.match(script,/lengths\[9\]==131072/);
 assert.match(script,/lengths\[11\]>=4/);
 assert.match(script,/lengths\[12\]<=nativeDataBytes/);
 assert.doesNotMatch(script,/worker:wait|worker:release|ro:dmnt|loadstring|ffi|mapCode/);
});
