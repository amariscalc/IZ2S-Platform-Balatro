'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const crypto=require('node:crypto');
const {transfer,HEADER_BYTES,CHUNK}=
 require('../engines/iz2s-core/runtime/installer/engine/switch2/balatro/book-reader-transfer.cjs');
const hash=x=>crypto.createHash('sha256').update(x).digest('hex');
function fixture(){
 const source=Buffer.from(Array.from({length:2048},(_,i)=>(i*29+17)%256));
 const calls=[];let live=false,buffer=null,cleared=false;
 const binary={
  async init(){calls.push('init');live=true;return {state:'ok',value:0};},
  async alloc(size){calls.push('alloc');buffer=Buffer.alloc(size);return {state:'ok',value:1};},
  async write(_id,offset,bytes){calls.push('write');bytes.copy(buffer,offset);return {state:'ok',value:bytes.length};},
  async read(_id,offset,length){calls.push('read');return {state:'ok',value:Buffer.from(buffer.subarray(offset,offset+length))};},
  async release(){calls.push('release');buffer.fill(0);buffer=null;return {state:'ok',value:0};},
  async clear(){calls.push('clear');live=false;cleared=true;return {state:'ok'}},
 };
 const config={
  expectedSha256:hash(source),
  verifyArtifact:async()=>({phase:'package-verified',id:'book-reader',
   sourceFormat:'IZSDAPP1 native ABI2',packageFile:'fixture/launcher.iza',
   packageBytes:source.length,packageSha256:hash(source)}),
  readFile:async()=>source,makeBinary:()=>binary,
 };
 return {source,calls,config,get cleared(){return cleared},get live(){return live}};
}
test('transfers exact verified header of original native package, not substitute Lua app',async()=>{
 const f=fixture();
 const out=await transfer('192.168.1.232','fixture/launcher.iza',f.config);
 assert.equal(out.phase,'original-bytes-verified-in-title');
 assert.equal(out.bytesTransferred,HEADER_BYTES);
 assert.equal(out.headerSha256,hash(f.source.subarray(0,HEADER_BYTES)));
 assert.equal(out.roundtripSha256,out.headerSha256);
 assert.equal(out.identical,true);
 assert.equal(out.consoleSdWritten,false);
 assert.equal(out.originalAppExecuted,false);
 assert.equal(out.nativeMemoryTransportReady,false);
 assert.equal(out.bufferReleased,true);
 assert.deepEqual(f.calls,[
  'init','alloc',...Array(HEADER_BYTES/CHUNK).fill('write'),
  ...Array(HEADER_BYTES/CHUNK).fill('read'),'release','clear'
 ]);
 assert.equal(f.cleared,true);
});
test('refuses unverifiable package and never opens native title buffer',async()=>{
 const f=fixture();let called=false;
 const readOnly=await transfer('192.168.1.232','fixture/launcher.iza',{
  ...f.config,verifyArtifact:async()=>({phase:'blocked'}),
  makeBinary:()=>{called=true;}
 }).catch(e=>e);
 assert.match(readOnly.message,/original verified Book Reader/);
 assert.equal(called,false);
});
test('mismatching bytes cannot report a verified roundtrip and still cleans owned state',async()=>{
 const f=fixture();
 const broken={
  ...f.config,makeBinary:()=>{
   const b={bytes:null};
   return {
    async init(){return {state:'ok'}},
    async alloc(n){b.bytes=Buffer.alloc(n);return {state:'ok',value:1}},
    async write(_id,offset,data){data.copy(b.bytes,offset);return {state:'ok'}},
    async read(_id,offset,n){return {state:'ok',value:Buffer.alloc(n)}},
    async release(){return {state:'ok',value:0}},
    async clear(){f.calls.push('clear');return {state:'ok'}},
   };
  }
 };
 await assert.rejects(()=>transfer('192.168.1.232','fixture/launcher.iza',broken),
  /bytes changed/);
 assert.ok(f.calls.includes('clear'));
});
