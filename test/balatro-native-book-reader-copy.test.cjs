'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const crypto=require('node:crypto');
const {transfer,LENGTH,CHUNK}=require('../engines/iz2s-core/runtime/installer/engine/switch2/balatro/native-book-reader-copy.cjs');
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
function fixture(overrides={}){
 const original=Buffer.from(Array.from({length:1024},(_,i)=>(i*37+11)&255));
 const buffers=new Map();const ops=[];let next=1;
 const session={
  async init(){ops.push('init');return {state:'ok',value:0}},
  async alloc(size){ops.push('alloc');const id=next++;buffers.set(id,Buffer.alloc(size));return {state:'ok',value:id}},
  async write(id,off,data){ops.push('write');data.copy(buffers.get(id),off);return {state:'ok',value:data.length}},
  async nativeCopy(a,b,src,dst,n){ops.push('nativeCopy');buffers.get(a).copy(buffers.get(b),dst,src,src+n);return {state:'ok',value:n}},
  async read(id,off,n){ops.push('read');return {state:'ok',value:Buffer.from(buffers.get(id).subarray(off,off+n))}},
  async release(id){ops.push('release');buffers.get(id).fill(0);buffers.delete(id);return {state:'ok',value:[...buffers.values()].reduce((x,b)=>x+b.length,0)}},
  async clear(){ops.push('clear');buffers.clear();return {state:'ok',value:0}},
  ...overrides,
 };
 return {ops,buffers,opts:{
  verifyArtifact:async()=>({id:'book-reader',phase:'package-verified',sourceFormat:'IZSDAPP1 native ABI2',
    packageFile:'fixture',packageSha256:sha(original),packageBytes:original.length}),
  expectedSha256:sha(original),readFile:async()=>original,makeSession:()=>session
 }};
}
test('real SDK copy operation is required for original native Book Reader bytes',async()=>{
 const f=fixture();
 const out=await transfer('192.168.1.232','fixture',f.opts);
 assert.equal(out.phase,'original-book-reader-sdk-memcpy-verified');
 assert.equal(out.bytesNativeCopied,LENGTH);assert.equal(out.identical,true);
 assert.equal(out.nativeSdkMemcpyVerified,true);assert.equal(out.executedOnConsole,false);
 assert.deepEqual(f.ops,[
  'init','alloc','alloc',...Array(LENGTH/CHUNK).fill('write'),'nativeCopy',
  ...Array(LENGTH/CHUNK).fill('read'),'release','release','clear']);
 assert.equal(f.buffers.size,0);
});
test('native copy unavailable never reports native verification and clears owned buffers',async()=>{
 const f=fixture({nativeCopy:async()=>({state:'blocked',detail:'native_unavailable'})});
 await assert.rejects(()=>transfer('192.168.1.232','fixture',f.opts),/SDK memcpy blocked/);
 assert.equal(f.ops.at(-1),'clear');assert.equal(f.buffers.size,0);
});
test('corrupt native output is refused even if SDK claims success',async()=>{
 const f=fixture({nativeCopy:async()=>({state:'ok',value:LENGTH})});
 await assert.rejects(()=>transfer('192.168.1.232','fixture',f.opts),/native memcpy changed header/);
 assert.equal(f.buffers.size,0);
});
