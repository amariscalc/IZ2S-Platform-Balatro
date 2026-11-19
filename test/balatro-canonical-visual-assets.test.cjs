'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {spritePayload,parseAsset,upload,MAX_RPC}=require('../engines/iz2s-core/runtime/installer/engine/switch2/balatro/canonical-visual-assets.cjs');
function icon(id='blitbun'){
 return {id,format:'rgba4444',w:40,h:40,data:'f0ff'.repeat(1600)};
}
function glyph(id='type-title',w=458,h=59){
 return {id,format:'alpha1',w,h,data:'f'.repeat(Math.ceil(w*h/4))};
}
test('real icon geometry fits one title-local Lua RPC and stores ImageData, not GPU state',()=>{
 const p=spritePayload(icon());
 assert.ok(Buffer.byteLength(p)<=MAX_RPC);
 assert.match(p,/a\.sprites/);
 assert.match(p,/setPixel/);
 assert.doesNotMatch(p,/graphics\.newImage/);
 assert.match(p,/state="\.\.\(ok and "loaded" or "skipped"\)/);
});
test('largest source type glyph and ADD art remain bounded',()=>{
 for(const x of [glyph(),glyph('type-add',402,60),glyph('type-browse',314,22)]){
  const p=spritePayload(x);
  assert.ok(Buffer.byteLength(p)<=MAX_RPC,x.id);
  assert.ok(p.includes(x.id));
 }
});
test('untrusted or malformed graphics data are rejected',()=>{
 assert.throws(()=>spritePayload({...icon(),id:'../../sd'}));
 assert.throws(()=>spritePayload({...icon(),data:'x'.repeat(6400)}));
 assert.throws(()=>spritePayload({...icon(),w:200}));
 assert.throws(()=>spritePayload({...glyph(),format:'invalid'}));
 assert.throws(()=>parseAsset('-> IZ2S_ASSET_V1;state=loaded;native=true'));
 assert.equal(parseAsset('-> IZ2S_ASSET_V1;state=skipped'),'skipped');
});
test('artwork is published exclusively to Balatro and cannot claim native readiness',async()=>{
 const calls=[];
 const r=await upload('192.168.1.232',{
  read:kind=>kind==='icons'?[icon()]:[glyph('type-browse',314,22)],
  send:async q=>{calls.push(q);return '-> IZ2S_ASSET_V1;state=loaded';},
 });
 assert.equal(calls.length,2);
 assert.equal(r.loaded,2);
 assert.equal(r.skipped,0);
 assert.equal(r.nativeCoreReady,false);
 assert.equal(r.installedPackagesVerified,false);
 assert.ok(calls.every(x=>x.port===9026&&Buffer.byteLength(x.lua)<=MAX_RPC));
});

test('real repository art converter needs no Pillow and emits bounded source sprites',t=>{
 const fs=require('node:fs');
 const cp=require('node:child_process');
 const path=require('node:path');
 const root=path.resolve(__dirname,'..');
 const script=path.join(root,'engines/iz2s-core/runtime/installer/engine/switch2/balatro/canonical-visual-assets.py');
 const code=fs.readFileSync(script,'utf8');
 assert.doesNotMatch(code,/from PIL|import PIL|ImageOps/);
 assert.match(code,/import zlib/);
 assert.match(code,/alpha1/);
 const python=require('../core/platform/python.cjs').command(root);
 const probe=cp.spawnSync(python,['--version'],{encoding:'utf8',timeout:3000,windowsHide:true});
 if(probe.error||probe.status!==0){t.skip('Python is not present on this host');return;}
 for(const kind of ['icons','atlas']){
  const run=cp.spawnSync(python,[script,kind],{encoding:'utf8',timeout:20000,maxBuffer:1048576,windowsHide:true});
  assert.equal(run.status,0,kind+': '+(run.stderr||run.error||''));
  const rows=JSON.parse(run.stdout);
  assert.equal(rows.length,kind==='icons'?6:9,kind+': '+run.stderr);
  for(const item of rows)assert.ok(Buffer.byteLength(spritePayload(item))<=8192,item.id);
 }
});
