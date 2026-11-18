'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {MAX_PARAMS,MAX_INTEGER_ARGS,MAX_FLOAT_ARGS,SIGNATURE,SUPPORTED_TYPES,validateDeclaration,assessProfile}
 =require('../engines/iz2s-core/runtime/installer/engine/switch2/balatro/ffi-contract.cjs');
const PROFILE={
 backend:'balatro',mode:'read-only-ffi-profile',
 declare:{implementation:'Lua',parameters:3,varargs:false},
 invoke:{implementation:'Lua',parameters:1,varargs:true},
};
const DECLARATION={returnType:'u32',argumentTypes:['pointer','u64'],address:'sdk:example'};
test('symbolic FFI declaration is copied and validated without invocation',()=>{
 const out=validateDeclaration(DECLARATION);
 assert.deepEqual(out.returnType,DECLARATION.returnType);
 assert.deepEqual(out.argumentTypes,DECLARATION.argumentTypes);
 assert.equal(out.address,DECLARATION.address);
 assert.equal(out.ffiReturnType,'uint32_t');
 assert.deepEqual(out.ffiArgumentTypes,['void *','uint64_t']);
 assert.deepEqual(out.registers,{integer:2,floating:0});
 assert.equal(Object.isFrozen(out.argumentTypes),true);
 assert.deepEqual(SIGNATURE.declare,['returnType','argumentTypes','address']);
 assert.ok(SUPPORTED_TYPES.includes('pointer'));
 assert.ok(SUPPORTED_TYPES.includes('const char *'));
 assert.equal(validateDeclaration({returnType:'double',argumentTypes:['float','size_t'],address:'sdk:example'}).ffiArgumentTypes[0],'float');
 assert.equal(MAX_PARAMS,16);
 assert.equal(MAX_INTEGER_ARGS,8);
 assert.equal(MAX_FLOAT_ARGS,8);
 const mixed=validateDeclaration({...DECLARATION,argumentTypes:[...Array(8).fill('u64'),...Array(8).fill('f64')]});
 assert.equal(mixed.argumentTypes.length,16);
 assert.deepEqual(mixed.registers,{integer:8,floating:8});
});
test('invalid types, raw pointers and oversized argument lists are rejected',()=>{
 for(const input of [
  {...DECLARATION,address:0x1234},
  {...DECLARATION,address:'0x1234'},
  {...DECLARATION,address:'sdk:../bad'},
  {...DECLARATION,returnType:'any'},
  {...DECLARATION,returnType:'struct MyStruct'},
  {...DECLARATION,argumentTypes:['...']},
  {...DECLARATION,argumentTypes:['long double']},
  {...DECLARATION,argumentTypes:['void']},
  {...DECLARATION,argumentTypes:Array(9).fill('i32')},
  {...DECLARATION,argumentTypes:Array(9).fill('f64')},
  {...DECLARATION,argumentTypes:Array(17).fill('i32')},
  {...DECLARATION,extra:true},
  null,
 ])assert.throws(()=>validateDeclaration(input));
});
test('matching Lua wrapper arity only permits planning, never execution',()=>{
 const result=assessProfile(PROFILE,DECLARATION);
 assert.equal(result.observedSignatureMatches,true);
 assert.equal(result.executionAttempted,false);
 assert.equal(result.declarationTypeVocabularyVerified,false);
 assert.equal(result.invocationVerified,false);
 assert.equal(result.nativeCoreReady,false);
 assert.equal(result.ready,false);
});
test('different wrapper signature is rejected as a compatibility assumption',()=>{
 const result=assessProfile({...PROFILE,invoke:{implementation:'C',parameters:0,varargs:true}},DECLARATION);
 assert.equal(result.observedSignatureMatches,false);
 assert.equal(result.ready,false);
});
test('rejects malformed or substituted profiles',()=>{
 assert.throws(()=>assessProfile({backend:'other',mode:'read-only-ffi-profile'},DECLARATION));
 assert.throws(()=>assessProfile({backend:'balatro',mode:'read-only-ffi-profile'},DECLARATION));
});
