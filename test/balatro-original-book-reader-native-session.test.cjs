'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),crypto=require('node:crypto'),Module=require('node:module');
const load=Module._load;
Module._load=function(name){
 if(name.endsWith('/core/console/sd-launcher/install.cjs'))return {installBytes:()=>{throw Error('inject installBytes')}};
 if(name.endsWith('/core/console/sd-launcher/package.cjs'))return {decode:()=>{throw Error('inject decode')}};
 if(name==='./original-book-reader-handoff.cjs')return {verify:()=>{throw Error('inject verify')}};
 return load.apply(this,arguments);
};
const api=require('../engines/iz2s-core/runtime/installer/engine/switch2/balatro/original-book-reader-native-session.cjs');
Module._load=load;
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const menu=(more={})=>({state:2,active:0,poisoned:0,catalogStable:true,auto_scan_error:0,native_launches:0,applications:[],...more});
test('Balatro RPC alone is insufficient',async()=>{
 await assert.rejects(api.install('fixture',{supervisor:{status(){}}}),/Native IZ2S supervisor/);
 await assert.rejects(api.launch({supervisor:{status(){}}}),/Native IZ2S supervisor/);
});
test('canonical owned SD install verifies hash, reads back, releases lease',async()=>{
 const bytes=Buffer.from('fixture native Book Reader image');let released=false;
 const supervisor={status:async()=>menu(),command:async()=>{},holdMenu:async()=>({active:true,release:async()=>{released=true;}})};
 const storage={writableMounts:['sd'],filesystem:{},uncertain:false,read(){},openRead(){},openWrite(){}};
 const result=await api.install('fixture',{supervisor,storage,
  verifyArtifact:async()=>({phase:'package-verified',id:'book-reader',sourceFormat:'IZSDAPP1 native ABI2',packageFile:'fixture',packageBytes:bytes.length,packageSha256:sha(bytes),companionAssets:[]}),
  readFile:async()=>bytes,decode:()=>({id:'book-reader',native:true}),
  installBytes:async()=>({id:'book-reader',readbackVerified:true,sha256:sha(bytes),headerCrc:123,assets:[]})});
 assert.equal(released,true);assert.equal(result.headerCrc,123);assert.equal(result.executedOnConsole,false);
});
test('native launch only after verified tile and real launch counter',async()=>{
 let count=0,cmd;
 const supervisor={status:async()=>++count===1?menu({applications:[{id:'book-reader',source:'sd',headerCrc:123}]}):menu({native_launches:1,last_id:'book-reader',active:1}),command:async n=>{cmd=n;}};
 const result=await api.launch({supervisor,headerCrc:123,checks:2,pause:async()=>{}});
 assert.equal(cmd,1);assert.equal(result.phase,'native-app-running');
});
test('missing tile blocks launch',async()=>{
 let invoked=false;const supervisor={status:async()=>menu(),command:async()=>{invoked=true;}};
 await assert.rejects(api.launch({supervisor,headerCrc:123}),/not verified/);assert.equal(invoked,false);
});
test('unconfirmed launch is never reported as success',async()=>{
 const supervisor={status:async()=>menu({applications:[{id:'book-reader',source:'sd',headerCrc:123}]}),command:async()=>{}};
 const result=await api.launch({supervisor,headerCrc:123,checks:2,pause:async()=>{}});
 assert.equal(result.phase,'native-launch-unconfirmed');assert.equal(result.executedOnConsole,false);
});

test('companion receipts must match exact original identity and full SD readback',()=>{
 const original={companionAssets:[{path:'asset-a.izdata',sha256:'a'.repeat(64),bytes:492}]};
 assert.throws(()=>api.checkInstalledAssets({assets:[]},original),/incomplete/);
 assert.throws(()=>api.checkInstalledAssets({assets:[{relativePath:'asset-a.izdata',sha256:'a'.repeat(64),bytes:492,readbackVerified:false}]},original),/not independently verified/);
 assert.doesNotThrow(()=>api.checkInstalledAssets({assets:[{relativePath:'asset-a.izdata',sha256:'a'.repeat(64),bytes:492,readbackVerified:true}]},original));
});
test('native catalog acknowledgement requires stable live SD tile',async()=>{
 let n=0;
 const supervisor={status:async()=>++n===1?menu():menu({applications:[{id:'book-reader',source:'sd',headerCrc:123}]})};
 const report=await api.confirmCatalog({supervisor,headerCrc:123,checks:2,pause:async()=>{}});
 assert.equal(report.phase,'native-catalog-verified');
 assert.equal(report.nativeCatalogAccepted,true);
 assert.equal(report.originalAppExecuted,false);
});
test('native catalog not yet updated cannot become install success',async()=>{
 const result=await api.confirmCatalog({supervisor:{status:async()=>menu()},headerCrc:123,checks:2,pause:async()=>{}});
 assert.equal(result.phase,'native-catalog-pending');
 assert.equal(result.nativeCatalogAccepted,false);
});
test('stale prior Book Reader failure does not invalidate fresh launch',async()=>{
 let count=0;
 const stale={id:'book-reader',sequence:7,error:123};
 const supervisor={status:async()=>++count===1?menu({launchFailure:stale,applications:[{id:'book-reader',source:'sd',headerCrc:123}]})
  :menu({launchFailure:stale,native_launches:1,last_id:'book-reader',active:1}),
  command:async()=>{}};
 const result=await api.launch({supervisor,headerCrc:123,checks:2,pause:async()=>{}});
 assert.equal(result.phase,'native-app-running');
});

test('native owned Book Reader installation, catalog confirmation and actual launch form one sequence',async()=>{
 const bytes=Buffer.from('original book reader fixture');
 let visible=false,launched=false,commands=0,released=false;
 const supervisor={
  status:async()=>menu({applications:visible?[{id:'book-reader',source:'sd',headerCrc:345}]:[],
   native_launches:launched?1:0,last_id:launched?'book-reader':'',active:launched?1:0}),
  holdMenu:async()=>({active:true,release:async({rescan})=>{assert.equal(rescan,true);visible=true;released=true;}}),
  command:async index=>{assert.equal(index,1);commands++;launched=true;}
 };
 const storage={writableMounts:['sd'],filesystem:{},uncertain:false,read(){},openRead(){},openWrite(){}};
 const r=await api.installAndLaunch('fixture',{supervisor,storage,
  verifyArtifact:async()=>({phase:'package-verified',id:'book-reader',
   sourceFormat:'IZSDAPP1 native ABI2',packageFile:'fixture',packageBytes:bytes.length,
   packageSha256:sha(bytes),companionAssets:[]}),
  readFile:async()=>bytes,decode:()=>({id:'book-reader',native:true}),
  installBytes:async()=>({id:'book-reader',readbackVerified:true,
   sha256:sha(bytes),headerCrc:345,assets:[]}),
  pause:async()=>{},confirmChecks:2,launchChecks:2});
 assert.equal(released,true);assert.equal(commands,1);
 assert.equal(r.phase,'native-app-running');
 assert.equal(r.executedOnConsole,true);assert.equal(r.ready,true);
 assert.equal(r.install.readbackVerified,true);assert.equal(r.catalog.nativeCatalogAccepted,true);
});
test('native launch orchestration never issues command before catalog acknowledgement',async()=>{
 const bytes=Buffer.from('fixture');
 let commands=0;
 const supervisor={status:async()=>menu(),command:async()=>{commands++;},
  holdMenu:async()=>({active:true,release:async()=>{}})};
 const storage={writableMounts:['sd'],filesystem:{},uncertain:false,read(){},openRead(){},openWrite(){}};
 const r=await api.installAndLaunch('fixture',{supervisor,storage,
  verifyArtifact:async()=>({phase:'package-verified',id:'book-reader',
   sourceFormat:'IZSDAPP1 native ABI2',packageFile:'fixture',packageBytes:bytes.length,
   packageSha256:sha(bytes),companionAssets:[]}),
  readFile:async()=>bytes,decode:()=>({id:'book-reader',native:true}),
  installBytes:async()=>({id:'book-reader',readbackVerified:true,sha256:sha(bytes),headerCrc:345,assets:[]}),
  pause:async()=>{},confirmChecks:2,launchChecks:2});
 assert.equal(commands,0);assert.equal(r.phase,'native-catalog-pending');
 assert.equal(r.executedOnConsole,false);assert.equal(r.ready,false);
});
test('Balatro-only transport cannot reach native Book Reader orchestrator',async()=>{
 let called=false;
 await assert.rejects(api.installAndLaunch('fixture',{
  supervisor:{status:async()=>menu()},storage:{},
  verifyArtifact:async()=>{called=true;}}),/Native IZ2S supervisor/);
 assert.equal(called,false);
});
