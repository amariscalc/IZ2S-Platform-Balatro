#!/usr/bin/env node
'use strict';
// Original IZ2S presentation artwork over the title-local Balatro Lua RPC.
// Python/Pillow is used only on the host to rasterize repository PNG assets;
// Lua receives bounded image data. No SD writes, package installs or native calls.
const path=require('node:path');
const cp=require('node:child_process');
const fs=require('node:fs');
const {request}=require('./rpc.cjs');
const ROOT=path.resolve(__dirname,'../../../../../../../');
const MAX_RPC=8192;
function spritePayload(sprite){
 if(!sprite||typeof sprite.id!=='string'||!/^(?:type-[a-z]+|[a-z][a-z0-9-]{0,46})$/.test(sprite.id))throw Error('Invalid visual asset ID');
 const {w,h,format,data}=sprite;
 if(!Number.isInteger(w)||!Number.isInteger(h)||w<1||h<1||w*h>30000||typeof data!=='string'||!/^[0-9a-f]+$/.test(data))throw Error('Invalid visual sprite geometry');
 if(!['rgba4444','alpha1'].includes(format))throw Error('Unsupported visual sprite encoding');
 if(data.length!==(format==='rgba4444'?4*w*h:Math.ceil(w*h/4)))throw Error('Unexpected visual sprite length');
 const key=JSON.stringify(sprite.id);
 const prefix=[
  'local a=rawget(_G,"__IZ2S_CANONICAL_FOCUS_LUA_V1")',
  'if type(a)~="table" then return "IZ2S_ASSET_V1;state=blocked" end',
  'local ok=pcall(function()',
  'local l=rawget(_G,"love")',
  'local d=l.image.newImageData('+w+','+h+')',
  'local s='+JSON.stringify(data),
 ];
 const pixels=format==='rgba4444'?[
  'for i=0,'+(w*h-1)+' do',
  'local n=tonumber(s:sub(i*4+1,i*4+4),16)',
  'd:setPixel(i%'+w+',math.floor(i/'+w+'),math.floor(n/4096)%16/15,math.floor(n/256)%16/15,math.floor(n/16)%16/15,n%16/15)',
  'end',
 ]:[
  'for i=0,'+(w*h-1)+' do',
  'local n=tonumber(s:sub(math.floor(i/4)+1,math.floor(i/4)+1),16)',
  'local a=math.floor(n/2^(3-i%4))%2',
  'd:setPixel(i%'+w+',math.floor(i/'+w+'),1,1,1,a)',
  'end',
 ];
 const source=[...prefix,...pixels,
  'a.sprites=a.sprites or {}',
  'a.sprites['+key+']=d',
  'if a.images then a.images['+key+']=nil end',
  'end)',
  'return "IZ2S_ASSET_V1;state="..(ok and "loaded" or "skipped")',
 ].join('\n');
 if(Buffer.byteLength(source)>MAX_RPC)throw Error('Visual sprite exceeds 8192-byte RPC limit: '+sprite.id);
 return source;
}
function decodeSource(kind,{python}={}){
 if(!['icons','atlas'].includes(kind))throw Error('Unsupported asset group');
 const interpreter=python||require('../../../../../../../core/platform/python.cjs').command(ROOT);
 const result=cp.spawnSync(interpreter,[path.join(__dirname,'canonical-visual-assets.py'),kind],{
  cwd:ROOT,encoding:'utf8',maxBuffer:1048576,timeout:20000,windowsHide:true,
 });
 if(result.error)throw result.error;
 if(result.status!==0)throw Error('Original art rasterization failed: '+(result.stderr||result.stdout).trim().slice(0,250));
 const rows=JSON.parse(result.stdout);
 if(!Array.isArray(rows)||rows.length>16)throw Error('Unexpected original art count');
 rows.forEach(spritePayload);
 return rows;
}
function parseAsset(reply){
 if(typeof reply!=='string'||!reply.startsWith('-> '))throw Error('Invalid asset RPC response');
 const match=/^IZ2S_ASSET_V1;state=(loaded|skipped|blocked)$/.exec(reply.slice(3).trim());
 if(!match)throw Error('Invalid visual asset response');
 return match[1];
}
async function upload(host,{port=9026,icons=true,atlas=true,send=request,read=decodeSource}={}){
 const kinds=[...(icons?['icons']:[]),...(atlas?['atlas']:[])],results=[];
 for(const kind of kinds){
  const rows=read(kind);
  for(const item of rows){
   const state=parseAsset(await send({host,port,lua:spritePayload(item),timeoutMs:15000}));
   results.push({id:item.id,state});
  }
 }
 return {backend:'balatro',mode:'original-iz2s-source-art',artCount:results.length,
  loaded:results.filter(x=>x.state==='loaded').length,
  skipped:results.filter(x=>x.state!=='loaded').length,
  results,installedPackagesVerified:false,nativeCoreReady:false,ready:false};
}
async function main(){
 const [host,kind='all',portRaw]=process.argv.slice(2);
 if(!host||!['all','icons','atlas'].includes(kind)){
  console.error('Usage: node canonical-visual-assets.cjs <switch-ip> [all|icons|atlas] [port]');
  process.exitCode=2;return;
 }
 try{
  const result=await upload(host,{port:portRaw?Number(portRaw):9026,icons:kind!=='atlas',atlas:kind!=='icons'});
  console.log(JSON.stringify(result,null,2));
  if(result.skipped)process.exitCode=1;
 }catch(e){console.error(JSON.stringify({backend:'balatro',state:'error',ready:false,error:e.message}));process.exitCode=1;}
}
if(require.main===module)main();
module.exports={ROOT,MAX_RPC,spritePayload,decodeSource,parseAsset,upload};
