'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {LUA,parse,inspect}=require('../engines/iz2s-core/runtime/installer/engine/switch2/balatro/native-ffi-provenance.cjs');
const valid='-> IZ2S_FFI_PROVENANCE_V1;declare:lua:file:1:10,describe:lua:file:1:18,invoke:lua:file:1:27,metatype:lua:file:1:39,native_ready:lua:file:1:44,u64_eq:lua:chunk:2:4,u64_is_zero:lua:chunk:2:9';
test('fixed names-only provenance without invoking or leaking source',()=>{
 assert.match(LUA,/debug\.getinfo/);
 assert.match(LUA,/pcall\(d,f\[name\],"S"\)/);
 assert.doesNotMatch(LUA,/debug\.getupvalue|loadstring|ffi\.invoke\(|ffi\.declare\(|ffi\.describe\(|ctx_restore\(|fiber_switch\(/);
 assert.ok(Buffer.byteLength(LUA)<=8192);
});
test('classifies source groups without absolute paths',()=>{
 const out=parse(valid);
 assert.equal(out.wrappers.invoke.sourceGroup,1);
 assert.equal(out.wrappers.u64_eq.sourceGroup,2);
 assert.equal(out.wrappers.invoke.lineDefined,27);
 assert.equal(out.sourcePathsExposed,false);
 assert.equal(out.ffiFunctionsCalled,false);
});
test('rejects malformed and reordered function records',()=>{
 assert.throws(()=>parse('-> IZ2S_FFI_PROVENANCE_V1;declare:lua:file:1:10'));
 assert.throws(()=>parse(valid.replace('invoke:lua','invoke:cfunction')));
 assert.throws(()=>parse(valid.replace('u64_eq:lua','u64_eq:lua:injected')));
});
test('single bounded RPC',async()=>{
 let calls=0;
 const out=await inspect('192.168.1.232',{send:async opts=>{calls++;assert.equal(opts.timeoutMs,5000);return valid;}});
 assert.equal(calls,1);
 assert.equal(out.ready,false);
});
