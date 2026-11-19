'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {LUA,parse,WRAPPERS}=require('../engines/iz2s-core/runtime/installer/engine/switch2/balatro/native-ffi-upvalue-shapes.cjs');
const sample='-> IZ2S_FFI_SHAPES_V2;types='+WRAPPERS.map((name,i)=>name+':'+(i===0?'table,table,userdata,table,absent':i===1?'absent,table,userdata,table,function':'absent,absent,absent,absent,function')).join(';')+';shared=same';
test('fixed read-only inventory cannot leak values or invoke native functions',()=>{
 assert.match(LUA,/debug\.getupvalue/);
 assert.match(LUA,/type\(captures\[key\]\)/);
 assert.doesNotMatch(LUA,/ffi\.invoke\(|ffi\.declare\(|debug\.setupvalue|loadstring|os\.execute|fiber_switch\(/);
 assert.ok(Buffer.byteLength(LUA)<=8192);
});
test('typed dependency records in fixed order',()=>{
 const out=parse(sample);
 assert.equal(out.wrappers.invoke.victim,'userdata');
 assert.equal(out.sharedFfiCallIdentity,'same');
 assert.equal(out.upvalueValuesExposed,false);
 assert.equal(out.ready,false);
});
test('rejects malformed order, types and extra fields',()=>{
 assert.throws(()=>parse(sample.replace('invoke:', 'declare:')));
 assert.throws(()=>parse(sample.replace('userdata','pointer')));
 assert.throws(()=>parse(sample.replace('shared=same','shared=true')));
});
