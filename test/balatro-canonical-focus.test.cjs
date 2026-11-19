'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {MODEL,TEMPLATE,VISUAL_BASE,VISUAL_SCENE,modelScript,parseModel,visualScript,parseVisual,script,parse,execute,OPS}=require('../engines/iz2s-core/runtime/installer/engine/switch2/balatro/canonical-focus.cjs');
const ROOT=path.resolve(__dirname,'..');
test('canonical focus Lua model ports the upstream layout constants and equations',()=>{
 const original=fs.readFileSync(path.join(ROOT,'engines/CivSwitch/launcher/app/shaders/focus-layout.glsl'),'utf8');
 const layout=fs.readFileSync(path.join(ROOT,'engines/CivSwitch/launcher/app/shaders/launcher-layout.glsl'),'utf8');
 for(const literal of ['850.0','1200.0','560.0','300.0','402.0','218.0','116.0']){
  assert.ok(original.includes(literal),'Upstream focus layout missing '+literal);
 }
 assert.match(MODEL,/local dx=x-850/);
 assert.match(MODEL,/local u=dx\/1200/);
 assert.match(MODEL,/402\+\(index-flow\)\*218/);
 assert.match(MODEL,/M\.maxInstalled=15/);
 assert.match(layout,/IZ_PAGE_SIZE=5u/);
 assert.match(MODEL,/M\.pageSize=5/);
 assert.match(MODEL,/213\/255/);
 assert.match(TEMPLATE,/NO VERIFIED APPLICATIONS/);
});
test('separate model and view payloads both fit inside the 8192-byte Lua RPC boundary',()=>{
 const model=modelScript();
 assert.ok(Buffer.byteLength(model)<=8192);
 assert.ok(model.includes('function M.railY'));
 assert.equal(parseModel('-> IZ2S_FOCUS_MODEL_V1;state=ready'),undefined);
 assert.throws(()=>parseModel('-> IZ2S_FOCUS_MODEL_V1;state=blocked'));
 for(const op of OPS){
  const code=script(op);
  assert.ok(Buffer.byteLength(code)<=8192,op);
  assert.ok(!code.includes('__MODEL_SOURCE__'));
  assert.ok(code.includes('__IZ2S_CANONICAL_FOCUS_MODEL_V1'));
 }
});
test('running focus state is a Lua view port, never a native supervisor',()=>{
 const r=parse('-> IZ2S_FOCUS_V1;phase=running;view=home;selected=0;installed=0;frames=128;inputs=4;errors=0;drawhook=0;inputhook=0;callbacks=0;consolecalls=0;consolefailures=0;packages=0;source=0','status');
 assert.equal(r.renderedFrames,128);
 assert.equal(r.drawHookInstalled,false);
 assert.equal(r.drawCallbacks,0);
 assert.equal(r.controllerEvents,4);
 assert.equal(r.installed,0);
 assert.equal(r.nativeSupervisorRunning,false);
 assert.equal(r.catalogVerified,false);
 assert.equal(r.ready,false);
});
test('empty picker and clean stop are represented without claiming installation',()=>{
 const r=parse('-> IZ2S_FOCUS_V1;phase=running;view=picker;selected=0;installed=0;frames=200;inputs=3;errors=0;drawhook=0;inputhook=0;callbacks=0;consolecalls=0;consolefailures=0;packages=0;source=0','select');
 assert.equal(r.view,'picker');
 assert.equal(parse('-> IZ2S_FOCUS_V1;phase=idle;view=none;selected=0;installed=0;frames=0;inputs=0;errors=0;drawhook=0;inputhook=0;callbacks=0;consolecalls=0;consolefailures=0;packages=0;source=0','stop').phase,'idle');
 assert.throws(()=>parse('-> IZ2S_FOCUS_V1;phase=running;view=home;selected=5;installed=0;frames=0;inputs=0;errors=0;drawhook=0;inputhook=0;callbacks=0;consolecalls=0;consolefailures=0;packages=0;source=0','status'));
});
test('fixed payload is sent once and never synthesizes fake catalogue',async()=>{
 let n=0;
 const r=await execute('192.168.1.232','status',{},async q=>{
  n++;assert.equal(q.port,9026);assert.equal(q.lua,script('status'));
  return '-> IZ2S_FOCUS_V1;phase=idle;view=none;selected=0;installed=0;frames=0;inputs=0;errors=0;drawhook=0;inputhook=0;callbacks=0;consolecalls=0;consolefailures=0;packages=0;source=0';
 });
 assert.equal(n,1);assert.equal(r.ready,false);
 assert.doesNotMatch(MODEL,/Foldrift|Cheese|Zelda|Doom/);
});

test('hook ownership and callback entry are distinct from rendered frames',()=>{
 const reply='-> IZ2S_FOCUS_V1;phase=running;view=home;selected=0;installed=0;frames=0;inputs=0;errors=0;drawhook=1;inputhook=1;callbacks=0;consolecalls=0;consolefailures=0;packages=0;source=0';
 const r=parse(reply,'status');
 assert.equal(r.drawHookInstalled,true);
 assert.equal(r.inputHookInstalled,true);
 assert.equal(r.drawCallbacks,0);
 assert.equal(r.renderedFrames,0);
 assert.equal(r.nativeSupervisorRunning,false);
});
test('the port cannot report hook ownership while idle or blocked',()=>{
 assert.throws(()=>parse('-> IZ2S_FOCUS_V1;phase=idle;view=none;selected=0;installed=0;frames=0;inputs=0;errors=0;drawhook=1;inputhook=0;callbacks=0;consolecalls=0;consolefailures=0;packages=0;source=0','status'));
});

test('console draw exceptions are separately reported without claiming native startup',()=>{
 const r=parse('-> IZ2S_FOCUS_V1;phase=running;view=home;selected=0;installed=0;frames=200;inputs=0;errors=0;drawhook=1;inputhook=1;callbacks=200;consolecalls=200;consolefailures=200;packages=0;source=0','status');
 assert.equal(r.consoleDrawCalls,200);
 assert.equal(r.consoleDrawFailures,200);
 assert.equal(r.renderedFrames,200);
 assert.equal(r.nativeSupervisorRunning,false);
});
test('source draws after protected console callback and does not install a pre-console love.draw hook',()=>{
 assert.match(TEMPLATE,/local worked,result=pcall\(old,\.\.\.\)/);
 assert.match(TEMPLATE,/app\.consoleCalls=/);
 assert.doesNotMatch(TEMPLATE,/love\.draw=app\.loveDrawHook/);
});

test('start stages model, original visual primitives and animated scene before menu hooks',async()=>{
 const calls=[];
 const reply='-> IZ2S_FOCUS_V1;phase=running;view=home;selected=0;installed=0;frames=0;inputs=0;errors=0;drawhook=1;inputhook=1;callbacks=0;consolecalls=0;consolefailures=0;packages=0;source=0';
 const result=await execute('192.168.1.232','start',{},async q=>{
  calls.push(q.lua);
  if(calls.length===1)return '-> IZ2S_FOCUS_MODEL_V1;state=ready';
  if(calls.length===2)return '-> IZ2S_VISUAL_V1;stage=base;ok=1';
  if(calls.length===3)return '-> IZ2S_VISUAL_V1;stage=scene;ok=1';
  return reply;
 });
 assert.equal(calls.length,4);
 assert.equal(calls[0],modelScript());
 assert.equal(calls[1],visualScript('base'));
 assert.equal(calls[2],visualScript('scene'));
 assert.equal(calls[3],script('start'));
 assert.equal(result.phase,'running');
 assert.equal(result.installed,0);
});
test('canonical picker draws real package-preview names, never fabricated installed apps',()=>{
 assert.match(TEMPLATE,/ipairs\(app\.catalog or \{\}\)/);
 assert.match(VISUAL_SCENE,/p\.name:sub\(1,23\)/);
 assert.match(VISUAL_SCENE,/a\.model\.selected==i-1/);
 assert.match(TEMPLATE,/NO VERIFIED PACKAGE SOURCE/);
});

test('PC preview picker navigation does not pretend packages were installed',()=>{
 const r=parse('-> IZ2S_FOCUS_V1;phase=running;view=picker;selected=3;installed=0;frames=12;inputs=4;errors=0;drawhook=1;inputhook=1;callbacks=12;consolecalls=12;consolefailures=0;packages=0;source=0','status');
 assert.equal(r.selected,3);
 assert.equal(r.installed,0);
 assert.equal(r.nativeSupervisorRunning,false);
});

test('picker detail shows a verified PC preview without installing it',()=>{
 const reply='-> IZ2S_FOCUS_V1;phase=running;view=detail;selected=2;installed=0;frames=450;inputs=8;errors=0;drawhook=1;inputhook=1;callbacks=450;consolecalls=450;consolefailures=0;packages=4;source=0';
 const state=parse(reply,'status');
 assert.equal(state.view,'detail');
 assert.equal(state.availablePackages,4);
 assert.equal(state.installed,0);
 assert.equal(state.nativeCoreReady,false);
 assert.match(VISUAL_SCENE,/PACKAGE DETAILS/);
 assert.match(VISUAL_SCENE,/PC PREVIEW - NOT INSTALLED/);
 assert.match(TEMPLATE,/app\.detail=app\.catalog and app\.catalog\[model\.selected\+1\]/);
 assert.throws(()=>parse(reply.replace('packages=4;source=0','packages=0;source=0'),'status'));
});

test('source-only entries cannot be reported as installable PC packages',()=>{
 const reply='-> IZ2S_FOCUS_V1;phase=running;view=detail;selected=1;installed=0;frames=5;inputs=3;errors=0;drawhook=1;inputhook=1;callbacks=5;consolecalls=5;consolefailures=0;packages=0;source=3';
 const state=parse(reply,'status');
 assert.equal(state.sourceCatalogEntries,3);
 assert.equal(state.availablePackages,0);
 assert.equal(state.installed,0);
 assert.match(VISUAL_SCENE,/SOURCE ONLY - NOT INSTALLABLE/);
 assert.throws(()=>parse(reply.replace('packages=0;source=3','packages=1;source=3'),'status'));
});
test('stop returns the full clean idle schema, including both catalog counts',()=>{
 const state=parse('-> IZ2S_FOCUS_V1;phase=idle;view=none;selected=0;installed=0;frames=0;inputs=0;errors=0;drawhook=0;inputhook=0;callbacks=0;consolecalls=0;consolefailures=0;packages=0;source=0','stop');
 assert.equal(state.phase,'idle');
 assert.equal(state.availablePackages,0);
 assert.equal(state.sourceCatalogEntries,0);
});

test('source-backed CivSwitch scene obeys 8 KiB RPC ceiling and preserves Lua fallback',()=>{
 for(const stage of ['base','scene'])assert.ok(Buffer.byteLength(visualScript(stage))<=8192);
 assert.match(VISUAL_BASE,/__IZ2S_FOCUS_VISUAL_V1/);
 assert.match(VISUAL_SCENE,/__IZ2S_FOCUS_SCENE_V1/);
 assert.match(VISUAL_SCENE,/SOURCE DESCRIPTOR SHA256/);
 assert.match(VISUAL_SCENE,/V\.icon\(g,a,p\.id/);
 assert.match(TEMPLATE,/if type\(scene\)=="function"/);
 assert.throws(()=>visualScript('unknown'));
 assert.throws(()=>parseVisual('-> IZ2S_VISUAL_V1;stage=scene;ok=0','scene'));
});
