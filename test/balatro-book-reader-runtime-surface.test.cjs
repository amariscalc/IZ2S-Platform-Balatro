'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {LUA,parse,inspect}=require('../engines/iz2s-core/runtime/installer/engine/switch2/balatro/book-reader-runtime-surface.cjs');
const response=(values={})=> '-> IZ2S_READER_RUNTIME_V1;fsread='+(values.fsread??1)+
 ';fsinfo='+(values.fsinfo??1)+';fsreal='+(values.fsreal??0)+
 ';fsmount='+(values.fsmount??0)+';vfs='+(values.vfs??'missing')+
 ';draw='+(values.draw??1)+';present='+(values.present??1)+
 ';image='+(values.image??1)+';shader='+(values.shader??1)+
 ';dimensions='+(values.dimensions??'1280x720')+';thread='+(values.thread??0);

test('fixed Lua probe has no filesystem writes, native calls, loaders or dynamic addresses',()=>{
 assert.ok(Buffer.byteLength(LUA)>0&&Buffer.byteLength(LUA)<8192);
 assert.match(LUA,/iz2s\/modules\/book-reader\/launcher\.iza/);
 for(const fragment of ['require("ffi")','ffi.','native_ready(','declare(','getService(','openService(',
  'loadNro(','mapCode(','newThread(','fs.read(','f.read(','f.write(','f.mount(',
  'g.newImage(','g.newShader('])
  assert.equal(LUA.includes(fragment),false,fragment);
 assert.match(LUA,/pcall\(f\.getInfo/);
 assert.match(LUA,/pcall\(g\.getDimensions/);
});
test('realistic title interface observation remains non-authorizing',()=>{
 const r=parse(response());
 assert.equal(r.phase,'title-api-inventoried-native-entry-blocked');
 assert.equal(r.filesystem.readFunctionExposed,true);
 assert.equal(r.filesystem.titleVirtualPathObservation,'missing');
 assert.deepEqual(r.graphics.titleCanvasDimensions,{width:1280,height:720});
 assert.equal(r.graphics.originalVulkanOwnershipVerified,false);
 assert.equal(r.threading.originalSupervisorThreadVerified,false);
 assert.equal(r.nativeTransportReady,false);
 assert.equal(r.executedOnConsole,false);
 assert.equal(r.ready,false);
 assert.ok(r.missingNativePrerequisites.includes('filesystem'));
});
test('virtual filesystem path hit is not evidence of console SD ownership',()=>{
 const r=parse(response({vfs:'file',fsreal:1,fsmount:1,thread:1}));
 assert.equal(r.filesystem.titleVirtualPathObservation,'file');
 assert.equal(r.filesystem.consoleSdAccessVerified,false);
 assert.equal(r.threading.titleThreadFunctionExposed,true);
 assert.equal(r.threading.originalSupervisorThreadVerified,false);
 assert.equal(r.originalLauncherReady,false);
});
test('unsupported API calls stay explicitly unobserved',()=>{
 const r=parse(response({fsread:0,fsinfo:0,vfs:'unavailable',
  draw:0,present:0,image:0,shader:0,dimensions:'unavailable'}));
 assert.equal(r.filesystem.getInfoFunctionExposed,false);
 assert.equal(r.filesystem.titleVirtualPathObservation,'unavailable');
 assert.equal(r.graphics.titleCanvasDimensions,null);
 assert.equal(r.readOnly,true);
});
test('failed metadata calls cannot be represented as successful',()=>{
 const r=parse(response({vfs:'error',dimensions:'error'}));
 assert.equal(r.filesystem.titleVirtualPathObservation,'error');
 assert.equal(r.graphics.dimensionsObservation,'error');
 assert.equal(r.graphics.titleCanvasDimensions,null);
});
test('malformed or contradictory packets are rejected',()=>{
 assert.throws(()=>parse('IZ2S_READER_RUNTIME_V1;fsread=1'));
 assert.throws(()=>parse(response({fsinfo:0,vfs:'file'})),/Contradictory/);
 assert.throws(()=>parse(response({fsinfo:1,vfs:'unavailable'})),/Contradictory/);
 assert.throws(()=>parse(response({dimensions:'8193x720'})),/Unreasonable/);
 assert.throws(()=>parse(response()+';ready=1'));
 assert.throws(()=>parse(response({vfs:'SD:/iz2s'})));
});
test('live survey sends exactly one bounded immutable Lua RPC',async()=>{
 let called=0;
 const r=await inspect('192.168.1.232',{send:async packet=>{
  called++;
  assert.equal(packet.host,'192.168.1.232');
  assert.equal(packet.port,9026);
  assert.equal(packet.lua,LUA);
  assert.equal(packet.maxReplyBytes,2048);
  return response();
 }});
 assert.equal(called,1);
 assert.equal(r.rpcCalls,1);
});
test('refuses invalid hosts and ports before sending',async()=>{
 let called=0;
 const send=async()=>{called++;return response();};
 await assert.rejects(()=>inspect('',{send}));
 await assert.rejects(()=>inspect('192.168.1.232\nreturn 1',{send}));
 await assert.rejects(()=>inspect('192.168.1.232',{port:0,send}));
 assert.equal(called,0);
});
