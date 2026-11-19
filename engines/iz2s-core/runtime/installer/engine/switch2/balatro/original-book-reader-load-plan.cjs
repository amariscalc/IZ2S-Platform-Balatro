#!/usr/bin/env node
'use strict';
// Offline load-plan audit for the UNMODIFIED original Book Reader ABI2 image.
// This mirrors the section-selection rules in native/launcher.c. No console,
// native memory, IPC, Vulkan, SD mount, mapping, or executable call is made.
const fs=require('node:fs/promises');
const crypto=require('node:crypto');
const nativePackage=require('../../../../../../../core/console/sd-launcher/package.cjs');
const {evaluate}=require('../../../../../../../core/console/sd-launcher/entry-contract.cjs');
const {verify}=require('./original-book-reader-handoff.cjs');
const sha=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
const align4=n=>Math.ceil(n/4)*4;
const STAGES=Object.freeze([
 {id:'sd-filesystem',requires:'Retained native FS endpoint with console SD access'},
 {id:'native-rpc-session',requires:'Original platform-2 addressable RPC and mapped session'},
 {id:'graphics-owner',requires:'Original validated Vulkan renderer and GPU memory owner'},
 {id:'native-code-loader',requires:'Authorized executable mapping and SDK function validation'},
 {id:'supervisor-lifecycle',requires:'Original launcher thread, INIT/FRAME/STOP and cleanup'},
]);
function layout(header,decoded,sectionNames,totalBytes){
 if(!Array.isArray(sectionNames)||sectionNames.length!==12||
    !sectionNames.includes('nativeCode')||!sectionNames.includes('nativeData'))
  throw Error('Unexpected original IZA section table');
 const ranges=header?.ranges,contents=decoded?.sections;
 if(!ranges||!contents||header.id!=='book-reader'||header.version!==2||
    header.native!==true||header.nativeAbi!==2||
    !Number.isSafeInteger(header.privateBytes)||header.privateBytes<0||
    !Number.isSafeInteger(header.nativeDataBytes)||header.nativeDataBytes<1)
  throw Error('Original Book Reader native ABI2 layout required');
 const sections=[];
 let stagingBytes=512;
 for(const name of sectionNames){
  const section=ranges[name],data=contents[name];
  if(!section||!Buffer.isBuffer(data)||!Number.isSafeInteger(section.offset)||
     !Number.isSafeInteger(section.length)||section.offset<0||section.length<0||
     section.length!==data.length||section.offset>totalBytes||
     section.length>totalBytes-section.offset)
   throw Error('Invalid native Book Reader section: '+name);
  const destination=name==='memory'?'gpu-private-prefix':name==='tile'?'menu-tile':'cpu-staging';
  const row={name,sourceOffset:section.length?section.offset:0,bytes:section.length,
   crc32:section.crc,destination};
  if(section.length&&destination==='cpu-staging'){
   stagingBytes=align4(stagingBytes);
   row.stagingOffset=stagingBytes;
   stagingBytes+=section.length;
  }
  sections.push(row);
 }
 const size=name=>sections.find(section=>section.name===name).bytes;
 if(size('state')!==1024||size('nativeCode')<4||
    size('nativeData')>header.nativeDataBytes||
    size('memory')>header.privateBytes||
    size('tile')!==131072)
  throw Error('Native Book Reader section requirements do not match original launcher');
 return {sections,cpuStagingBytes:stagingBytes,
  gpuPrivateAllocationBytes:header.privateBytes,
  gpuPrivateInitialPrefixBytes:size('memory'),
  nativeCodeBytes:size('nativeCode'),
  nativeDataInitialBytes:size('nativeData'),
  nativeDataAllocationBytes:header.nativeDataBytes,
  minimumControlCopyBytes:1024+size('data'),
  sourcePackageBytes:totalBytes};
}
async function inspect(file,{expectedSha256,verifyArtifact=verify,
 readFile=fs.readFile,codec=nativePackage}={}){
 const checked=await verifyArtifact(file,{expectedSha256});
 if(checked?.phase!=='package-verified'||checked.id!=='book-reader'||
    checked.sourceFormat!=='IZSDAPP1 native ABI2'||
    !Number.isSafeInteger(checked.packageBytes)||checked.packageBytes<512||
    !/^[a-f0-9]{64}$/.test(checked.packageSha256))
  throw Error('Verified original Book Reader package is required');
 const bytes=await readFile(checked.packageFile);
 if(!Buffer.isBuffer(bytes)||bytes.length!==checked.packageBytes||
    sha(bytes)!==checked.packageSha256)
  throw Error('Original Book Reader image changed after verification');
 // The actual decoder checks every section CRC and the SPIR-V section markers.
 const header=codec.decodeHeader(bytes.subarray(0,512),bytes.length);
 const decoded=codec.decode(bytes);
 if(decoded.id!==header.id||decoded.nativeAbi!==header.nativeAbi||
    decoded.privateBytes!==header.privateBytes)
  throw Error('Native package header and decoded contents disagree');
 const memory=layout(header,decoded,codec.SECTION,bytes.length);
 const assets=checked.companionAssets;
 if(!Array.isArray(assets)||assets.length<1||assets.length>16||
    assets.some(a=>!/^[a-f0-9]{64}$/.test(a.sha256)||!Number.isSafeInteger(a.bytes)||a.bytes<1))
  throw Error('Missing verified original Book Reader SD companion assets');
 const contract=evaluate({entry:'balatro'});
 return {backend:'balatro',app:'book-reader',version:checked.version,
  phase:'package-layout-verified-native-entry-blocked',
  originalImage:true,sourceFormat:checked.sourceFormat,
  packageSha256:checked.packageSha256,
  ...memory,
  companionAssets:assets.map(a=>({path:a.path,bytes:a.bytes,sha256:a.sha256})),
  requirements:STAGES.map(s=>({...s,verified:false})),
  missingNativePrerequisites:contract.missing,
  planSource:'core/console/sd-launcher/native/launcher.c',
  packageLayoutVerified:true,consoleSdReadVerified:false,
  originalRendererReady:false,nativeTransportReady:false,
  nativeSupervisorRunning:false,installedOnConsole:false,
  executedOnConsole:false,ready:false};
}
async function main(){
 const [file,expectedSha256]=process.argv.slice(2);
 if(!file){console.error('Usage: node original-book-reader-load-plan.cjs <prepared-launcher.iza> [sha256]');process.exitCode=2;return;}
 try{console.log(JSON.stringify(await inspect(file,{expectedSha256}),null,2));}
 catch(error){console.error(JSON.stringify({backend:'balatro',phase:'blocked',app:'book-reader',ready:false,error:error.message}));process.exitCode=1;}
}
if(require.main===module)main();
module.exports={STAGES,align4,layout,inspect};
