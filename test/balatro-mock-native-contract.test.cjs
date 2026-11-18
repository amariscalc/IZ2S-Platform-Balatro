'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {createMock,SIZE,MAX_TRANSFER}=require('../engines/iz2s-core/runtime/installer/engine/switch2/balatro/mock-native-contract.cjs');

test('mock memory is isolated, bounded and copied',async()=>{
  const rpc=createMock();
  const original=Buffer.from([1,2,3,4]);
  assert.deepEqual(await rpc.write(20,original),{result:0});
  original.fill(0);
  const read=await rpc.read(20,4);
  assert.deepEqual([...read],[1,2,3,4]);
  read.fill(9);
  assert.deepEqual([...(await rpc.read(20,4))],[1,2,3,4]);
  assert.equal((await rpc.query(20)).simulated,true);
  assert.equal((await rpc.query(20)).permissions,3);
  assert.equal(rpc.snapshot().ready,false);
  rpc.close();
  await assert.rejects(rpc.read(20,4),/closed/);
});

test('mock arithmetic supports explicit harmless operation only',async()=>{
  const rpc=createMock();
  assert.equal(await rpc.call3('mock:add-u32',8,13),21);
  assert.equal(await rpc.call4('mock:add-u32',1,2),3);
  await assert.rejects(rpc.call3('native:arbitrary',1,2),/not supported/);
  await assert.rejects(rpc.call3('mock:add-u32',0xffffffff,1),/overflow/);
  assert.equal(rpc.snapshot().nativeCompatible,false);
  rpc.close();
});

test('invalid lengths, types and ranges are rejected',async()=>{
  const rpc=createMock();
  await assert.rejects(rpc.read(0,0),/out of bounds/);
  await assert.rejects(rpc.read(SIZE,1),/out of bounds/);
  await assert.rejects(rpc.read(0,MAX_TRANSFER+1),/out of bounds/);
  await assert.rejects(rpc.write(0,'not a Buffer'),/Expected Buffer/);
  await assert.rejects(rpc.query(SIZE),/out of bounds/);
  rpc.close();
});

test('privileged or native operations are unavailable by construction',async()=>{
  const rpc=createMock();
  for(const op of [
    rpc.verifyFunction(0,Buffer.from([1])),
    rpc.store64(0,1),
    rpc.batch([]),
    rpc.openService('ldr:ro'),
  ])await assert.rejects(op,/Not supported/);
  rpc.close();
  assert.equal(rpc.snapshot().ready,false);
});
