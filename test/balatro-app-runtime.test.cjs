'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const net=require('node:net');
const {COMMANDS,build,parse,execute}=require('../engines/iz2s-core/runtime/installer/engine/switch2/balatro/app-runtime.cjs');
test('fixed application command whitelist and bounded arguments',()=>{
  assert.deepEqual(COMMANDS,['ping','math','runtime']);
  assert.throws(()=>build('invoke'),/Unsupported/);
  for(const arg of [-1,100001,2.2,NaN,Infinity])assert.throws(()=>build('math',arg),/Math argument/);
});
test('generated code avoids memory, FFI, IPC and save access',()=>{
  for(const cmd of COMMANDS){
    const lua=build(cmd,cmd==='math'?12:undefined);
    assert.doesNotMatch(lua,/\bffi\b|\.invoke\s*\(|\bipc\b|filesystem|os\.|io\.|loadstring/);
    assert.match(lua,/IZ2S_APP_V1/);
  }
});
test('response requires matching operation and fields',()=>{
  assert.deepEqual(parse('-> IZ2S_APP_V1;command=ping;result=pong','ping').result,'pong');
  assert.throws(()=>parse('-> IZ2S_APP_V1;command=math;result=2','ping'),/mismatch/);
  assert.throws(()=>parse('-> IZ2S_APP_V1;command=ping;result=pong;ready=true','ping'),/Unexpected/);
});
test('end-to-end mocked command execution',async()=>{
  const server=net.createServer({allowHalfOpen:true},s=>{
    const chunks=[];
    s.on('data',b=>chunks.push(b));
    s.on('end',()=>{
      const code=Buffer.concat(chunks).toString();
      assert.equal(code,build('math',12));
      s.end('-> IZ2S_APP_V1;command=math;result=145');
    });
  });
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  try{
    const response=await execute('127.0.0.1','math',12,{port:server.address().port});
    assert.equal(response.result,'145');
    assert.equal(response.nativeCoreLaunched,false);
  } finally {await new Promise(resolve=>server.close(resolve));}
});
