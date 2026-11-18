'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {LUA,parse,inspect}=require('../engines/iz2s-core/runtime/installer/engine/switch2/balatro/native-call-smoke.cjs');
test('parses a successful bounded SDK getter without implying core readiness',()=>{
 const r=parse('-> IZ2S_CALL_V1;state=called;detail=none;result=0');
 assert.equal(r.function,'sdk:sock_error');
 assert.equal(r.nativeFunctionCalled,true);
 assert.equal(r.nativeCallVerified,true);
 assert.equal(r.memoryTransportVerified,false);
 assert.equal(r.ready,false);
 assert.equal(parse('-> IZ2S_CALL_V1;state=called;detail=none;result=-2147483648').result,-2147483648);
 assert.equal(parse('-> IZ2S_CALL_V1;state=called;detail=none;result=2147483647').result,2147483647);
});
test('unknown SDK image fails closed before any call',()=>{
 for(const detail of ['missing_api','preflight_rejected','offset_unavailable','declare_rejected']){
  const r=parse('-> IZ2S_CALL_V1;state=blocked;detail='+detail);
  assert.equal(r.nativeFunctionCalled,false);
  assert.equal(r.nativeCallVerified,false);
  assert.equal(r.ready,false);
 }
 const failed=parse('-> IZ2S_CALL_V1;state=failed;detail=call_rejected');
 assert.equal(failed.nativeFunctionCalled,true);
 assert.equal(failed.nativeCallVerified,false);
});
test('rejects malformed and fabricated native successes',()=>{
 for(const raw of [
  'IZ2S_CALL_V1;state=called;detail=none;result=0',
  '-> IZ2S_CALL_V1;state=called;detail=none;result=2147483648',
  '-> IZ2S_CALL_V1;state=called;detail=none;result=-2147483649',
  '-> IZ2S_CALL_V1;state=called;detail=none;result=NaN',
  '-> IZ2S_CALL_V1;state=called;detail=none;result=1.5',
  '-> IZ2S_CALL_V1;state=called;detail=none;result=0;ready=true',
  '-> IZ2S_CALL_V1;state=failed;detail=missing_api'
 ])assert.throws(()=>parse(raw));
});
test('single native getter request is fixed, preflighted, never retried',async()=>{
 const calls=[];
 const r=await inspect('192.168.1.232',{},async options=>{
  calls.push(options);
  return '-> IZ2S_CALL_V1;state=called;detail=none;result=0';
 });
 assert.equal(r.nativeCallVerified,true);
 assert.equal(calls.length,1);
 assert.equal(calls[0].lua,LUA);
 assert.equal(calls[0].port,9026);
 assert.match(LUA,/bridge\.native_ready/);
 assert.match(LUA,/pcall\(bridge\.declare/);
 assert.match(LUA,/pcall\(fn\)/);
 assert.doesNotMatch(LUA,/ffi\.cast\([^\n]*\)\s*\(/);
});
