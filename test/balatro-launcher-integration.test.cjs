'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {PAGES,run}=require('../engines/iz2s-core/runtime/installer/engine/switch2/balatro/launcher-integration.cjs');
function simulation(initial=false){
 let app=initial?{menu:1,page:'home'}:null;
 const calls=[];
 const send=async(host,op)=>{
  calls.push(op);
  if(op==='start'&&!app)app={menu:1,page:'home'};
  if(op==='stop')app=null;
  if(app&&op==='down'){if(app.page==='home')app.menu=app.menu%6+1;else app.page='home';}
  if(app&&op==='up'){if(app.page==='home')app.menu=(app.menu+4)%6+1;else app.page='home';}
  if(app&&op==='back'){if(app.page==='home')app=null;else app.page='home';}
  if(app&&op==='select'){
   if(app.page!=='home')app.page='home';
   else if(app.menu===6)app=null;
   else app.page=PAGES[app.menu-1];
  }
  return {phase:app?'running':'idle',menu:app?app.menu:0,page:app?app.page:'none',
   overlay:!!app,controls:!!app,ready:false};
 };
 return {send,calls};
}
test('launcher walks all pages, verifies navigation wraps and exits cleanly',async()=>{
 const {send,calls}=simulation();
 const report=await run('192.168.1.232',{},send);
 assert.equal(report.phase,'verified');
 assert.deepEqual(report.pagesVerified,PAGES);
 assert.equal(report.cleanupVerified,true);
 assert.equal(report.nativeCoreLaunched,false);
 assert.equal(report.ready,false);
 assert.equal(calls.at(-1),'select');
 assert.equal(report.checks,calls.length);
});
test('already running launcher is left untouched',async()=>{
 const {send,calls}=simulation(true);
 await assert.rejects(run('192.168.1.232',{},send),/Existing IZ2S frontend/);
 assert.deepEqual(calls,['status']);
});
test('failed navigation cleans up its own frontend',async()=>{
 const {send,calls}=simulation();
 await assert.rejects(run('192.168.1.232',{},async(host,op,opts)=>{
  const r=await send(host,op,opts);
  if(op==='select')return {...r,page:'bad'};
  return r;
 }),/Page dashboard/);
 assert.equal(calls.at(-1),'stop');
});
