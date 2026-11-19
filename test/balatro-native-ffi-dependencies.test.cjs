'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {NAMES,LUA,parse,inspect}=require('../engines/iz2s-core/runtime/installer/engine/switch2/balatro/native-ffi-dependencies.cjs');
const valid='-> IZ2S_FFI_UPVALUES_V1;invoke:call._ENV;declare:call;describe:call;metatype:none;native_ready:available;u64_eq:none;u64_is_zero:none';
test('bounded names-only upvalue inspection with no invocation or value leakage',()=>{
 assert.match(LUA,/debug\.getupvalue/);
 assert.match(LUA,/for i=1,24 do/);
 assert.doesNotMatch(LUA,/debug\.setupvalue|debug\.getlocal|loadstring|ffi\.invoke\(|ffi\.declare\(|fiber_switch\(|ctx_restore\(|f\.mount\(/);
 assert.ok(Buffer.byteLength(LUA)<=8192);
});
test('preserves wrapper name ordering and refuses malformed dependency data',()=>{
 const out=parse(valid);
 assert.deepEqual(out.dependencies.invoke.names,['call','_ENV']);
 assert.equal(out.upvalueValuesExposed,false);
 assert.equal(out.ffiFunctionsCalled,false);
 assert.throws(()=>parse(valid.replace('declare:call','declare:call;declare:call')));
 assert.throws(()=>parse(valid.replace('invoke:call._ENV','invoke:call/evil')));
});
test('one bounded RPC',async()=>{
 let calls=0;
 const out=await inspect('192.168.1.232',{send:async opts=>{calls++;assert.equal(opts.timeoutMs,5000);assert.equal(opts.maxReplyBytes,4096);return valid;}});
 assert.equal(calls,1);
 assert.equal(Object.keys(out.dependencies).length,NAMES.length);
});
