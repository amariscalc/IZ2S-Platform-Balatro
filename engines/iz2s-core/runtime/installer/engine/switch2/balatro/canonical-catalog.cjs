#!/usr/bin/env node
'use strict';
// Read-only PC package preview for the Lua port of the original IZ2S menu.
// Shares repository.list/previewApps with core/console/sd-launcher/library.cjs.
// Does NOT claim installed SD apps, request installation, or launch homebrew.
const path=require('node:path');
const {request}=require('./rpc.cjs');
const ROOT=path.resolve(__dirname,'../../../../../../../');
const MAX=16;
function validate(rows){
 if(!Array.isArray(rows)||rows.length>MAX)throw Error('Invalid IZ2S preview catalog size');
 const ids=new Set();
 return rows.map(p=>{
  if(!p||typeof p!=='object'||typeof p.id!=='string'||
    !/^[a-z0-9][a-z0-9-]{0,46}$/.test(p.id)||ids.has(p.id)||
    typeof p.name!=='string'||!p.name.trim()||
    typeof p.version!=='string'||p.version.length>32||
    !/^[a-f0-9]{64}$/.test(p.sha256))
   throw Error('Invalid or duplicate IZ2S preview package');
  ids.add(p.id);
  // Existing Balatro console text renderer uses an ASCII font subset.
  // Preserve identity hashes; sanitize UI text only.
  const label=p.name.normalize('NFKD').replace(/[\u0300-\u036f]/g,'')
   .replace(/[^\x20-\x7e]/g,'?').trim().slice(0,47);
  const version=p.version.normalize('NFKD').replace(/[\u0300-\u036f]/g,'')
   .replace(/[^\x20-\x7e]/g,'?').slice(0,24);
  if(!label)throw Error('Empty display label');
  return {id:p.id,name:label,version,sha256:p.sha256};
 });
}
async function readCatalog({root=ROOT,shell='izlauncher',createRepository}={}){
 const make=createRepository||require('../../../../../../../core/packages/repository.cjs').create;
 const library=await make(root,{shell,source:'current'});
 const inventory=await library.list();
 const preview=await library.previewApps(path.join(root,'data','balatro-catalog-preview'),{listing:inventory});
 const packages=validate(preview.packages);
 return {source:'iz2s-pc-library-preview',packages,
  rejected:(preview.rejected||[]).length,available:packages.length};
}
function payload(rows){
 rows=validate(rows);
 const objects=rows.map(p=>'{id='+JSON.stringify(p.id)+
  ',name='+JSON.stringify(p.name)+',version='+JSON.stringify(p.version)+
  ',sha256='+JSON.stringify(p.sha256)+'}');
 const lua=[
  'local a=rawget(_G,"__IZ2S_CANONICAL_FOCUS_LUA_V1")',
  'if type(a)~="table" or type(a.model)~="table" then return "IZ2S_CATALOG_V1;state=blocked;count=0" end',
  'local rows={' +objects.join(',')+'}',
  'a.catalog=rows',
  'a.model.pickerCount=#rows',
  'a.model.selected=0',
  'a.model.flow=0',
  'a.model.notice=nil',
  'return "IZ2S_CATALOG_V1;state=loaded;count="..#rows',
 ].join('\n');
 if(Buffer.byteLength(lua)>8192)throw Error('IZ2S catalog publish exceeds Lua RPC size');
 return lua;
}
function parse(reply,expected){
 if(typeof reply!=='string'||!reply.startsWith('-> '))throw Error('Invalid IZ2S catalog RPC framing');
 const m=/^IZ2S_CATALOG_V1;state=(loaded|blocked);count=(0|[1-9][0-9]?)$/.exec(reply.slice(3).trim());
 if(!m||Number(m[2])>MAX||
   (m[1]==='loaded'&&Number(m[2])!==expected)||
   (m[1]==='blocked'&&Number(m[2])!==0))throw Error('Unexpected IZ2S catalog response');
 return {backend:'balatro',mode:'canonical-pc-preview-catalog',
  state:m[1],availablePackages:Number(m[2]),installedPackagesVerified:false,
  nativeApplicationLaunchAvailable:false,ready:false};
}
async function publish(host,{port=9026,root=ROOT,createRepository,send=request}={}){
 const source=await readCatalog({root,createRepository});
 const reply=await send({host,port,lua:payload(source.packages),timeoutMs:5000});
 return {...parse(reply,source.packages.length),source:source.source,rejected:source.rejected};
}
async function main(){
 const [host,portRaw]=process.argv.slice(2);
 if(!host){console.error('Usage: node canonical-catalog.cjs <switch-ip> [port]');process.exitCode=2;return;}
 try{const result=await publish(host,{port:portRaw?Number(portRaw):9026});console.log(JSON.stringify(result,null,2));
  if(result.state!=='loaded')process.exitCode=1;
 }catch(error){console.error(JSON.stringify({backend:'balatro',state:'error',ready:false,error:error.message}));process.exitCode=1;}
}
if(require.main===module)main();
module.exports={ROOT,MAX,validate,readCatalog,payload,parse,publish};
