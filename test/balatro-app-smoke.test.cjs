'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const net=require('node:net');
const {LUA,parse,run}=require('../engines/iz2s-core/runtime/installer/engine/switch2/balatro/app-smoke.cjs');
const reply='-> IZ2S_BALATRO_SMOKE_OK;runtime=Lua 5.1;love=true;version_api=true';
test('fixed Lua application excludes privileged and filesystem operations',()=>{
 assert.doesNotMatch(LUA,/\.invoke\s*\(|\.declare\s*\(|require\s*\(|filesystem|os\.|io\.|ffi\./);
 assert.match(LUA,/IZ2S_BALATRO_SMOKE_OK/);
});
test('success distinguishes title Lua execution from native core launch',()=>{
 const res=parse(reply);
 assert.equal(res.executedInsideTitle,true);
 assert.equal(res.nativeIz2sLaunched,false);
 assert.equal(res.privilegedSessionVerified,false);
});
test('unrelated and incomplete replies fail closed',()=>{
 assert.throws(()=>parse('-> 5'),/did not complete/);
 assert.throws(()=>parse('-> IZ2S_BALATRO_SMOKE_OK;runtime=Lua 5.1'),/Incomplete/);
});
test('TCP transport uses write half-close and correct payload',async()=>{
 const server=net.createServer({allowHalfOpen:true},socket=>{
  const chunks=[];
  socket.on('data',b=>chunks.push(b));
  socket.on('end',()=>{assert.equal(Buffer.concat(chunks).toString(),LUA);socket.end(reply);});
 });
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 try{assert.equal((await run('127.0.0.1',{port:server.address().port})).loveAvailable,true);}
 finally{await new Promise(resolve=>server.close(resolve));}
});
