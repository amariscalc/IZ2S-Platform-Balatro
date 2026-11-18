'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {STATE,parseState,run}=require('../engines/iz2s-core/runtime/installer/engine/switch2/balatro/menu-navigation.cjs');
function mockTransport({initiallyRunning=false,failAt=null}={}){
  const state={running:initiallyRunning,menu:1,page:'home',steps:0};
  const calls=[];
  const send=async({lua})=>{
    let op='unknown';
    if(lua===STATE)op='state';
    else {
      const match=lua.match(/local operation="(start|status|step|stop|up|down|select|back)"/);
      if(match)op=match[1];
    }
    calls.push(op);
    if(op===failAt)throw Error('Injected transport failure');
    if(op==='state')return state.running
      ? `-> IZ2S_MENU_V1;phase=running;menu=${state.menu};page=${state.page};steps=${state.steps}`
      : '-> IZ2S_MENU_V1;phase=idle';
    if(op==='start'){state.running=true;state.menu=1;state.page='home';state.steps=0;}
    if(op==='stop'){state.running=false;}
    if(state.running&&op==='down'){state.menu=(state.menu%5)+1;state.page='home';}
    if(state.running&&op==='select'){
      if(state.menu===1||state.menu===2)state.steps+=state.menu===1?1:5;
      else if(state.menu===3)state.page='status';
      else if(state.menu===4)state.page='about';
      else if(state.menu===5)state.running=false;
    }
    if(state.running&&op==='back')state.page='home';
    return state.running
      ? `-> IZ2S_SESSION_V1;phase=running;steps=${state.steps};id=balatro-lua-1;overlay=attached`
      : '-> IZ2S_SESSION_V1;phase=idle;steps=0;id=none;overlay=none';
  };
  return {send,state,calls};
}
test('strict state parser accepts only bounded known states',()=>{
  assert.deepEqual(parseState('-> IZ2S_MENU_V1;phase=idle'),{phase:'idle'});
  assert.deepEqual(parseState('-> IZ2S_MENU_V1;phase=running;menu=2;page=home;steps=5'),
    {phase:'running',menu:2,page:'home',steps:5});
  for(const bad of [
    'IZ2S_MENU_V1;phase=idle',
    '-> IZ2S_MENU_V1;phase=running;menu=6;page=home;steps=5',
    '-> IZ2S_MENU_V1;phase=running;menu=1;page=native;steps=0',
    '-> IZ2S_MENU_V1;phase=idle;extra=1',
  ])assert.throws(()=>parseState(bad));
});
test('navigates simulated menu over independent requests and cleans up',async()=>{
  const m=mockTransport();
  const result=await run('127.0.0.1',{},m.send);
  assert.equal(result.passed,true);
  assert.equal(result.states.updated.steps,5);
  assert.equal(result.states.status.page,'status');
  assert.equal(result.states.back.page,'home');
  assert.equal(result.ready,false);
  assert.equal(m.state.running,false);
  assert.equal(m.calls.at(-1),'stop');
});
test('refuses to alter an already running menu',async()=>{
  const m=mockTransport({initiallyRunning:true});
  await assert.rejects(run('127.0.0.1',{},m.send),/Existing Lua menu/);
  assert.deepEqual(m.calls,['state']);
  assert.equal(m.state.running,true);
});
test('transport failure after start triggers cleanup',async()=>{
  const m=mockTransport({failAt:'down'});
  await assert.rejects(run('127.0.0.1',{},m.send),/Injected transport failure/);
  assert.equal(m.calls.at(-1),'stop');
  assert.equal(m.state.running,false);
});
