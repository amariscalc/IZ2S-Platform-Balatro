'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const net=require('node:net');
const {LUA,parse,run}=require('../engines/iz2s-core/runtime/installer/engine/switch2/balatro/app-display.cjs');
test('fixed display code only uses existing Balatro logger',()=>{
 assert.match(LUA,/bl\.log/);
 assert.doesNotMatch(LUA,/love\.ffi|\.invoke\(|\.declare\(|filesystem|root-native|pm:shell|pm:dmnt/);
});
test('valid display acknowledgment does not imply native core',()=>{
 const result=parse('-> IZ2S_DISPLAY_V1;status=displayed\n');
 assert.equal(result.onConsole,true);
 assert.equal(result.nativeCoreLaunched,false);
 assert.equal(result.privilegedSessionVerified,false);
});
test('unsupported logger is an explicit non-success',()=>{
 const result=parse('-> IZ2S_DISPLAY_V1;status=unavailable');
 assert.equal(result.onConsole,false);
});
test('malformed reply is rejected',()=>{
 assert.throws(()=>parse('-> success'),/Unrecognized/);
});
test('display integration over mock Balatro RPC',async()=>{
 const server=net.createServer({allowHalfOpen:true},socket=>{
  const chunks=[];
  socket.on('data',b=>chunks.push(b));
  socket.on('end',()=>{
    assert.equal(Buffer.concat(chunks).toString(),LUA);
    socket.end('-> IZ2S_DISPLAY_V1;status=displayed');
  });
 });
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 try{
  const result=await run('127.0.0.1',{port:server.address().port});
  assert.equal(result.onConsole,true);
 } finally{await new Promise(resolve=>server.close(resolve));}
});
