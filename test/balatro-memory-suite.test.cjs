'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {verify}=require('../engines/iz2s-core/runtime/installer/engine/switch2/balatro/memory-suite.cjs');
const life={backend:'balatro',state:'verified',allocationVerified:true,zeroed:true,nativeHeapFreeVerified:false};
const handles={backend:'balatro',state:'verified',boundsVerified:true,staleHandlesRejected:true,
 handleReuseRejected:true,zeroOnRelease:true,persistentHandles:false,nativeFreeVerified:false};
const copy={backend:'balatro',state:'verified',copyVerified:true,clearVerified:true,arbitraryMemoryAccessVerified:false};
test('all owned-memory checks succeed in order without native transport readiness',async()=>{
 const order=[];
 const r=await verify('192.168.1.232',{},
  async()=>{order.push('life');return life;},
  async()=>{order.push('handles');return handles;},
  async()=>{order.push('memcpy');return copy;});
 assert.deepEqual(order,['life','handles','memcpy']);
 assert.equal(r.phase,'scoped-memory-verified');
 assert.equal(r.handleBoundsVerified,true);
 assert.equal(r.nativeOwnedMemcpyVerified,true);
 assert.equal(r.arbitraryMemoryAccessVerified,false);
 assert.equal(r.ready,false);
});
test('lifecycle failure stops before handle allocation',async()=>{
 let touched=false;
 const r=await verify('127.0.0.1',{},async()=>({...life,zeroed:false}),
 async()=>{touched=true;return handles;},async()=>copy);
 assert.equal(r.blocker,'owned-lifecycle');assert.equal(touched,false);
});
test('handle guard failure stops before SDK memcpy',async()=>{
 let called=false;
 const r=await verify('127.0.0.1',{},async()=>life,
  async()=>({...handles,staleHandlesRejected:false}),
  async()=>{called=true;return copy;});
 assert.equal(r.blocker,'owned-handles');assert.equal(called,false);
});
test('native memcpy failure cannot report ready state',async()=>{
 const r=await verify('127.0.0.1',{},async()=>life,async()=>handles,
  async()=>({...copy,copyVerified:false}));
 assert.equal(r.blocker,'native-memcpy');
 assert.equal(r.nativeCoreReady,false);
 assert.equal(r.ready,false);
});
