'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {validate}=require('../engines/iz2s-core/runtime/installer/engine/switch2/balatro/native-validation.cjs');
const stage={backend:'balatro',phase:'declared-only',ready:false,nativeFunctionCalled:false};
const owned={backend:'balatro',state:'verified',readWriteVerified:true,clearVerified:true,
 arbitraryMemoryAccessVerified:false};
const native={backend:'balatro',state:'called',function:'sdk:sock_error',
 nativeCallVerified:true,nativeCoreReady:false};
test('validates all steps in order without claiming core loader readiness',async()=>{
 const order=[];
 const r=await validate('192.168.1.232',{},
  async()=>{order.push('stage');return stage;},
  async()=>{order.push('call');return native;},
  async()=>{order.push('buffer');return owned;});
 assert.deepEqual(order,['stage','buffer','call']);
 assert.equal(r.phase,'limited-userland-verified');
 assert.equal(r.functionCallVerified,true);
 assert.equal(r.ownedMemoryVerified,true);
 assert.equal(r.ipcVerified,false);
 assert.equal(r.nativeCoreReady,false);
 assert.equal(r.ready,false);
});
test('staging failure prevents any other probe',async()=>{
 const order=[];
 const r=await validate('127.0.0.1',{},
  async()=>({...stage,phase:'blocked'}),
  async()=>{order.push('call');return native;},
  async()=>{order.push('buffer');return owned;});
 assert.equal(r.blocker,'native-staging');
 assert.deepEqual(order,[]);
});
test('owned-buffer failure prevents native function call',async()=>{
 let invoked=false;
 const r=await validate('127.0.0.1',{},
  async()=>stage,
  async()=>{invoked=true;return native;},
  async()=>({...owned,clearVerified:false}));
 assert.equal(r.blocker,'owned-buffer');
 assert.equal(invoked,false);
});
test('invalid getter response never upgrades verified readiness',async()=>{
 const r=await validate('127.0.0.1',{},
  async()=>stage,
  async()=>({...native,function:'sdk:unknown'}),
  async()=>owned);
 assert.equal(r.blocker,'native-getter');
 assert.equal(r.functionCallVerified,false);
 assert.equal(r.nativeCoreReady,false);
 assert.equal(r.ready,false);
});
