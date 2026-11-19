'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {LUA,parse,inspect}=require('../engines/iz2s-core/runtime/installer/engine/switch2/balatro/native-loader-surface.cjs');
const RESPONSE='-> IZ2S_LOADER_SURFACE_V1;ffi=1;sdk=1;getter=1;memcpy=1;graphics=1;filesystem=1;nro=0;native=0';
test('hardware surface probe reads bounded metadata without native side effects',()=>{
 assert.ok(Buffer.byteLength(LUA)<8192);
 for(const word of ['ffi.cast','ffi.new','native_ready(','declare(','require("ffi")','getService(','write(','loadNro('])
  assert.equal(LUA.includes(word),false,word);
});
test('title-local capabilities do not authorize original native application startup',()=>{
 const report=parse(RESPONSE);
 assert.equal(report.available.ffiDeclaration,true);
 assert.equal(report.available.loveGraphicsPresent,true);
 assert.equal(report.available.loveFilesystemPresent,true);
 assert.equal(report.available.iz2sNroModuleReported,false);
 assert.equal(report.nativeTransportReady,false);
 assert.equal(report.consoleSdFilesystemVerified,false);
 assert.equal(report.supervisorThreadVerified,false);
 assert.equal(report.originalBookReaderExecuted,false);
});
test('rejects forged success status and malformed replies',()=>{
 assert.throws(()=>parse(RESPONSE+';ready=1'));
 assert.throws(()=>parse('-> IZ2S_LOADER_SURFACE_V1;ffi=true'));
 assert.throws(()=>parse('IZ2S_LOADER_SURFACE_V1;ffi=1'));
});
test('live request uses only one fixed read-only Lua probe',async()=>{
 let calls=0;
 const report=await inspect('192.168.1.232',{send:async req=>{
  calls++;assert.equal(req.port,9026);assert.equal(req.lua,LUA);return RESPONSE;
 }});
 assert.equal(calls,1);
 assert.equal(report.available.sdkMemcpyOffset,true);
 assert.equal(report.addressableNativeRpcVerified,false);
});
