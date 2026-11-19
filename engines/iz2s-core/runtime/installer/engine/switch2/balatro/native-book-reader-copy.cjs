#!/usr/bin/env node
'use strict';
// Prove ORIGINAL Book Reader package bytes cross a real SDK memcpy call
// between two distinct Balatro-owned FFI buffers. No SD, IPC or code mapping.
const fs=require('node:fs/promises');
const crypto=require('node:crypto');
const {verify}=require('./original-book-reader-handoff.cjs');
const {create}=require('./owned-binary.cjs');
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const LENGTH=512,CHUNK=128;
async function transfer(host,file,{port=9026,expectedSha256,verifyArtifact=verify,
  readFile=fs.readFile,makeSession=create}={}){
 const checked=await verifyArtifact(file,{expectedSha256});
 if(checked?.id!=='book-reader'||checked.phase!=='package-verified'||
    checked.sourceFormat!=='IZSDAPP1 native ABI2')
  throw Error('Verified original Book Reader package required');
 const full=await readFile(checked.packageFile);
 if(!Buffer.isBuffer(full)||full.length!==checked.packageBytes||sha(full)!==checked.packageSha256)
  throw Error('Original Book Reader package SHA-256 changed');
 const header=full.subarray(0,LENGTH);
 if(header.length!==LENGTH)throw Error('Original Book Reader header truncated');
 const session=makeSession({host,port});
 const requireOk=(r,action)=>{
  if(r?.state!=='ok')throw Error('Balatro owned native '+action+' blocked: '+(r?.detail||'invalid reply'));
  return r;
 };
 let initialized=false;
 try{
  requireOk(await session.init(),'init');initialized=true;
  const source=requireOk(await session.alloc(LENGTH),'source allocation').value;
  const dest=requireOk(await session.alloc(LENGTH),'destination allocation').value;
  if(!Number.isSafeInteger(source)||!Number.isSafeInteger(dest)||source===dest||source<1||dest<1)
   throw Error('Native copy requires independent owned memory handles');
  for(let offset=0;offset<LENGTH;offset+=CHUNK){
   const wrote=requireOk(await session.write(source,offset,header.subarray(offset,offset+CHUNK)),'write');
   if(wrote.value!==CHUNK)throw Error('Short original header transfer');
  }
  const copied=requireOk(await session.nativeCopy(source,dest,0,0,LENGTH),'SDK memcpy');
  if(copied.value!==LENGTH)throw Error('Native SDK memcpy returned wrong copied byte count');
  const received=[];
  for(let offset=0;offset<LENGTH;offset+=CHUNK){
   const read=requireOk(await session.read(dest,offset,CHUNK),'read');
   if(!Buffer.isBuffer(read.value)||read.value.length!==CHUNK)
    throw Error('Invalid native copied data reply');
   received.push(read.value);
  }
  const actual=Buffer.concat(received);
  if(!actual.equals(header))throw Error('Original Book Reader native memcpy changed header');
  const left=requireOk(await session.release(source),'source release');
  if(left.value!==LENGTH)throw Error('Source release left unexpected memory');
  const cleared=requireOk(await session.release(dest),'destination release');
  if(cleared.value!==0)throw Error('Destination release left outstanding memory');
  return {backend:'balatro',phase:'original-book-reader-sdk-memcpy-verified',app:'book-reader',
   sourceFormat:checked.sourceFormat,packageSha256:checked.packageSha256,
   bytesNativeCopied:LENGTH,originalHeaderSha256:sha(header),nativeCopySha256:sha(actual),
   identical:true,nativeSdkMemcpyVerified:true,ownedBuffersReleased:true,
   nativeTransportReady:false,nativeSupervisorRunning:false,installedOnConsole:false,
   executedOnConsole:false,ready:false};
 }finally{
  if(initialized)try{await session.clear();}catch{}
 }
}
async function main(){
 const [host,file,expectedSha256]=process.argv.slice(2);
 if(!host||!file){console.error('Usage: node native-book-reader-copy.cjs <switch-ip> <prepared-launcher.iza> [sha256]');process.exitCode=2;return;}
 try{console.log(JSON.stringify(await transfer(host,file,{expectedSha256}),null,2));}
 catch(error){console.error(JSON.stringify({phase:'blocked',backend:'balatro',app:'book-reader',ready:false,error:error.message}));process.exitCode=1;}
}
if(require.main===module)main();
module.exports={LENGTH,CHUNK,transfer};
