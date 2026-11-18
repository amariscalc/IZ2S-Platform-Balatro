'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {REQUIREMENTS,inspect}=require('../engines/iz2s-core/runtime/installer/engine/switch2/balatro/compatibility.cjs');
const root=path.join(__dirname,'../engines/iz2s-core/runtime/installer/engine');
test('every requirement is explicit and has a source module',()=>{
 assert.equal(REQUIREMENTS.length,9);
 for(const item of REQUIREMENTS){
  assert.ok(item.id&&item.detail);
  assert.ok(fs.existsSync(path.join(root,item.source)));
 }
});
test('native transport operation names exist in source',()=>{
 const code=fs.readFileSync(path.join(root,'switch2/app/rpc.cjs'),'utf8');
 for(const operation of ['call3','call4','read','write','query','verifyFunction','store64','batch'])
  assert.match(code,new RegExp('\\b'+operation+'\\b'));
});
test('core startup dependencies exist and remain unverified',()=>{
 const core=fs.readFileSync(path.join(root,'switch2/ro/start-core.cjs'),'utf8');
 for(const token of ['pm:shell','pm:dmnt','current-acquisition.json','-notifier-proof.json','root-native-info'])
  assert.ok(core.includes(token),'Missing expected source marker: '+token);
 const response=inspect({native_declare:true,native_invoke:true,sdk_base_present:true});
 assert.equal(response.ffiInterfaceReported,true);
 assert.equal(response.ready,false);
 assert.equal(response.nativeOperationsVerified,false);
 assert.equal(response.privilegedSessionVerified,false);
 assert.ok(response.requirements.some(x=>x.status==='unverified'));
});
test('invalid capabilities are rejected',()=>{
 for(const value of [null,7,[],false])assert.throws(()=>inspect(value),/Expected/);
});
