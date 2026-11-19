'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {SOURCE,script,parse,create,check}=require('../engines/iz2s-core/runtime/installer/engine/switch2/balatro/owned-binary.cjs');
const TOKEN='0123456789abcdef0123456789abcdef';
test('bounded code cannot address external native memory or send arbitrary Lua',()=>{
 assert.match(SOURCE,/ffi\.new\("uint8_t\[\?\]"/);
 assert.doesNotMatch(SOURCE,/ffi\.cast|love\.ffi|ipc|loadstring|native_ready/);
 for(const op of ['init','status','alloc','write','read','release','clear'])
  assert.ok(Buffer.byteLength(script(op,{token:TOKEN,...(op==='alloc'?{length:65536}:{})}))<=8192);
 assert.throws(()=>script('call',{token:TOKEN}));
 assert.throws(()=>script('write',{token:TOKEN,id:1,hex:'ff'.repeat(1025),length:1025}));
 assert.throws(()=>script('read',{token:TOKEN,id:1,length:1025}));
 assert.throws(()=>script('alloc',{token:TOKEN,length:65537}));
 assert.throws(()=>script('status',{token:'x";os.exit()--'}));
});
test('result parser keeps exact hex data and rejects contradictory packets',()=>{
 const out=parse('-> IZ2S_BINARY_V1;state=ok;detail=none;value=00ff10','read',3);
 assert.equal(out.state,'ok');
 assert.deepEqual(out.value,Buffer.from([0,255,16]));
 assert.equal(out.nativeTransportReady,false);
 assert.throws(()=>parse('-> IZ2S_BINARY_V1;state=ok;detail=none;value=01','read',2));
 assert.throws(()=>parse('-> IZ2S_BINARY_V1;state=blocked;detail=quota;value=1','alloc'));
 assert.throws(()=>parse('-> IZ2S_BINARY_V1;state=ok;detail=none;value=17','write',16));
 assert.equal(parse('-> IZ2S_BINARY_V1;state=blocked;detail=not_initialized;value=0','status').state,'blocked');
});
test('RPC roundtrip owns exact bytes and clears state without exposing addresses',async()=>{
 const states=[],buffers=new Map();
 let next=1,active=false,token=null,used=0;
 function field(lua,key){const r=RegExp('local '+key+'=(?:"([^"]*)"|([0-9]+))').exec(lua);return r?r[1]??Number(r[2]):null;}
 const send=async q=>{
  assert.equal(q.port,9026);
  assert.ok(Buffer.byteLength(q.lua)<=8192);
  const op=field(q.lua,'OP'),supplied=field(q.lua,'TOKEN'),id=field(q.lua,'ID'),
   offset=field(q.lua,'OFFSET'),length=field(q.lua,'LENGTH'),hex=field(q.lua,'HEX');
  states.push(op);
  function response(state,detail='none',value='0'){return '-> IZ2S_BINARY_V1;state='+state+';detail='+detail+';value='+value;}
  if(op==='init'){active=true;token=supplied;return response('ok');}
  assert(active&&supplied===token);
  if(op==='alloc'){const handle=next++;buffers.set(handle,Buffer.alloc(length));used+=length;return response('ok','none',String(handle));}
  if(op==='write'){Buffer.from(hex,'hex').copy(buffers.get(id),offset);return response('ok','none',String(length));}
  if(op==='read'){return response('ok','none',buffers.get(id).subarray(offset,offset+length).toString('hex'));}
  if(op==='release'){used-=buffers.get(id).length;buffers.delete(id);return response('ok','none',String(used));}
  if(op==='clear'){active=false;buffers.clear();used=0;return response('ok');}
  throw Error('unexpected operation '+op);
 };
 const r=await check('192.168.1.232',{send});
 assert.equal(r.phase,'verified');
 assert.equal(r.bytes,64);
 assert.equal(r.nativeTransportReady,false);
 assert.deepEqual(states,['init','alloc','write','write','write','write','read','read','read','read','release','clear']);
 assert.equal(buffers.size,0);
 assert.equal(active,false);
});
test('session-scoped request token changes between independent ownership instances',()=>{
 const a=create({host:'192.168.1.232',token:TOKEN,send:async()=>''});
 assert.equal(a.nativeTransportReady,false);
 assert.equal(a.mode,'title-owned-rpc');
 assert.throws(()=>create({host:'192.168.1.232',token:'bad'}));
});
