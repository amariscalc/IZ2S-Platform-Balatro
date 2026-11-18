'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {create}=require('../panel/balatro-app.cjs');
test('panel dispatch preserves whitelisted Lua menu operations',async()=>{
 const calls=[];
 const panel=create({run:async(...args)=>{calls.push(args);return {phase:'running'};}});
 assert.equal((await panel.action({host:'192.168.1.232',operation:'start'})).phase,'running');
 assert.equal((await panel.action({host:'192.168.1.232',operation:'step',value:5})).phase,'running');
 assert.deepEqual(calls.map(x=>x[1]),['start','step']);
 assert.equal(calls[0][3].port,9026);
});
test('panel rejects invalid hosts and native operation names',async()=>{
 const panel=create({run:async()=>{throw Error('should not run');}});
 for(const input of [
  {host:'8.8.8.8',operation:'start'},
  {host:'192.168.1.232',operation:'loadNro'},
  {host:'192.168.1.232',operation:'startCore'},
  {host:'192.168.1.232',operation:'step',value:6},
 ]){
  await assert.rejects(panel.action(input));
 }
});
test('panel disallows overlapping application actions',async()=>{
 let release;
 const panel=create({run:()=>new Promise(r=>{release=r;})});
 const first=panel.action({host:'192.168.1.232',operation:'status'});
 await assert.rejects(panel.action({host:'192.168.1.232',operation:'start'}),/already in progress/);
 release({phase:'running'});
 await first;
});
