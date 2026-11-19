'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {create}=require('../engines/iz2s-core/runtime/installer/engine/switch2/balatro/book-reader-native-request-dispatcher.cjs');
const sha='a'.repeat(64);
const request=n=>({consoleSelection:{bookReaderSelected:true,selectedId:'book-reader',launchRequests:n},
 packageVerified:true,originalNativeSessionReady:false,originalApplicationExecuted:false});
function fixture({values=[request(3),request(3),request(4)],launch=async()=>({phase:'native-app-running',executedOnConsole:true,ready:true}),owner=true}={}){
 let i=0,calls=0,ownership=0;
 const args={host:'192.168.1.232',packageFile:'launcher.iza',expectedSha256:sha,
  supervisor:owner?{status(){},holdMenu(){},command(){}}:null,
  storage:owner?{filesystem:true,writableMounts:['sd'],read(){},openRead(){},openWrite(){}}:null,
  assertOwned:(s,d)=>{ownership++;if(!s||!d)throw Error('Native owner missing');},
  inspect:async()=>values[Math.min(i++,values.length-1)],
  launch:async(...v)=>{calls++;return launch(...v);}};
 return {args,get calls(){return calls;},get ownership(){return ownership;}};
}
test('one fresh controller request triggers exact native installAndLaunch once',async()=>{
 const f=fixture();
 const d=await create(f.args);
 assert.equal(d.baselineRequestCount,3);
 assert.equal((await d.poll()).phase,'armed');
 const r=await d.poll();
 assert.equal(r.phase,'completed');assert.equal(r.ready,true);
 assert.equal(f.calls,1);
 assert.equal((await d.poll()).phase,'completed');
 assert.equal(f.calls,1);
});
test('old request at arming is never executed',async()=>{
 const f=fixture({values:[request(1),request(1),request(1)]});
 const d=await create(f.args);assert.equal((await d.poll()).phase,'armed');
 assert.equal((await d.poll()).phase,'armed');assert.equal(f.calls,0);
});
test('missing owned native resources fail before title-side polling',async()=>{
 const f=fixture({owner:false});
 await assert.rejects(()=>create(f.args),/Native owner missing/);
 assert.equal(f.calls,0);
});
test('skipped requests, title reset or lost selection fail closed',async()=>{
 for(const values of [[request(1),request(3)],[request(3),request(0)],
  [request(1),{...request(2),consoleSelection:{...request(2).consoleSelection,bookReaderSelected:false}}]]){
  const f=fixture({values});const d=await create(f.args);const r=await d.poll();
  assert.equal(r.phase,'closed');assert.equal(f.calls,0);
 }
});
test('native error is latched and never automatically retried',async()=>{
 const f=fixture({values:[request(0),request(1)],launch:async()=>{throw Error('lease uncertain');}});
 const d=await create(f.args);const r=await d.poll();
 assert.equal(r.phase,'failed');assert.equal(r.executionUnverified,true);
 assert.equal((await d.poll()).phase,'failed');assert.equal(f.calls,1);
});

test('parallel polls cannot execute the same native request twice',async()=>{
 let inspectCall=0,launches=0;
 const pending=[];
 const args={host:'192.168.1.232',packageFile:'launcher.iza',expectedSha256:sha,
  supervisor:{},storage:{},assertOwned:()=>{},
  inspect:async()=>{
   inspectCall++;
   if(inspectCall===1)return request(5);
   return new Promise(resolve=>pending.push(resolve));
  },
  launch:async()=>{launches++;return {phase:'native-app-running',executedOnConsole:true,ready:true};}
 };
 const d=await create(args);
 const a=d.poll(),b=d.poll();
 assert.equal(pending.length,1,'only one in-flight console observation');
 pending[0](request(6));
 const [r1,r2]=await Promise.all([a,b]);
 assert.equal(r1.phase,'completed');assert.equal(r2.phase,'completed');
 assert.equal(launches,1);
});
