'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {LUA,parse,inspect}=require('../engines/iz2s-core/runtime/installer/engine/switch2/balatro/sd-filesystem-provenance.cjs');
test('only read-only fixed LÖVE metadata operations, no SD privileges',()=>{
 assert.match(LUA,/getSaveDirectory/);
 assert.match(LUA,/getSourceBaseDirectory/);
 assert.match(LUA,/getRealDirectory/);
 assert.match(LUA,/launcher.iza/);
 assert.doesNotMatch(LUA,/getDirectoryItems|f\.mount\(|f\.write\(|f\.read\(|f\.remove\(|require\(|ffi|loadstring/);
 assert.ok(Buffer.byteLength(LUA)<8192);
});
test('a reported SD-like directory cannot be interpreted as verified physical access',()=>{
 const out=parse('-> IZ2S_SD_SURFACE_V1;save=private-like;source=sd-like;file=missing;real=missing;mount=1');
 assert.equal(out.sourceDirectoryClass,'sd-like');
 assert.equal(out.physicalSdReadVerified,false);
 assert.equal(out.sdMountedByProbe,false);
 assert.equal(out.ready,false);
});
test('one bounded RPC only',async()=>{
 let count=0;
 const res=await inspect('192.168.1.232',{send:async a=>{
  count++;assert.equal(a.timeoutMs,5000);
  return '-> IZ2S_SD_SURFACE_V1;save=opaque;source=opaque;file=missing;real=missing;mount=0';
 }});
 assert.equal(count,1);
 assert.equal(res.bookReaderVirtualFile,'missing');
});
