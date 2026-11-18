'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {LUA,parse,inspect}=require('../engines/iz2s-core/runtime/installer/engine/switch2/balatro/launcher-telemetry.cjs');
test('read-only dashboard captures state without claiming native readiness',()=>{
 const r=parse('-> IZ2S_DASH_V1;state=ok;legacy=idle;launcher=active;ffi=true;buffers=2;bytes=32');
 assert.equal(r.ownedBuffers,2);assert.equal(r.ownedBytes,32);
 assert.equal(r.launcher,'active');assert.equal(r.legacy,'idle');
 assert.equal(r.ffiPresent,true);assert.equal(r.ready,false);
 assert.equal(r.nativeCoreReady,false);
});
test('rejects untrusted telemetry claims and inconsistent bytes',()=>{
 for(const raw of [
  'IZ2S_DASH_V1;state=ok;legacy=idle;launcher=active;ffi=true;buffers=2;bytes=32',
  '-> IZ2S_DASH_V1;state=ok;legacy=idle;launcher=active;ffi=true;buffers=0;bytes=12',
  '-> IZ2S_DASH_V1;state=ok;legacy=idle;launcher=active;ffi=true;buffers=4;bytes=513',
  '-> IZ2S_DASH_V1;state=ok;legacy=idle;launcher=active;ffi=true;buffers=2;bytes=32;nativeReady=true',
  '-> IZ2S_DASH_V1;state=invalid',
 ])assert.throws(()=>parse(raw));
});
test('one fixed RPC reads only title-owned globals',async()=>{
 const requests=[];
 const r=await inspect('192.168.1.232',{},async q=>{
  requests.push(q);
  return '-> IZ2S_DASH_V1;state=ok;legacy=idle;launcher=idle;ffi=true;buffers=0;bytes=0';
 });
 assert.equal(r.ready,false);
 assert.equal(requests.length,1);
 assert.equal(requests[0].port,9026);
 assert.equal(requests[0].lua,LUA);
 assert.doesNotMatch(LUA,/ffi\.cast|ffi\.new|ffi\.copy|b\.declare|openService/);
});
