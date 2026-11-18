'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {KEY,OPS,TEMPLATE,script,parse,execute}=require('../engines/iz2s-core/runtime/installer/engine/switch2/balatro/owned-registry.cjs');
function reply(op,state='ok',detail='none',value=0){
 return `-> IZ2S_REG_V1;op=${op};state=${state};detail=${detail};value=${value}`;
}
test('scripts use a fixed Lua template and numeric bounded values',()=>{
 assert.ok(OPS.includes('alloc'));
 assert.equal(KEY,'__IZ2S_OWNED_REGISTRY_V1');
 assert.match(script('write',[1,2,3]),/local OP="write"/);
 assert.match(script('write',[1,2,3]),/local A=1/);
 assert.match(script('write',[1,2,3]),/local B=2/);
 assert.match(script('write',[1,2,3]),/local C=3/);
 assert.throws(()=>script('write',[1,-1,3]));
 assert.throws(()=>script('write',[1,1.1,3]));
 assert.throws(()=>script('write',[1,2,3,4,5]));
 assert.throws(()=>script('arbitrary',[1]));
 assert.doesNotMatch(script('alloc',[8]),/ffi\.cast\s*\(/);
});
test('strict parser distinguishes success from blocked and stale handles',()=>{
 assert.equal(parse(reply('init','ok','initialized',0),'init').state,'ok');
 assert.equal(parse(reply('alloc','ok','none',2),'alloc').value,2);
 assert.equal(parse(reply('read','blocked','stale_handle',0),'read').detail,'stale_handle');
 assert.equal(parse(reply('copy','blocked','overlap_refused',0),'copy').state,'blocked');
});
test('forged state, duplicate fields, unrecognized operations and values fail',()=>{
 for(const r of [
  reply('read','ok','none',3)+';nativeReady=true',
  reply('read','blocked','none',0),
  reply('read','ok','initialized',0),
  reply('init','ok','none',0),
  reply('init','ok','initialized',5),
  reply('read','blocked','bounds',1),
  reply('read','blocked','privileged',0),
  'IZ2S_REG_V1;op=read;state=ok;detail=none;value=1'
 ])assert.throws(()=>parse(r,'read'));
 assert.throws(()=>parse(reply('status'),'read'));
});
test('RPC transmits fixed operation and never exposes a pointer',async()=>{
 let calls=0;
 const r=await execute('192.168.1.232','alloc',[16],{},async q=>{
  calls++;assert.equal(q.port,9026);
  assert.equal(q.lua,script('alloc',[16]));
  return reply('alloc','ok','none',8);
 });
 assert.equal(calls,1);
 assert.equal(r.value,8);
 assert.equal(r.ready,false);
});

test('Lua error classifier uses plain recognized labels and no regex alternation',()=>{
 const lua=fs.readFileSync(path.join(__dirname,
  '../engines/iz2s-core/runtime/installer/engine/switch2/balatro/owned-registry.lua'),'utf8');
 assert.doesNotMatch(lua,/match\("\(quota\|/);
 assert.match(lua,/message:match\("\(\[%a_\]\+\)\$"\)/);
 assert.match(lua,/if tail==label then return reply\("blocked",label,0\) end/);
});

test('default status without arguments is a valid fixed template',()=>{
 const source=script('status',[]);
 assert.equal(source,TEMPLATE);
 assert.match(source,/local OP="status"/);
 assert.match(source,/local A=0/);
});
