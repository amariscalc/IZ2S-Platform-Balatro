'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {LUA,parse,inspect}=require('../engines/iz2s-core/runtime/installer/engine/switch2/balatro/book-reader-launch-preflight.cjs');
const reply=(phase,id,kind)=>'-> IZ2S_BOOK_READER_SELECTION_V1;phase='+phase+';id='+id+';kind='+kind;
test('read-only probe observes actual Book Reader detail, never index alone',()=>{
 const result=parse(reply('detail','book-reader','source'));
 assert.equal(result.bookReaderSelected,true);
 assert.equal(result.catalogKind,'source');
 assert.doesNotMatch(LUA,/ffi|loadstring|love\.filesystem|love\.graphics|\.invoke\(|os\.execute/);
});
test('missing or other detail blocks without touching the native boundary',async()=>{
 let verified=false,boundary=false;
 for(const response of [reply('idle','none','none'),reply('detail','other','source')]){
  const out=await inspect('192.168.1.232',{packageFile:'fixture',
   send:async()=>response,verifyPackage:async()=>{verified=true;},
   makeBoundary:()=>{boundary=true;}});
  assert.equal(out.phase,'selection-not-book-reader');
 }
 assert.equal(verified,false);assert.equal(boundary,false);
});
test('Book Reader detail without original package cannot report readiness',async()=>{
 const r=await inspect('192.168.1.232',{send:async()=>reply('detail','book-reader','source')});
 assert.equal(r.phase,'package-not-supplied');assert.equal(r.ready,false);
});
test('original package is verified before read-only native boundary',async()=>{
 const calls=[];
 const r=await inspect('192.168.1.232',{packageFile:'fixture',expectedSha256:'a'.repeat(64),
  send:async input=>{calls.push('selection');assert.equal(input.lua,LUA);return reply('detail','book-reader','source');},
  verifyPackage:async(file,opts)=>{calls.push('verify');assert.equal(file,'fixture');
   assert.equal(opts.expectedSha256,'a'.repeat(64));
   return {phase:'package-verified',id:'book-reader',sourceFormat:'IZSDAPP1 native ABI2',
    packageSha256:'a'.repeat(64),packageBytes:2422612,companionAssets:[{}]};},
  makeBoundary:()=>({status:async()=>{calls.push('boundary');return {
   titleLuaAvailable:true,nativeRpcAvailable:false,executableMappingAvailable:false};}})});
 assert.deepEqual(calls,['selection','verify','boundary']);
 assert.equal(r.phase,'native-entry-blocked');assert.equal(r.packageVerified,true);
 assert.equal(r.originalApplicationExecuted,false);assert.equal(r.ready,false);
});
test('malformed or inconsistent selection is rejected',()=>{
 for(const r of ['bad',reply('detail','none','source'),reply('idle','book-reader','source'),
  reply('detail','book-reader','none')])assert.throws(()=>parse(r));
});

test('real controller A on Book Reader detail is an observable non-native launch request',()=>{
 const fs=require('node:fs'),path=require('node:path');
 const root=path.resolve(__dirname,'../engines/iz2s-core/runtime/installer/engine/switch2/balatro');
 const focus=fs.readFileSync(path.join(root,'canonical-focus.lua'),'utf8');
 const scene=fs.readFileSync(path.join(root,'canonical-visual-scene.lua'),'utf8');
 assert.match(focus,/app\.detail\.id=="book-reader"/);
 assert.match(focus,/app\.bookReaderLaunchRequests=math\.min/);
 assert.match(focus,/NATIVE LAUNCH NOT AVAILABLE/);
 assert.match(scene,/A  REQUEST BOOK READER/);
 assert.match(scene,/NATIVE START BLOCKED/);
 const observed=parse(reply('detail','book-reader','source')+';requests=1');
 assert.equal(observed.launchRequests,1);
 assert.equal(observed.bookReaderSelected,true);
 assert.throws(()=>parse(reply('detail','book-reader','source')+';requests=1000000000'));
});
