'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {run}=require('../engines/iz2s-core/runtime/installer/engine/switch2/balatro/native-stage.cjs');
const OK={backend:'balatro',bridgeCodeBytesVerified:true,
 signatureCompilerAccepted:true,nativeCallAttempted:false,ready:false};
const DECLARED={backend:'balatro',closureConstructed:true,
 nativeFunctionCalled:false,ready:false};
test('staging runs preflight before constructing no-call SDK declaration',async()=>{
 const calls=[];
 const result=await run('192.168.1.232',{},
  async()=>{calls.push('preflight');return OK;},
  async()=>{calls.push('declaration');return DECLARED;});
 assert.deepEqual(calls,['preflight','declaration']);
 assert.equal(result.phase,'declared-only');
 assert.equal(result.nativeCoreReady,false);
 assert.equal(result.nativeFunctionCalled,false);
 assert.equal(result.ready,false);
});
test('unknown image fails before declaration',async()=>{
 let called=false;
 const result=await run('192.168.1.232',{},
  async()=>({...OK,bridgeCodeBytesVerified:false}),
  async()=>{called=true;return DECLARED;});
 assert.equal(result.phase,'blocked');
 assert.equal(result.reason,'upstream-bridge-preflight');
 assert.equal(called,false);
});
test('ABI compiler failure prevents declaration',async()=>{
 let called=false;
 const result=await run('192.168.1.232',{},
  async()=>({...OK,signatureCompilerAccepted:false}),
  async()=>{called=true;return DECLARED;});
 assert.equal(result.phase,'blocked');
 assert.equal(called,false);
});
test('missing declaration is never interpreted as native readiness',async()=>{
 const result=await run('192.168.1.232',{},async()=>OK,
  async()=>({...DECLARED,closureConstructed:false}));
 assert.equal(result.phase,'blocked');
 assert.equal(result.nativeCoreReady,false);
 assert.equal(result.ready,false);
});
