'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const net=require('node:net');
const {PROBE,parse,report,audit}=require('../engines/iz2s-core/runtime/installer/engine/switch2/balatro/native-preflight.cjs');
const GOOD='-> bridge_table=true;declare_present=true;invoke_present=true;sdk_base_present=true';
test('preflight is introspection only, without FFI invoke or writes',()=>{
  assert.match(PROBE,/type\(bridge\.invoke\)/);
  assert.doesNotMatch(PROBE,/bridge\.invoke\s*\(/);
  assert.doesNotMatch(PROBE,/bridge\.declare\s*\(/);
  assert.doesNotMatch(PROBE,/openService|memory\.write|ldr:ro/);
});
test('strict parser accepts only four booleans',()=>{
  assert.equal(parse(GOOD).sdk_base_present,true);
  for(const invalid of [
    '-> bridge_table=true',GOOD+';extra=true',
    GOOD.replace('invoke_present=true','invoke_present=maybe'),
    GOOD.replace('invoke_present=true','invoke_present=true;invoke_present=true'),
    'bridge_table=true;declare_present=true;invoke_present=true;sdk_base_present=true',
  ])assert.throws(()=>parse(invalid));
});
test('reported availability never implies native readiness',()=>{
  const result=report(parse(GOOD));
  assert.equal(result.bridgeInterfaceReported,true);
  assert.equal(result.sdkInstructionVerification,'not-performed');
  assert.equal(result.nativeCallAttempted,false);
  assert.equal(result.nroLoadAttempted,false);
  assert.equal(result.iz2s.ready,false);
  assert.equal(result.iz2s.nativeOperationsVerified,false);
  assert.equal(result.iz2s.privilegedSessionVerified,false);
});
test('missing bridge does not imply readiness',()=>{
  const result=report(parse('-> bridge_table=false;declare_present=false;invoke_present=false;sdk_base_present=false'));
  assert.equal(result.bridgeInterfaceReported,false);
  assert.equal(result.iz2s.ready,false);
});
test('mock TCP RPC sends fixed preflight and preserves no-native-ready state',async()=>{
  const server=net.createServer({allowHalfOpen:true},socket=>{
    const chunks=[];
    socket.on('data',chunk=>chunks.push(chunk));
    socket.on('end',()=>{
      assert.equal(Buffer.concat(chunks).toString(),PROBE);
      socket.end(GOOD);
    });
  });
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  try{
    const result=await audit('127.0.0.1',{port:server.address().port});
    assert.equal(result.bridgeInterfaceReported,true);
    assert.equal(result.iz2s.ready,false);
  }finally{await new Promise(resolve=>server.close(resolve));}
});
