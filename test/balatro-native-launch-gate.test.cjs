'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const crypto=require('node:crypto');
const path=require('node:path');
const {inspect,gate,BIN,MANIFEST,REQUIRED}=require('../engines/iz2s-core/runtime/installer/engine/switch2/balatro/native-launch-gate.cjs');
const sha=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
function fixture({corrupt=false,missing=false}={}){
 const bin=Buffer.from('canonical-launcher-fixture');
 const native=path.posix.dirname(path.posix.dirname(BIN));
 const sourcePath=path.posix.normalize(native+'/launcher.c');
 // The manifest must hash the SAME file contents used by REQUIRED markers.
 const source=Buffer.from(REQUIRED.find(([name])=>name===sourcePath)[1].join('\n'));
 const manifest={format:'iz-sd-launcher-native-v1',bytes:bin.length,sha256:sha(bin),
  layout:{owner:9200,status_bytes:9200,owner_bytes:2920},
  sources:{'launcher.c':sha(source)}};
 const data=new Map([[BIN,corrupt?Buffer.from('corrupted'):bin],
  [MANIFEST,Buffer.from(JSON.stringify(manifest))],
  [sourcePath,source]]);
 for(const [fileName,markers] of REQUIRED)
  data.set(fileName,Buffer.from(markers.join('\n')));
 if(missing)data.delete(sourcePath);
 return name=>{if(!data.has(name))throw Object.assign(Error('missing'),{code:'ENOENT'});return data.get(name);};
}
test('original launcher binary and source manifest are checked without executing the image',()=>{
 const result=inspect('/irrelevant',fixture());
 assert.equal(result.phase,'verified');
 assert.equal(result.sourceCount,1);
 assert.equal(result.filesChecked,2);
 assert.equal(result.failures.length,0);
 assert.equal(result.ready,false);
});
test('a mismatched native binary is rejected, not renamed into an IZ2S runtime',()=>{
 const result=inspect('/irrelevant',fixture({corrupt:true}));
 assert.equal(result.phase,'blocked');
 assert.equal(result.failures[0].path,BIN);
});
test('a missing manifest source is detected before native launch',()=>{
 const result=inspect('/irrelevant',fixture({missing:true}));
 assert.equal(result.phase,'blocked');
 assert.equal(result.failures.length,1);
});
test('canonical native launch remains blocked even when all artifacts are present',async()=>{
 const r=await gate({root:'/irrelevant',read:fixture(),
  telemetry:async()=>({legacy:'idle',launcher:'idle'})});
 assert.equal(r.phase,'artifacts-verified');
 assert.deepEqual(r.entryMethods,['smilebasic','balatro','civilization']);
 assert.equal(r.canonicalImplementation,BIN);
 assert.equal(r.originalLauncherExecuted,false);
 assert.equal(r.canonicalMenuReady,false);
 assert.equal(r.nativeTransportReady,false);
 assert.equal(r.filesystemSessionReady,false);
 assert.equal(r.ready,false);
});

test('fixture manifest reflects the same canonical source used by required markers',()=>{
 const good=inspect('/irrelevant',fixture());
 assert.equal(good.phase,'verified',JSON.stringify(good.failures));
 assert.equal(good.sourceIntegrityVerified,true);
 assert.equal(good.missingStartupMarkers.length,0);
});

test('a source whose bytes change without updating its manifest fails integrity',()=>{
 const original=fixture();
 const changed=name=>name.endsWith('/native/launcher.c')
  ?Buffer.from('altered native launcher')
  :original(name);
 const report=inspect('/irrelevant',changed);
 assert.equal(report.phase,'blocked');
 assert.ok(report.failures.some(row=>row.label==='manifest-source'));
 assert.ok(report.missingStartupMarkers.some(row=>row.file.endsWith('/native/launcher.c')));
});
