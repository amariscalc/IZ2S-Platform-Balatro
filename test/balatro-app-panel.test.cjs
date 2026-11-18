'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {create}=require('../panel/balatro-app.cjs');
test('panel app actions validate private LAN address and allowlisted operations',async()=>{
 const calls=[];
 const app=create({run:async(...args)=>{calls.push(args);return {phase:'running',steps:5};}});
 assert.equal((await app.action({host:'192.168.1.232',operation:'step',value:5})).steps,5);
 assert.equal(calls[0][3].port,9026);
 await assert.rejects(app.action({host:'8.8.8.8',operation:'start'}),/private LAN/);
 await assert.rejects(app.action({host:'192.168.1.232',operation:'eval'}),/Unknown/);
 await assert.rejects(app.action({host:'192.168.1.232',operation:'step',value:999}),/fixed five-step/);
 await assert.rejects(app.action({host:'192.168.1.232',operation:'start',value:5}),/Unexpected/);
});
test('panel serializes application commands, releases lock on completion',async()=>{
 let release;
 const app=create({run:()=>new Promise(resolve=>{release=resolve;})});
 const pending=app.action({host:'192.168.1.232',operation:'start'});
 await assert.rejects(app.action({host:'192.168.1.232',operation:'status'}),/already in progress/);
 release({phase:'running'});
 await pending;
});
test('panel releases command lock after failure',async()=>{
 let calls=0;
 const app=create({run:async()=>{calls++;throw Error('offline');}});
 await assert.rejects(app.action({host:'192.168.1.232',operation:'status'}),/offline/);
 await assert.rejects(app.action({host:'192.168.1.232',operation:'status'}),/offline/);
 assert.equal(calls,2);
});

test('fixed navigation actions accepted, extra arguments rejected',async()=>{
 const calls=[];
 const s=create({run:async(...args)=>{calls.push(args);return {phase:'running'};}});
 for(const operation of ['up','down','select','back'])
  await s.action({host:'192.168.1.232',operation});
 assert.deepEqual(calls.map(a=>a[1]),['up','down','select','back']);
 await assert.rejects(s.action({host:'192.168.1.232',operation:'select',value:1}),/Unexpected/);
});
