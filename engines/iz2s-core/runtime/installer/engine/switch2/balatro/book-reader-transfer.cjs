#!/usr/bin/env node
'use strict';
// Transfers the first 512 verified bytes from the ORIGINAL Book Reader IZSDAPP1
// into a title-owned, token-scoped LuaJIT buffer. No native execution or SD I/O.
const fs=require('node:fs/promises');
const crypto=require('node:crypto');
const {verify}=require('./original-book-reader-handoff.cjs');
const {create}=require('./owned-binary.cjs');
const sha=data=>crypto.createHash('sha256').update(data).digest('hex');
const HEADER_BYTES=512,CHUNK=128;
async function transfer(host,file,{port=9026,expectedSha256,
 verifyArtifact=verify,makeBinary=create,readFile=fs.readFile}={}){
 const checked=await verifyArtifact(file,{expectedSha256});
 if(checked.phase!=='package-verified'||checked.id!=='book-reader'||
    checked.sourceFormat!=='IZSDAPP1 native ABI2')
  throw Error('Expected the original verified Book Reader application');
 const bytes=await readFile(checked.packageFile);
 if(bytes.length!==checked.packageBytes||sha(bytes)!==checked.packageSha256)
  throw Error('Book Reader package changed after verification');
 const header=bytes.subarray(0,HEADER_BYTES);
 if(header.length!==HEADER_BYTES)throw Error('Native Book Reader header truncated');
 const original=sha(header),session=makeBinary({host,port});
 let active=false,handle=null;
 const requireOk=(response,op)=>{
  if(response?.state!=='ok')throw Error('Title-owned binary '+op+' failed: '+(response?.detail||'invalid response'));
  return response;
 };
 try{
  requireOk(await session.init(),'init');active=true;
  const allocated=requireOk(await session.alloc(HEADER_BYTES),'alloc');
  handle=allocated.value;
  for(let offset=0;offset<HEADER_BYTES;offset+=CHUNK){
   requireOk(await session.write(handle,offset,header.subarray(offset,offset+CHUNK)),'write');
  }
  const returned=[];
  for(let offset=0;offset<HEADER_BYTES;offset+=CHUNK){
   const result=requireOk(await session.read(handle,offset,CHUNK),'read');
   if(!Buffer.isBuffer(result.value)||result.value.length!==CHUNK)
    throw Error('Title-owned header response was not a bounded buffer');
   returned.push(result.value);
  }
  const received=Buffer.concat(returned);
  if(!received.equals(header))throw Error('Original Book Reader bytes changed in the Balatro RPC roundtrip');
  requireOk(await session.release(handle),'release');handle=null;
  return {backend:'balatro',phase:'original-bytes-verified-in-title',
   app:'book-reader',packageSha256:checked.packageSha256,
   bytesTransferred:HEADER_BYTES,bytesVerified:HEADER_BYTES,
   headerSha256:original,roundtripSha256:sha(received),identical:true,
   bufferReleased:true,consoleSdWritten:false,originalAppExecuted:false,
   nativeMemoryTransportReady:false,nativeSupervisorRunning:false,ready:false};
 }finally{
  if(active)try{await session.clear();}catch{}
 }
}
async function main(){
 const [host,file,expectedSha256]=process.argv.slice(2);
 if(!host||!file){
  console.error('Usage: node book-reader-transfer.cjs <switch-ip> <prepared-launcher.iza> [expected-sha256]');
  process.exitCode=2;return;
 }
 try{
  console.log(JSON.stringify(await transfer(host,file,{expectedSha256}),null,2));
 }catch(e){
  console.error(JSON.stringify({phase:'error',id:'book-reader',ready:false,error:e.message}));
  process.exitCode=1;
 }
}
if(require.main===module)main();
module.exports={HEADER_BYTES,CHUNK,transfer};
