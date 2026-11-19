#!/usr/bin/env node
'use strict';
// Connects the verified ORIGINAL Book Reader package to IZ2S's actual SD
// namespace. Never bypasses the native owner's IPC/FS/Vulkan requirements.
// "stage" only creates a PC-local export; "live" only reads Lua telemetry.
const fs=require('node:fs/promises');
const fsSync=require('node:fs');
const path=require('node:path');
const crypto=require('node:crypto');
const nativePackage=require('../../../../../../../core/console/sd-launcher/package.cjs');
const assetsApi=require('../../../../../../../core/console/sd-launcher/assets.cjs');
const modulePaths=require('../../../../../../../core/module-storage.cjs');
const {ROOT,OUTPUT}=require('./original-book-reader.cjs');
const {create:createBoundary}=require('./native-rpc-boundary.cjs');
const {inspect:inspectLauncher}=require('./native-launch-gate.cjs');
const {evaluate:entryContract}=require('../../../../../../../core/console/sd-launcher/entry-contract.cjs');
const sha=buffer=>crypto.createHash('sha256').update(buffer).digest('hex');
const ID='book-reader';
const EXPECTED_IDENTITY=/^book-reader-[a-zA-Z0-9_-]+$/;

function inside(folder,file){
 const relative=path.relative(folder,file);
 return relative!==''&&!relative.startsWith('..'+path.sep)&&relative!=='..'&&!path.isAbsolute(relative);
}
async function fileHash(file,max){
 const stat=await fs.lstat(file);
 if(!stat.isFile()||stat.isSymbolicLink()||stat.size<1||stat.size>max)
  throw Error('Invalid original Book Reader file type or size: '+path.basename(file));
 const digest=crypto.createHash('sha256');
 for await(const chunk of fsSync.createReadStream(file))digest.update(chunk);
 return {bytes:stat.size,sha256:digest.digest('hex')};
}
function validateHeader(info){
 if(!info||info.id!==ID||!info.native||info.delegated||info.version!==2||
   !info.nativeDataBytes||!info.sections?.nativeCode?.length||
   !info.sections?.vertex?.length||!info.sections?.fragment?.length||
   !info.sections?.compute?.length)
  throw Error('The image is not the original Book Reader IZSDAPP1 ABI2 application');
}
async function verify(preparedFile,{root=ROOT,expectedSha256,
  decode=nativePackage.decode,loadBundle=assetsApi.loadBundle}={}){
 if(typeof preparedFile!=='string'||!preparedFile.trim())throw Error('Expected a prepared launcher.iza path');
 if(expectedSha256!==undefined&&!/^[a-f0-9]{64}$/.test(expectedSha256))
  throw Error('Invalid expected Book Reader SHA-256');
 const source=path.resolve(root,preparedFile);
 if(path.basename(source)!=='launcher.iza'||!EXPECTED_IDENTITY.test(path.basename(path.dirname(source))))
  throw Error('Use a specific Book Reader build output, not an arbitrary file');
 const base=await fs.realpath(path.join(root,OUTPUT));
 const real=await fs.realpath(source);
 if(!inside(base,real)||path.dirname(real)!==await fs.realpath(path.dirname(source)))
  throw Error('The prepared Book Reader path is outside the verified build directory');
 const info=await fileHash(real,32*1024*1024);
 if(expectedSha256&&info.sha256!==expectedSha256)throw Error('Original Book Reader package SHA-256 differs');
 const bytes=await fs.readFile(real);
 const decoded=decode(bytes);
 validateHeader(decoded);
 const sourceAssets=await loadBundle(real,bytes,{header:decoded});
 if(!Array.isArray(sourceAssets)||sourceAssets.length<1||sourceAssets.length>16)
  throw Error('Original Book Reader bundle is missing its SD companion');
 const files=[];
 for(const a of sourceAssets){
  if(!a||!/^asset-[a-f0-9]{64}\.izdata$/.test(a.path)||a.file!==path.join(path.dirname(real),a.path)||
    !Number.isInteger(a.bytes)||a.bytes<1||a.bytes>256*1024*1024||
    !/^[a-f0-9]{64}$/.test(a.sha256))
   throw Error('Unexpected Book Reader companion path or identity');
  const actual=await fileHash(a.file,256*1024*1024);
  if(actual.sha256!==a.sha256||actual.bytes!==a.bytes)
   throw Error('Original Book Reader companion SHA-256 mismatch: '+a.path);
  files.push({path:a.path,file:a.file,bytes:a.bytes,sha256:a.sha256});
 }
 return {phase:'package-verified',id:ID,version:'0.1.0',originalApp:true,
  packageFile:real,packageBytes:info.bytes,packageSha256:info.sha256,
  companionAssets:files,sourceFormat:'IZSDAPP1 native ABI2',
  destination:'SD:'+modulePaths.paths(ID).path+'/',
  installedOnConsole:false,executedOnConsole:false,nativeTransportReady:false,ready:false};
}
async function copyUnchanged(source,target,identity){
 try{
  const existing=await fileHash(target,256*1024*1024);
  if(existing.bytes!==identity.bytes||existing.sha256!==identity.sha256)
   throw Error('Staged file already exists with different content: '+path.basename(target));
  return 'reused';
 }catch(e){if(e.code!=='ENOENT')throw e;}
 const temporary=target+'.'+crypto.randomUUID()+'.tmp';
 try{
  await fs.copyFile(source,temporary,fsSync.constants.COPYFILE_EXCL);
  const check=await fileHash(temporary,256*1024*1024);
  if(check.bytes!==identity.bytes||check.sha256!==identity.sha256)
   throw Error('Staged original file checksum mismatch');
  await fs.rename(temporary,target);
 }finally{await fs.rm(temporary,{force:true});}
 return 'copied';
}
async function stage(preparedFile,options={}){
 const checked=await verify(preparedFile,options);
 const root=options.root||ROOT;
 const sdRoot=path.join(root,OUTPUT,'sd-exports',checked.packageSha256.slice(0,16));
 const destination=path.join(sdRoot,'iz2s','modules',ID);
 await fs.mkdir(destination,{recursive:true});
 const staged=[];
 for(const item of checked.companionAssets){
  const dest=path.join(destination,item.path);
  const result=await copyUnchanged(item.file,dest,item);
  staged.push({name:item.path,bytes:item.bytes,sha256:item.sha256,state:result});
 }
 const result=await copyUnchanged(checked.packageFile,path.join(destination,'launcher.iza'),
  {bytes:checked.packageBytes,sha256:checked.packageSha256});
 staged.push({name:'launcher.iza',bytes:checked.packageBytes,sha256:checked.packageSha256,state:result});
 return {phase:'staged-on-pc',id:ID,originalPackageVerified:true,
  localSdRoot:path.join(sdRoot,'iz2s'),localAppDirectory:destination,
  intendedConsolePath:checked.destination,
  files:staged,installedOnConsole:false,executedOnConsole:false,
  nativeTransportReady:false,ready:false};
}
async function live(host,preparedFile,options={}){
 const checked=await verify(preparedFile,options);
 if(typeof host!=='string'||!host||/\s/.test(host))throw Error('Invalid Switch host');
 const artifacts=inspectLauncher(options.root||ROOT);
 let title=null,linkError=null;
 try{
  title=await (options.makeBoundary||createBoundary)({
   host,port:options.port||9026
  }).status();
 }catch(e){linkError=e.message;}
 const contract=entryContract({entry:'balatro'});
 return {phase:'native-entry-blocked',
  originalPackageVerified:checked.phase==='package-verified',
  packageSha256:checked.packageSha256,
  nativeLauncherArtifactsVerified:artifacts.phase==='verified',
  titleLocalBoundary:title,titleLocalBoundaryError:linkError,
  missingNativePrerequisites:contract.missing,
  nativeTransportReady:false,installedOnConsole:false,
  executedOnConsole:false,ready:false};
}
async function main(){
 const [cmd='verify',arg1,arg2,arg3]=process.argv.slice(2);
 if(!['verify','stage','live'].includes(cmd)||
  (cmd==='live'&&(!arg1||!arg2))||
  (cmd!=='live'&&!arg1)){
  console.error('Usage: node original-book-reader-handoff.cjs verify|stage <prepared-launcher.iza> [sha256] OR live <switch-ip> <prepared-launcher.iza> [sha256]');
  process.exitCode=2;return;
 }
 try{
  const result=cmd==='live'?await live(arg1,arg2,{expectedSha256:arg3}):
   cmd==='stage'?await stage(arg1,{expectedSha256:arg2}):
   await verify(arg1,{expectedSha256:arg2});
  console.log(JSON.stringify(result,null,2));
 }catch(e){
  console.error(JSON.stringify({phase:'blocked',id:ID,ready:false,error:e.message}));
  process.exitCode=1;
 }
}
if(require.main===module)main();
module.exports={ROOT,ID,inside,fileHash,validateHeader,verify,stage,live};
