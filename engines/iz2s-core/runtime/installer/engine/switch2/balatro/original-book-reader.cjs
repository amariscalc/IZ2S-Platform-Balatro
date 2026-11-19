#!/usr/bin/env node
'use strict';
// Build the REAL Book Reader GPU/ABI2 SD application via the canonical IZ2S
// package builder. Never silently replace it with a Lua reader or mark it
// running. Balatro's current title-local RPC cannot install/start this image.
const fs=require('node:fs/promises');
const path=require('node:path');
const crypto=require('node:crypto');
const ROOT=path.resolve(__dirname,'../../../../../../../');
const APP='modules/BookReader/switch';
const MODULE='modules/BookReader/module.json';
const PROFILE='core/console/sd-launcher/reader/profile.json';
const CONTROLLER='core/console/sd-launcher/reader';
const OUTPUT='data/build-cache/balatro-original-book-reader';
const sha=x=>crypto.createHash('sha256').update(x).digest('hex');
async function inspect({root=ROOT,read=async name=>fs.readFile(path.join(root,name))}={}){
 const checked=[];
 const fail=(name,reason)=>checked.push({file:name,valid:false,reason});
 async function load(name,expected){
  try{
   const bytes=await read(name),digest=sha(bytes);
   const valid=!expected||expected===digest;
   checked.push({file:name,valid,bytes:bytes.length,...(!valid?{reason:'SHA-256 mismatch'}:{sha256:digest})});
   return valid?bytes:null;
  }catch(e){fail(name,e.code||e.message);return null;}
 }
 const module=await load(MODULE),app=await load(APP+'/app.json');
 let descriptor,manifest;
 try{descriptor=JSON.parse(module);manifest=JSON.parse(app);}
 catch(e){return {phase:'blocked',blocker:'invalid-book-reader-descriptor',checked,ready:false};}
 if(descriptor.id!=='book-reader'||descriptor.version!=='0.1.0'||
    manifest.id!=='book-reader'||manifest.version!==descriptor.version||
    manifest.format!=='hblauncher.gpu-app'||manifest.abi!==1)
  fail(MODULE,'Unexpected Book Reader identity/version/ABI');
 const profileBytes=await load(PROFILE);
 let profile;
 try{profile=JSON.parse(profileBytes);}catch(e){fail(PROFILE,'Invalid pinned reader profile');}
 if(profile){
  if(profile.format!=='iz2s.local-reader-profile-v1'||profile.version!==manifest.version)
   fail(PROFILE,'Unrecognized native Book Reader compatibility profile');
  for(const [name,digest] of Object.entries(profile.files||{})){
   if(!/^(?:app\.json|assets\/[a-z0-9.-]+|app\.(?:vert|frag|comp)\.spv\.deflate)$/.test(name)||
      !/^[0-9a-f]{64}$/.test(digest)){fail(PROFILE,'Invalid pinned asset entry');continue;}
   await load(APP+'/'+name,digest);
  }
 }
 const receipt=await load(CONTROLLER+'/native.json');
 let native;
 try{native=JSON.parse(receipt);}catch(e){fail(CONTROLLER+'/native.json','Invalid native controller receipt');}
 if(native){
  if(native.format!=='iz2s.local-reader-native-v1'||native.abi!==2||
     !Number.isInteger(native.bytes)||native.bytes<1||
     !/^[a-f0-9]{64}$/.test(native.sha256))
   fail(CONTROLLER+'/native.json','Native controller ABI/receipt is not compatible');
  await load(CONTROLLER+'/runtime.bin',native.sha256);
  for(const [relative,digest] of Object.entries(native.sources||{})){
   const name=path.posix.normalize(CONTROLLER+'/'+relative);
   if(!name.startsWith('core/console/sd-launcher/')||
      !/^[a-f0-9]{64}$/.test(digest)){fail(CONTROLLER+'/native.json','Invalid controller source path/hash');continue;}
   await load(name,digest);
  }
 }
 const valid=checked.length>0&&checked.every(x=>x.valid);
 return {phase:valid?'source-verified':'blocked',
  target:'Book Reader',id:'book-reader',version:'0.1.0',
  originalApp:true,sourceFiles:checked.length,
  sourceIntegrityVerified:valid,failures:checked.filter(x=>!x.valid),
  nativeAdapter:'core/console/sd-launcher/reader/prepare.cjs',
  originalBuilder:'core/console/sd-launcher/package.cjs',
  outputKind:'IZSDAPP1 ABI2 native reader with original SPIR-V shaders',
  nativeTransportReady:false,balatroLaunchReady:false,
  installedOnConsole:false,executedOnConsole:false,ready:false};
}
async function prepare({root=ROOT,includeLibrary=false,read,build}={}){
 const audit=await inspect({root,read});
 if(audit.phase!=='source-verified')return {...audit,phase:'blocked',prepared:false};
 const destination=path.join(root,OUTPUT);
 await fs.mkdir(destination,{recursive:true});
 const directory=await fs.mkdtemp(path.join(destination,'book-reader-'));
 try{
  const builder=build||require('../../../../../../../core/console/sd-launcher/package.cjs').build;
  const product=await builder(path.join(root,APP),directory,{includeLibrary,sb4:false});
  if(!product||product.id!=='book-reader'||!Buffer.isBuffer(product.bytes)||
     typeof product.output!=='string'||path.resolve(product.output)!==path.join(directory,'launcher.iza'))
   throw Error('Original builder returned an unexpected Book Reader artifact');
  const packageApi=require('../../../../../../../core/console/sd-launcher/package.cjs');
  const decoded=packageApi.decode(product.bytes);
  if(decoded.id!=='book-reader'||!decoded.native||decoded.delegated||
    decoded.nativeDataBytes===0||!decoded.sections.nativeCode?.length||
    !decoded.sections.vertex?.length||!decoded.sections.fragment?.length||
    !decoded.sections.compute?.length)
   throw Error('Book Reader native reader sections are missing');
  const digest=sha(product.bytes);
  if(digest!==product.sha256||!((await fs.readFile(product.output)).equals(product.bytes)))
   throw Error('Original package readback verification failed');
  const assets=[];
  for(const a of product.assets||[]){
   if(!a||!/^asset-[a-f0-9]{64}\.izdata$/.test(a.path)||
      !Number.isSafeInteger(a.bytes)||a.bytes<1||a.bytes>256*1024*1024||
      !/^[a-f0-9]{64}$/.test(a.sha256)||
      path.resolve(a.file)!==path.join(directory,a.path))
    throw Error('Unexpected native Book Reader companion asset');
   const bytes=await fs.readFile(a.file);
   if(bytes.length!==a.bytes||sha(bytes)!==a.sha256)throw Error('Native Book Reader companion asset readback differs');
   assets.push({file:a.file,bytes:a.bytes,sha256:a.sha256});
  }
  if(!assets.length)throw Error('Original Book Reader did not produce its required SD library companion');
  return {...audit,phase:'prepared-on-pc',prepared:true,packageFile:product.output,
   packageBytes:product.bytes.length,packageSha256:digest,companionAssets:assets,
   libraryMode:includeLibrary?'existing-books':'original-welcome-only',
   handoff:'Requires an independently established native IZ2S SD launcher session',
   nativeTransportReady:false,installedOnConsole:false,executedOnConsole:false,ready:false};
 }catch(error){
  await fs.rm(directory,{recursive:true,force:true});
  throw error;
 }
}
async function main(){
 const [action='inspect',flag]=process.argv.slice(2);
 if(!['inspect','prepare'].includes(action)||flag&&!['--include-library'].includes(flag)){
  console.error('Usage: node original-book-reader.cjs inspect|prepare [--include-library]');
  process.exitCode=2;return;
 }
 try{
  const result=action==='inspect'?await inspect():await prepare({includeLibrary:flag==='--include-library'});
  console.log(JSON.stringify(result,null,2));
  if(result.phase==='blocked')process.exitCode=1;
 }catch(e){
  console.error(JSON.stringify({phase:'blocked',id:'book-reader',ready:false,error:e.message}));
  process.exitCode=1;
 }
}
if(require.main===module)main();
module.exports={ROOT,APP,MODULE,PROFILE,CONTROLLER,OUTPUT,inspect,prepare};
