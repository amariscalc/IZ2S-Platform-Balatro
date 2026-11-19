'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {launch}=require('../engines/iz2s-core/runtime/installer/engine/switch2/balatro/canonical-orbit.cjs');
const state={phase:'running',view:'home',drawErrors:0,availablePackages:0,sourceCatalogEntries:6};
test('one-command boot stages presentation before genuine source index and art',async()=>{
 const order=[];
 const out=await launch('192.168.1.232',{
  focusExecute:async(_h,op)=>{order.push(op);return op==='start'?{phase:'running'}:state},
  publishCatalog:async()=>{order.push('catalog');return {state:'loaded',sourceCatalogEntries:6}},
  uploadArt:async()=>{order.push('art');return {loaded:12,skipped:0,results:[]}},
 });
 assert.deepEqual(order,['start','catalog','art','status']);
 assert.equal(out.sourceCatalogEntries,6);
 assert.equal(out.artwork.loaded,12);
 assert.equal(out.artwork.state,'uploaded');
 assert.equal(out.nativeCoreReady,false);
 assert.equal(out.ready,false);
});
test('unavailable Python art converter preserves the live menu and source catalog',async()=>{
 const out=await launch('192.168.1.232',{
  focusExecute:async(_h,op)=>op==='start'?{phase:'running'}:state,
  publishCatalog:async()=>({state:'loaded'}),
  uploadArt:async()=>{throw Error('Pillow not available')},
 });
 assert.equal(out.artwork.state,'unavailable');
 assert.match(out.artwork.error,/Pillow/);
 assert.equal(out.phase,'running');
 assert.equal(out.sourceCatalogEntries,6);
});
test('blocked frontend cannot publish previews or images',async()=>{
 let called=false;
 const out=await launch('192.168.1.232',{
  focusExecute:async()=>({phase:'blocked'}),
  publishCatalog:async()=>{called=true},
  uploadArt:async()=>{called=true},
 });
 assert.equal(called,false);
 assert.equal(out.ready,false);
 assert.equal(out.started.phase,'blocked');
});
