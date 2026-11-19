'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {validate,readCatalog,payload,parse,publish}=require('../engines/iz2s-core/runtime/installer/engine/switch2/balatro/canonical-catalog.cjs');
const HASH='a'.repeat(64);
const realPreview={id:'sample-preview',name:'Example App',version:'1.0',sha256:HASH};
test('only source-backed, unique validated package preview records are allowed',()=>{
 const rows=validate([realPreview]);
 assert.deepEqual(rows,[realPreview]);
 assert.throws(()=>validate([{...realPreview,id:'../../escape'}]));
 assert.throws(()=>validate([realPreview,realPreview]));
 assert.throws(()=>validate([{...realPreview,sha256:'0'}]));
 assert.throws(()=>validate(Array.from({length:17},(_,i)=>({...realPreview,id:'sample'+i}))));
});
test('catalog uses original repository inventory and validated PC preview API',async()=>{
 const order=[];
 const result=await readCatalog({root:'/tmp/iz2s-fixture',createRepository:async(root,opts)=>{
  assert.equal(root,'/tmp/iz2s-fixture');
  assert.equal(opts.shell,'izlauncher');
  assert.equal(opts.source,'current');
  return {
   list:async()=>{order.push('list');return {packages:[]};},
   previewApps:async(folder,options)=>{
    order.push('preview');assert.ok(folder.endsWith('balatro-catalog-preview'));
    assert.deepEqual(options.listing,{packages:[]});
    return {packages:[realPreview],rejected:[]};
   }
  };
 }});
 assert.deepEqual(order,['list','preview']);
 assert.deepEqual(result.packages,[realPreview]);
 assert.equal(result.source,'iz2s-pc-library-preview');
});
test('Lua publication has bounded payload and cannot execute or install',()=>{
 const source=payload([realPreview]);
 assert.ok(Buffer.byteLength(source)<=8192);
 assert.ok(source.includes('Example App'));
 assert.ok(source.includes(HASH));
 assert.match(source,/a\.model\.pickerCount=#rows/);
 assert.doesNotMatch(source,/ipc|loadNro|installModule|startCore/);
 assert.deepEqual(parse('-> IZ2S_CATALOG_V1;state=loaded;count=1',1).availablePackages,1);
 assert.throws(()=>parse('-> IZ2S_CATALOG_V1;state=loaded;count=2',1));
 assert.throws(()=>parse('-> IZ2S_CATALOG_V1;state=loaded;count=1;native=true',1));
});
test('publish sends only validated PC preview, not a fabricated SD catalog',async()=>{
 let count=0;
 const result=await publish('192.168.1.232',{
  root:'/tmp/iz2s-fixture',
  createRepository:async()=>({
   list:async()=>({packages:[]}),
   previewApps:async()=>({packages:[realPreview],rejected:[{file:'bad',error:'invalid'}]}),
  }),
  send:async req=>{
   count++;assert.equal(req.port,9026);
   assert.equal(req.host,'192.168.1.232');
   assert.ok(req.lua.includes('sample-preview'));
   return '-> IZ2S_CATALOG_V1;state=loaded;count=1';
  },
 });
 assert.equal(count,1);
 assert.equal(result.rejected,1);
 assert.equal(result.installedPackagesVerified,false);
 assert.equal(result.nativeApplicationLaunchAvailable,false);
 assert.equal(result.ready,false);
});
