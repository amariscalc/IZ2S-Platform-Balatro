'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {OPS,KEY,script,parse}=require('../engines/iz2s-core/runtime/installer/engine/switch2/balatro/app-session.cjs');
test('session has only four fixed lifecycle operations',()=>{
 assert.deepEqual(OPS,['start','status','step','stop']);
 assert.throws(()=>script('eval'),/Unsupported/);
 assert.throws(()=>script('step',0),/step value/);
 assert.throws(()=>script('step',1001),/step value/);
 assert.throws(()=>script('step',1.5),/step value/);
});
test('application state persists through raw Lua globals, not filesystem',()=>{
 const start=script('start');
 const status=script('status');
 assert.match(start,/rawset\(_G,KEY,app\)/);
 assert.match(status,/rawget\(_G,KEY\)/);
 assert.match(script('stop'),/rawset\(_G,KEY,nil\)/);
 assert.ok(start.includes(KEY));
 for(const op of OPS)assert.doesNotMatch(script(op,op==='step'?2:undefined),
   /love\.ffi|ffi\.|\.invoke\(|\.declare\(|love\.filesystem|pm:shell|pm:dmnt|loadstring|os\.execute/);
});
test('parse bounded running and idle replies, never native ready',()=>{
 const r=parse('-> IZ2S_SESSION_V1;phase=running;steps=4;id=balatro-lua-1\n');
 assert.equal(r.phase,'running');
 assert.equal(r.steps,4);
 assert.equal(r.nativeCoreLaunched,false);
 assert.equal(r.privilegedSessionVerified,false);
 assert.equal(parse('-> IZ2S_SESSION_V1;phase=idle;steps=0;id=none').phase,'idle');
});
test('reject inconsistent and spurious status fields',()=>{
 for(const s of [
  '-> IZ2S_SESSION_V1;phase=running;steps=1;id=none',
  '-> IZ2S_SESSION_V1;phase=idle;steps=2;id=none',
  '-> IZ2S_SESSION_V1;phase=running;steps=1;id=balatro-lua-1;ready=true',
  '-> IZ2S_SESSION_V1;phase=running;steps=-1;id=balatro-lua-1',
  '-> error',
 ])assert.throws(()=>parse(s));
});
