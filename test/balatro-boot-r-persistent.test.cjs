'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const base='../engines/iz2s-core/runtime/installer/engine/switch2/balatro/';
const {stage,UPSTREAM_SHA,MAIN_APPEND}=require(base+'boot-r-persistent-stage.cjs');
test('R gate is visual only, time bounded, and guarded',()=>{
 const l=fs.readFileSync(path.join(__dirname,base,'boot-r-persistent.lua'),'utf8');
 assert.match(l,/isGamepadDown\("rightshoulder"\)/);
 assert.match(l,/now-state\.started>5/);
 assert.match(l,/require\("iz2s\.focus"\)/);
 assert.doesNotMatch(l,/ffi\.|debug\.setupvalue|fiber_switch|ctx_restore|os\.execute|filesystem\.write/);
});
test('original entry preserved behind error-handled optional module',()=>{
 assert.match(MAIN_APPEND,/__iz2s_previous_load\(\.\.\.\)/);
 assert.match(MAIN_APPEND,/pcall\(require,"iz2s\.rboot"\)/);
 assert.match(MAIN_APPEND,/pcall\(selector\.install\)/);
 assert.equal(UPSTREAM_SHA.length,64);
});
test('modified main rejects before any output is written',()=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'iz2s-rgate-'));
 try{
  fs.writeFileSync(path.join(root,'main.lua'),'function love.load() end');
  assert.throws(()=>stage(root,path.join(root,'out')),/Refusing/);
  assert.equal(fs.existsSync(path.join(root,'out')),false);
 }finally{fs.rmSync(root,{recursive:true,force:true})}
});
