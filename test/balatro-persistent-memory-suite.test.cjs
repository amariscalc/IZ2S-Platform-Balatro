'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {verify}=require('../engines/iz2s-core/runtime/installer/engine/switch2/balatro/persistent-memory-suite.cjs');
function mock(){
 let next=1,registry=null;
 const ops=[];
 const call=async(host,op,args=[])=>{
  ops.push(op);
  const blocked=detail=>({op,state:'blocked',detail,value:0});
  const ok=value=>({op,state:'ok',detail:'none',value,ready:false});
  if(op==='init'){
   if(registry)return blocked('already_initialized');
   registry=new Map();
   return {op,state:'ok',detail:'initialized',value:0,ready:false};
  }
  if(!registry)return blocked('not_initialized');
  if(op==='clear'){registry=null;return ok(0);}
  if(op==='status')return ok([...registry.values()].reduce((sum,b)=>sum+b.length,0));
  if(op==='alloc'){
   const size=args[0];
   const used=[...registry.values()].reduce((sum,b)=>sum+b.length,0);
   if(!Number.isInteger(size)||size<1||size>128||registry.size>=4||used+size>512)
    return blocked('quota');
   const id=next++;
   registry.set(id,new Uint8Array(size));
   return ok(id);
  }
  if(op==='release'){
   if(!registry.has(args[0]))return blocked('stale_handle');
   registry.delete(args[0]);return ok([...registry.values()].reduce((sum,b)=>sum+b.length,0));
  }
  const d=registry.get(args[0]);
  if(!d)return blocked('stale_handle');
  if(op==='read'||op==='write'){
   if(args[1]>=d.length)return blocked('bounds');
   if(op==='write'){d[args[1]]=args[2];return ok(args[2]);}
   return ok(d[args[1]]);
  }
  if(op==='copy'){
   const source=registry.get(args[2]),len=args[3],off=args[1];
   if(!source)return blocked('stale_handle');
   if(off+len>d.length||len>source.length)return blocked('bounds');
   if(args[0]===args[2])return blocked('overlap_refused');
   d.set(source.slice(0,len),off);return ok(len);
  }
  throw Error('Unexpected op '+op);
 };
 return {call,ops};
}
test('persists owned handles across RPC requests and cleans up state',async()=>{
 const m=mock();
 const result=await verify('192.168.1.232',{},m.call);
 assert.equal(result.phase,'verified');
 assert.equal(result.persistentAcrossRpcConnections,true);
 assert.equal(result.boundsVerified,true);
 assert.equal(result.allocationQuotasVerified,true);
 assert.equal(result.handleCount,5);
 assert.equal(result.registryCleared,true);
 assert.equal(result.nativeTransportReady,false);
 assert.equal(result.ready,false);
 assert.equal(m.ops[0],'init');
 assert.equal(m.ops.at(-1),'status');
 assert.ok(m.ops.length>25);
});
test('initialization failure does not clear a registry owned by someone else',async()=>{
 let clearCalled=false;
 await assert.rejects(verify('192.168.1.232',{},async(host,op)=>{
  if(op==='clear')clearCalled=true;
  return {op,state:'blocked',detail:'already_initialized',value:0};
 }));
 assert.equal(clearCalled,false);
});
test('a verification failure causes explicit cleanup',async()=>{
 const m=mock();
 let corrupted=false;
 await assert.rejects(verify('192.168.1.232',{},async(host,op,args,options)=>{
  const out=await m.call(host,op,args,options);
  if(op==='read'&&out.state==='ok'&&!corrupted){corrupted=true;return {...out,value:254};}
  return out;
 }));
 assert.equal(m.ops.at(-1),'clear');
});
