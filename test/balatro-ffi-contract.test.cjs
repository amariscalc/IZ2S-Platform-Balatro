'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {MAX_PARAMS,SIGNATURE,SUPPORTED_TYPES,validateDeclaration,assessProfile}
 =require('../engines/iz2s-core/runtime/installer/engine/switch2/balatro/ffi-contract.cjs');
const PROFILE={
 backend:'balatro',mode:'read-only-ffi-profile',
 declare:{implementation:'Lua',parameters:3,varargs:false},
 invoke:{implementation:'Lua',parameters:1,varargs:true},
};
const DECLARATION={returnType:'u32',argumentTypes:['pointer','u64'],address:'sdk:example'};
test('symbolic FFI declaration is copied and validated without invocation',()=>{
 const out=validateDeclaration(DECLARATION);
 assert.deepEqual(out,DECLARATION);
 assert.equal(Object.isFrozen(out.argumentTypes),true);
 assert.deepEqual(SIGNATURE.declare,['returnType','argumentTypes','address']);
 assert.ok(SUPPORTED_TYPES.includes('pointer'));
 assert.equal(MAX_PARAMS,8);
});
test('invalid types, raw pointers and oversized argument lists are rejected',()=>{
 for(const input of [
  {...DECLARATION,address:0x1234},
  {...DECLARATION,address:'0x1234'},
  {...DECLARATION,address:'sdk:../bad'},
  {...DECLARATION,returnType:'any'},
  {...DECLARATION,argumentTypes:['void']},
  {...DECLARATION,argumentTypes:Array(9).fill('i32')},
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
