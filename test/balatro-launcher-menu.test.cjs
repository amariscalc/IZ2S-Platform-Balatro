'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {OPS,TEMPLATE,script,parse,execute}=require('../engines/iz2s-core/runtime/installer/engine/switch2/balatro/launcher-menu.cjs');
const reply=(phase,menu,page,overlay=false,controls=false)=>
 `-> IZ2S_LAUNCHER_V1;phase=${phase};menu=${menu};page=${page};overlay=${overlay};controls=${controls}`;
test('fixed launcher template exposes six menu entries and controller mapping',()=>{
 assert.equal(OPS.length,7);
 assert.ok(Buffer.byteLength(script('start'))<=8192);
 assert.match(TEMPLATE,/DASHBOARD/);
 assert.match(TEMPLATE,/BALATRO RPC/);
 assert.match(TEMPLATE,/MEMORY STATUS/);
 assert.match(TEMPLATE,/NATIVE STATUS/);
 assert.match(TEMPLATE,/ABOUT/);
 assert.match(TEMPLATE,/EXIT/);
 assert.match(TEMPLATE,/gamepadpressed/);
 assert.match(TEMPLATE,/dpup="up"/);
 assert.match(TEMPLATE,/dpdown="down"/);
 assert.match(TEMPLATE,/a="select"/);
 assert.match(TEMPLATE,/b="back"/);
 assert.doesNotMatch(TEMPLATE,/love\.ffi\.declare|ldr:ro|openService|loadNro/);
 assert.throws(()=>script('loadNro'));
});
test('response parsing never claims native core and rejects inconsistent states',()=>{
 const started=parse(reply('running',1,'home',true,true),'start');
 assert.equal(started.phase,'running');
 assert.equal(started.overlay,true);
 assert.equal(started.nativeCoreReady,false);
 assert.equal(started.ready,false);
 assert.equal(parse(reply('running',4,'native',true,true),'status').page,'native');
 assert.equal(parse(reply('idle',0,'none'),'stop').phase,'idle');
 for(const r of [
  reply('running',0,'home'),
  reply('running',2,'none'),
  reply('idle',1,'none'),
  reply('idle',0,'home'),
  reply('running',7,'home'),
  reply('running',1,'home')+';ready=true'
 ])assert.throws(()=>parse(r,'status'));
 assert.throws(()=>parse(reply('running',1,'home'),'stop'));
});
test('single launcher RPC is fixed and properly bounded',async()=>{
 let requested;
 const result=await execute('192.168.1.232','start',{},async options=>{
  requested=options;
  return reply('running',1,'home',true,true);
 });
 assert.equal(result.phase,'running');
 assert.equal(requested.port,9026);
 assert.equal(requested.lua,script('start'));
 assert.equal(result.nativeCoreLaunched,false);
});

test('legacy menu conflict refuses launcher startup without installing hooks',()=>{
 const blocked=parse(reply('blocked',0,'legacy',false,false),'start');
 assert.equal(blocked.phase,'blocked');
 assert.equal(blocked.nativeCoreLaunched,false);
 assert.equal(blocked.ready,false);
 assert.match(TEMPLATE,/rawget\(_G,"__IZ2S_BALATRO_APP_V1"\)/);
 assert.match(TEMPLATE,/phase=blocked;menu=0;page=legacy/);
 assert.throws(()=>parse(reply('blocked',0,'legacy',false,false),'status'));
});
test('dynamic dashboard reads owned buffers and FFI presence without claiming IPC',()=>{
 assert.match(TEMPLATE,/OWNED REGISTRY:/);
 assert.match(TEMPLATE,/REGISTRY DATA:/);
 assert.match(TEMPLATE,/type\(love\.ffi\)/);
 assert.match(TEMPLATE,/PROCESS IPC \/ NRO: NOT VERIFIED/);
 assert.doesNotMatch(TEMPLATE,/ffi\.cast\(|ffi\.new\(|love\.ffi\.declare/);
});
