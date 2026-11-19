'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs/promises');
const os=require('node:os');
const path=require('node:path');
const crypto=require('node:crypto');
const {inspect,prepare,APP,MODULE,PROFILE,CONTROLLER,OUTPUT}=
 require('../engines/iz2s-core/runtime/installer/engine/switch2/balatro/original-book-reader.cjs');
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
function fixture(){
 const files=new Map();
 const put=(name,data)=>{const b=Buffer.from(data);files.set(name,b);return sha(b)};
 const app=Buffer.from(JSON.stringify({format:'hblauncher.gpu-app',abi:1,id:'book-reader',version:'0.1.0'}));
 files.set(APP+'/app.json',app);
 put(MODULE,JSON.stringify({id:'book-reader',version:'0.1.0'}));
 const pinned={
  'app.json':sha(app),
  'assets/state.bin':put(APP+'/assets/state.bin','reader-state'),
  'app.comp.spv.deflate':put(APP+'/app.comp.spv.deflate','real-compute'),
 };
 put(PROFILE,JSON.stringify({format:'iz2s.local-reader-profile-v1',version:'0.1.0',files:pinned}));
 const code=Buffer.from('native-reader-runtime-image');
 put(CONTROLLER+'/runtime.bin',code);
 const nativeSources={
  'runtime.c':put(CONTROLLER+'/runtime.c','real reader source'),
  '../native/native-app.h':put('core/console/sd-launcher/native/native-app.h','native ABI'),
 };
 put(CONTROLLER+'/native.json',JSON.stringify({
  format:'iz2s.local-reader-native-v1',abi:2,bytes:code.length,sha256:sha(code),sources:nativeSources,
 }));
 return {files,read:async name=>{
  if(!files.has(name))throw Object.assign(Error('Missing fixture: '+name),{code:'ENOENT'});
  return files.get(name);
 }};
}
test('original Book Reader is identified by its pinned assets and native ABI2 controller',async()=>{
 const f=fixture();
 const report=await inspect({root:'/not-used',read:f.read});
 assert.equal(report.phase,'source-verified');
 assert.equal(report.originalApp,true);
 assert.equal(report.nativeAdapter,'core/console/sd-launcher/reader/prepare.cjs');
 assert.equal(report.nativeTransportReady,false);
 assert.equal(report.executedOnConsole,false);
 assert.equal(report.sourceIntegrityVerified,true);
});
test('tampered shader or missing native controller is blocked before the builder runs',async()=>{
 const f=fixture();
 f.files.set(APP+'/app.comp.spv.deflate',Buffer.from('changed'));
 const bad=await inspect({read:f.read});
 assert.equal(bad.phase,'blocked');
 assert.ok(bad.failures.some(x=>x.file.endsWith('app.comp.spv.deflate')));
 let invoked=false;
 const outcome=await prepare({read:f.read,build:async()=>{invoked=true;}});
 assert.equal(invoked,false);
 assert.equal(outcome.prepared,false);
 const other=fixture();
 other.files.delete(CONTROLLER+'/runtime.bin');
 assert.equal((await inspect({read:other.read})).phase,'blocked');
});
test('preparation delegates to canonical package builder and verifies its original sections and companion',async t=>{
 const root=await fs.mkdtemp(path.join(os.tmpdir(),'iz2s-original-reader-'));
 t.after(()=>fs.rm(root,{recursive:true,force:true}));
 const f=fixture();
 const image=Buffer.from('real canonical package fixture');
 const digest=sha(image);
 const companion=Buffer.from('real reader library fixture');
 const companionDigest=sha(companion);
 let invocations=0;
 const result=await prepare({root,read:f.read,build:async(appRoot,directory,opts)=>{
  invocations++;
  assert.equal(appRoot,path.join(root,APP));
  assert.deepEqual(opts,{includeLibrary:false,sb4:false});
  assert.ok(directory.startsWith(path.join(root,OUTPUT)));
  const file=path.join(directory,'launcher.iza'),asset='asset-'+companionDigest+'.izdata';
  await fs.writeFile(file,image);
  await fs.writeFile(path.join(directory,asset),companion);
  return {id:'book-reader',output:file,bytes:image,sha256:digest,
   assets:[{path:asset,file:path.join(directory,asset),
     bytes:companion.length,sha256:companionDigest}]};
 },decode:()=>({
  id:'book-reader',native:true,delegated:false,nativeDataBytes:4096,
  sections:{nativeCode:Buffer.from('native'),vertex:Buffer.from('vs'),
    fragment:Buffer.from('fs'),compute:Buffer.from('cs')},
 })});
 assert.equal(invocations,1);
 assert.equal(result.phase,'prepared-on-pc');
 assert.equal(result.packageSha256,digest);
 assert.equal(result.companionAssets.length,1);
 assert.equal(result.executedOnConsole,false);
 assert.equal(result.installedOnConsole,false);
 assert.equal(result.nativeTransportReady,false);
 assert.ok((await fs.readFile(result.packageFile)).equals(image));
});
test('missing native sections are never reported as prepared',async t=>{
 const root=await fs.mkdtemp(path.join(os.tmpdir(),'iz2s-original-reader-invalid-'));
 t.after(()=>fs.rm(root,{recursive:true,force:true}));
 const f=fixture();
 const bytes=Buffer.from('native image fixture');
 await assert.rejects(()=>prepare({root,read:f.read,
  build:async(_app,directory)=>{
   const output=path.join(directory,'launcher.iza');
   await fs.writeFile(output,bytes);
   return {id:'book-reader',output,bytes,sha256:sha(bytes),assets:[]};
  },decode:()=>({id:'book-reader',native:true,nativeDataBytes:4096,
   sections:{nativeCode:Buffer.from('a')}})
 }),/native reader sections are missing/);
});
