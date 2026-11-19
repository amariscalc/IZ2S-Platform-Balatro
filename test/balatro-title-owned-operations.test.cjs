'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {LUA,parse,inspect}=require('../engines/iz2s-core/runtime/installer/engine/switch2/balatro/title-owned-operations.cjs');
test('uses fixed private VFS marker and bounded title-local worker',()=>{
 assert.match(LUA,/iz2s-book-reader-title-vfs-probe.txt/);
 assert.match(LUA,/fs.remove\(name\)/);
 assert.match(LUA,/worker:wait\(\)/);
 assert.doesNotMatch(LUA,/ro:dmnt|svc|mapCode|ffi\.call/);
});
test('parses verified native-title operations without granting supervisor',()=>{
 const r=parse('-> IZ2S_BALATRO_TITLE_OPS_V1;vfs=verified;worker=verified\n');
 assert.equal(r.filesystem.titlePrivateVfsRoundtrip,'verified');
 assert.equal(r.threading.loveWorkerLifecycle,'verified');
 assert.equal(r.nativeSdFilesystemVerified,false);
 assert.equal(r.originalSupervisorThreadVerified,false);
 assert.equal(r.ready,false);
});
test('unsupported operations remain explicit',()=>{
 const r=parse('-> IZ2S_BALATRO_TITLE_OPS_V1;vfs=unsupported;worker=unsupported');
 assert.equal(r.filesystem.titlePrivateVfsRoundtrip,'unsupported');
 assert.equal(r.threading.loveWorkerLifecycle,'unsupported');
});
test('malformed responses fail closed',()=>{
 for(const s of ['', '-> IZ2S_BALATRO_TITLE_OPS_V1;vfs=verified;worker=success',
 '-> IZ2S_BALATRO_TITLE_OPS_V1;vfs=verified'])assert.throws(()=>parse(s));
});
test('sends one hardware request; never retries',async()=>{
 let count=0;
 const r=await inspect('192.168.1.232',{send:async opts=>{
  count++;assert.equal(opts.timeoutMs,7000);
  return '-> IZ2S_BALATRO_TITLE_OPS_V1;vfs=verified;worker=unsupported';
 }});
 assert.equal(count,1);assert.equal(r.threading.loveWorkerLifecycle,'unsupported');
});

test('thread failure returns the precise phase instead of an undifferentiated error',()=>{
 for(const phase of ['create-error','start-error','wait-error','get-error-error']){
  const result=parse('-> IZ2S_BALATRO_TITLE_OPS_V1;vfs=verified;worker='+phase);
  assert.equal(result.threading.loveWorkerLifecycle,phase);
  assert.equal(result.originalSupervisorThreadVerified,false);
 }
 assert.match(LUA,/origin="start"/);
 assert.match(LUA,/origin="wait"/);
 assert.match(LUA,/origin="get-error"/);
});
