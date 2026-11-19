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
