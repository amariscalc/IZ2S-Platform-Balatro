'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {LUA,parse,inspect}=require('../engines/iz2s-core/runtime/installer/engine/switch2/balatro/native-sdk-symbol-inventory.cjs');
test('names-only fixed read-only table inspection',()=>{
 assert.match(LUA,/package.loaded\["bl.app"\]/);
 assert.match(LUA,/table.sort\(keys\)/);
 assert.doesNotMatch(LUA,/native_ready\(|declare\(|getDirectoryItems|mount\(|write\(|read\(|require\(|loadstring|os.execute/);
 assert.ok(Buffer.byteLength(LUA)<=8192);
});
test('reported symbols are names not callable capabilities',()=>{
 const result=parse('-> IZ2S_SDK_KEYS_V1;off=memcpy,sock_error;offtotal=2;ffi=declare,native_ready;ffitotal=2');
 assert.deepEqual(result.sdkOffsetNames,['memcpy','sock_error']);
 assert.equal(result.serviceAccessVerified,false);
 assert.equal(result.pointerValuesExposed,false);
 assert.equal(result.ready,false);
});
test('rejects malicious or inconsistent payloads',()=>{
 assert.throws(()=>parse('-> IZ2S_SDK_KEYS_V1;off=memcpy;offtotal=0;ffi=none;ffitotal=0'));
 assert.throws(()=>parse('-> IZ2S_SDK_KEYS_V1;off=memcpy,memcpy;offtotal=2;ffi=none;ffitotal=0'));
 assert.throws(()=>parse('-> IZ2S_SDK_KEYS_V1;off=a;offtotal=1;ffi=ffi.inject;ffitotal=1'));
});
test('one bounded RPC request',async()=>{
 let n=0;
 const r=await inspect('192.168.1.232',{send:async options=>{
  n++;assert.equal(options.timeoutMs,5000);
  assert.equal(options.maxReplyBytes,4096);
  return '-> IZ2S_SDK_KEYS_V1;off=none;offtotal=0;ffi=none;ffitotal=0';
 }});
 assert.equal(n,1);assert.equal(r.originalLauncherReady,false);
});
