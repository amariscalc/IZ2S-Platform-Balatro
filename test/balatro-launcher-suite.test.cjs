'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {run}=require('../engines/iz2s-core/runtime/installer/engine/switch2/balatro/launcher-suite.cjs');
const idle={backend:'balatro',launcher:'idle',legacy:'idle',ownedBuffers:0,ownedBytes:0,ready:false};
const navigation={phase:'verified',nativeCoreLaunched:false,pagesVerified:['dashboard','rpc','memory','native','about']};
test('grouped suite combines telemetry, menu navigation, cleanup and native gap',async()=>{
 const order=[];
 const r=await run('192.168.1.232',{},async()=>{order.push('telemetry');return idle;},
  async()=>{order.push('navigation');return navigation;});
 assert.deepEqual(order,['telemetry','navigation','telemetry']);
 assert.equal(r.phase,'verified');
 assert.equal(r.readiness.stagesBlocked,7);
 assert.equal(r.visualRenderingObserved,false);
 assert.equal(r.controllerEventsObserved,false);
 assert.equal(r.nativeCoreReady,false);
 assert.equal(r.ready,false);
});
test('legacy or launcher ownership conflict prevents any UI changes',async()=>{
 for(const state of [{...idle,legacy:'active'},{...idle,launcher:'active'}]){
  let called=false;
  const r=await run('192.168.1.232',{},async()=>state,
   async()=>{called=true;return navigation;});
  assert.equal(r.blocker,'existing-frontend');
  assert.equal(r.ready,false);assert.equal(called,false);
 }
});
test('failed cleanup is never reported as verified',async()=>{
 let i=0;
 await assert.rejects(run('192.168.1.232',{},
  async()=>++i===1?idle:{...idle,launcher:'active'},
  async()=>navigation),/remained active/);
});
test('navigation cannot imply native readiness',async()=>{
 await assert.rejects(run('192.168.1.232',{},async()=>idle,
  async()=>({...navigation,nativeCoreLaunched:true})),/did not finish safely/);
});
