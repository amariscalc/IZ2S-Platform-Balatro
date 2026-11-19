'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs/promises');
const os=require('node:os');
const path=require('node:path');
const crypto=require('node:crypto');
const {verify,stage,live,ROOT,inside}=require('../engines/iz2s-core/runtime/installer/engine/switch2/balatro/original-book-reader-handoff.cjs');
const {OUTPUT}=require('../engines/iz2s-core/runtime/installer/engine/switch2/balatro/original-book-reader.cjs');
const digest=b=>crypto.createHash('sha256').update(b).digest('hex');
async function fixture(t){
 const root=await fs.mkdtemp(path.join(os.tmpdir(),'iz2s-reader-handoff-'));
 t.after(()=>fs.rm(root,{recursive:true,force:true}));
 const folder=path.join(root,OUTPUT,'book-reader-demo');
 await fs.mkdir(folder,{recursive:true});
 const image=Buffer.from('Original native reader test fixture');
 const data=Buffer.from('Original companion test fixture');
 const asset='asset-'+digest(data)+'.izdata';
 const file=path.join(folder,'launcher.iza');
 await fs.writeFile(file,image);
 await fs.writeFile(path.join(folder,asset),data);
 const decode=()=>({id:'book-reader',native:true,version:2,delegated:false,
  nativeDataBytes:16*1024*1024,sections:{nativeCode:Buffer.of(1),vertex:Buffer.of(2),fragment:Buffer.of(3),compute:Buffer.of(4)}});
 const loadBundle=async()=>[{file:path.join(folder,asset),path:asset,bytes:data.length,sha256:digest(data)}];
 return {root,file,image,data,asset,decode,loadBundle};
}
test('rejects traversal paths and identity tampering before staging',async t=>{
 const f=await fixture(t);
 assert.equal(inside(f.root,path.join(f.root,'child')),true);
 assert.equal(inside(f.root,f.root),false);
 assert.equal(inside(f.root,path.resolve(f.root,'../escape')),false);
 await assert.rejects(()=>verify(path.join(f.root,'outside.iza'),f),/Book Reader build output/);
 await assert.rejects(()=>verify(f.file,{...f,expectedSha256:'0'.repeat(64)}),/SHA-256 differs/);
 await assert.rejects(()=>verify(f.file,{...f,decode:()=>({id:'other',native:true})}),/not the original Book Reader/);
});
test('checks exact Book Reader ABI2 payload and original companion hash',async t=>{
 const f=await fixture(t);
 const r=await verify(f.file,{...f,expectedSha256:digest(f.image)});
 assert.equal(r.phase,'package-verified');
 assert.equal(r.destination,'SD:/iz2s/modules/book-reader/');
 assert.equal(r.originalApp,true);
 assert.equal(r.packageSha256,digest(f.image));
 assert.equal(r.nativeTransportReady,false);
 assert.equal(r.installedOnConsole,false);
 await fs.writeFile(path.join(path.dirname(f.file),f.asset),Buffer.from('corrupted'));
 await assert.rejects(()=>verify(f.file,f),/companion SHA-256 mismatch/);
});
test('stages exact original bytes locally and safely reuses matching artifacts',async t=>{
 const f=await fixture(t);
 const first=await stage(f.file,f);
 assert.equal(first.phase,'staged-on-pc');
 assert.equal(first.files.length,2);
 assert.equal(first.files.every(x=>x.state==='copied'),true);
 assert.equal((await fs.readFile(path.join(first.localAppDirectory,'launcher.iza'))).equals(f.image),true);
 const second=await stage(f.file,f);
 assert.equal(second.files.every(x=>x.state==='reused'),true);
 assert.equal(second.installedOnConsole,false);
 assert.equal(second.executedOnConsole,false);
 assert.equal(second.nativeTransportReady,false);
});
test('read-only Balatro observation cannot be upgraded into native execution',async t=>{
 const f=await fixture(t);
 const state=await live('192.168.1.232',f.file,{...f,makeBoundary:()=>({status:async()=>({
  titleLuaAvailable:true,nativeRpcAvailable:false,originalLauncherReady:false
 })})});
 assert.equal(state.phase,'native-entry-blocked');
 assert.equal(state.originalPackageVerified,true);
 assert.equal(state.nativeTransportReady,false);
 assert.equal(state.installedOnConsole,false);
 assert.equal(state.executedOnConsole,false);
 assert.ok(state.missingNativePrerequisites.includes('native-rpc'));
});
