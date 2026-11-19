'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const crypto=require('node:crypto');
const {inspect,layout,align4}=require('../engines/iz2s-core/runtime/installer/engine/switch2/balatro/original-book-reader-load-plan.cjs');
const SECTION=['state','data','vertex','fragment','compute','computeBegin',
 'computeAfter','memory','tile','pad','nativeCode','nativeData'];
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
function fixture(){
 const source=Buffer.alloc(200000),lengths={state:1024,data:8,vertex:20,fragment:20,
  compute:20,computeBegin:0,computeAfter:0,memory:64,tile:131072,
  pad:20,nativeCode:16,nativeData:32};
 const ranges={},sections={};let at=512;
 for(const name of SECTION){
  const length=lengths[name];
  ranges[name]={offset:length?at:0,length,crc:123};
  sections[name]=Buffer.alloc(length);
  at=align4(at+length);
 }
 const header={id:'book-reader',version:2,native:true,nativeAbi:2,
  privateBytes:4096,nativeDataBytes:4096,ranges};
 const checked={phase:'package-verified',id:'book-reader',version:'0.1.0',
  sourceFormat:'IZSDAPP1 native ABI2',packageFile:'/fixture/launcher.iza',
  packageBytes:source.length,packageSha256:sha(source),
  companionAssets:[{path:'asset-'+sha(Buffer.from('book'))+'.izdata',
   bytes:4,sha256:sha(Buffer.from('book'))}]};
 let reads=0,verified=0;
 const options={expectedSha256:checked.packageSha256,
  verifyArtifact:async(file,opts)=>{
   verified++;assert.equal(file,'fixture');assert.equal(opts.expectedSha256,checked.packageSha256);
   return checked;
  },
  readFile:async file=>{reads++;assert.equal(file,checked.packageFile);return source;},
  codec:{SECTION,decodeHeader:()=>header,decode:()=>({...header,sections})}};
 return {source,header,sections,checked,options,counts:()=>({reads,verified})};
}
test('mirrors original native launcher CPU staging without copying private GPU image or tile',()=>{
 const f=fixture(),m=layout(f.header,{sections:f.sections},SECTION,f.source.length);
 assert.equal(m.cpuStagingBytes,1672);
 assert.equal(m.nativeCodeBytes,16);
 assert.equal(m.nativeDataAllocationBytes,4096);
 assert.equal(m.gpuPrivateAllocationBytes,4096);
 assert.equal(m.gpuPrivateInitialPrefixBytes,64);
 assert.equal(m.minimumControlCopyBytes,1032);
 assert.equal(m.sections.find(x=>x.name==='memory').destination,'gpu-private-prefix');
 assert.equal(m.sections.find(x=>x.name==='tile').destination,'menu-tile');
 assert.equal(m.sections.find(x=>x.name==='nativeCode').stagingOffset,1624);
});
test('verifies exact original Book Reader package and reports missing native owners',async()=>{
 const f=fixture(),out=await inspect('fixture',f.options);
 assert.equal(out.phase,'package-layout-verified-native-entry-blocked');
 assert.equal(out.packageSha256,f.checked.packageSha256);
 assert.equal(out.packageLayoutVerified,true);
 assert.deepEqual(f.counts(),{reads:1,verified:1});
 assert.equal(out.companionAssets.length,1);
 assert.equal(out.requirements.length,5);
 assert.equal(out.requirements.every(x=>!x.verified),true);
 assert.ok(out.missingNativePrerequisites.includes('filesystem'));
 assert.equal(out.nativeTransportReady,false);
 assert.equal(out.nativeSupervisorRunning,false);
 assert.equal(out.executedOnConsole,false);
 assert.equal(out.ready,false);
});
test('refuses modified image after verified file identity, before layout decode',async()=>{
 const f=fixture();let decoded=false;
 f.options.readFile=async()=>Buffer.from(f.source).fill(1,4,5);
 f.options.codec.decode=()=>{decoded=true;throw Error('must not decode');};
 await assert.rejects(()=>inspect('fixture',f.options),/image changed/);
 assert.equal(decoded,false);
});
test('rejects substituted non-ABI2 image and corrupted section bounds',async()=>{
 const f=fixture();
 f.header.nativeAbi=3;
 await assert.rejects(()=>inspect('fixture',f.options),/native ABI2 layout required/);
 f.header.nativeAbi=2;f.header.ranges.nativeCode.offset=f.source.length-2;
 await assert.rejects(()=>inspect('fixture',f.options),/Invalid native Book Reader section/);
});
test('requires the original Book Reader verified SD companion',async()=>{
 const f=fixture();f.checked.companionAssets=[];
 await assert.rejects(()=>inspect('fixture',f.options),/Missing verified original/);
});
test('a verified plan never invokes native RPC or grants executable ownership',async()=>{
 const f=fixture();
 const out=await inspect('fixture',f.options);
 assert.equal(Object.hasOwn(out,'nativeMemoryAddress'),false);
 assert.equal(Object.hasOwn(out,'execute'),false);
 assert.equal(Object.hasOwn(out,'launch'),false);
 assert.equal(out.consoleSdReadVerified,false);
 assert.equal(out.originalRendererReady,false);
});
