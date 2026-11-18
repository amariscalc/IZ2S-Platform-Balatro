#!/usr/bin/env node
'use strict';
// Audit the ORIGINAL native IZ2S launcher. This file never executes native
// code, writes console memory, invokes IPC, or starts the diagnostic overlay.
const fs=require('node:fs');
const path=require('node:path');
const crypto=require('node:crypto');
const {assess}=require('./readiness-gap.cjs');
const ROOT=path.resolve(__dirname,'../../../../../../../');
const BASE='core/console/sd-launcher';
const BIN=BASE+'/native/build/launcher.bin';
const MANIFEST=BASE+'/native/build/manifest.json';
const REQUIRED=Object.freeze([
 ['core/console/sd-launcher/bootstrap.cjs',[
   'prepare-sd.cjs','ensureInstalled','attachGame','new a.Session',
   'launcher.bin','work.ipc','supervisor'
 ]],
 ['core/console/sd-launcher/runtime.cjs',[
   'bootstrap.cjs','rescanWhenIdle','supervisor.status()'
 ]],
 ['core/console/sd-launcher/native/launcher.c',[
   '#include "directory.h"','menu_selection','MENU_SD','MENU_MIXED'
 ]],
 ['core/console/sd-launcher/mixed-menu.cjs',[
   'host_display_request','host_display_release','host_frames_offer'
 ]],
]);
function digest(buf){return crypto.createHash('sha256').update(buf).digest('hex');}
function inspect(root=ROOT,read=name=>fs.readFileSync(path.join(root,name))){
 let manifest;
 try{manifest=JSON.parse(read(MANIFEST).toString('utf8'));}
 catch(e){return {phase:'blocked',blocker:'manifest-unavailable',error:e.message};}
 if(manifest.format!=='iz-sd-launcher-native-v1'||
   !/^[a-f0-9]{64}$/.test(manifest.sha256)||
   !Number.isSafeInteger(manifest.bytes)||manifest.bytes<1||
   !manifest.sources||typeof manifest.sources!=='object'||
   !manifest.layout||manifest.layout.owner!==manifest.layout.status_bytes)
  return {phase:'blocked',blocker:'invalid-manifest'};
 const results=[],base=path.posix.dirname(BIN);
 function file(label,location,expected){
  try{const buf=read(location);const actual=digest(buf);
   const valid=actual===expected;results.push({label,path:location,valid,
    bytes:buf.length,...(!valid?{expected,actual}:{})});
   return valid;
  }catch(e){results.push({label,path:location,valid:false,error:e.code||'read-failed'});return false;}
 }
 let consistent=true;
 try{const bin=read(BIN);consistent=bin.length===manifest.bytes&&digest(bin)===manifest.sha256;
  results.push({label:'canonical-native-launcher',path:BIN,valid:consistent,bytes:bin.length,
   ...(!consistent?{expectedBytes:manifest.bytes,expectedSha256:manifest.sha256}:{})});
 }catch(e){consistent=false;results.push({label:'canonical-native-launcher',path:BIN,valid:false,error:e.code||'read-failed'});}
 // Manifest source paths are relative to native/, not native/build/.
 const native=BASE+'/native';
 const sources=Object.entries(manifest.sources);
 for(const [relative,hash] of sources){
  if(!/^[a-zA-Z0-9_./-]+$/.test(relative)||relative.startsWith('/')||
     !/^[a-f0-9]{64}$/.test(hash)){consistent=false;results.push({label:'source',path:relative,valid:false,error:'invalid-source-entry'});continue;}
  const normalized=path.posix.normalize(native+'/'+relative);
  if(!normalized.startsWith('core/console/')||
     !file('manifest-source',normalized,hash))consistent=false;
 }
 const dependencies=REQUIRED.map(([fileName,markers])=>{
  try{const body=read(fileName).toString('utf8');
   const missing=markers.filter(marker=>!body.includes(marker));
   return {file:fileName,valid:missing.length===0,missing};
  }catch(e){return {file:fileName,valid:false,error:e.code||'read-failed'};}
 });
 if(dependencies.some(d=>!d.valid))consistent=false;
 return {phase:consistent?'verified':'blocked',
  mode:'canonical-native-launcher-artifact-audit',
  binaryPath:BIN,manifestPath:MANIFEST,
  sourceCount:sources.length,sourceIntegrityVerified:consistent,
  filesChecked:results.length,
  failures:results.filter(f=>!f.valid),
  missingStartupMarkers:dependencies.filter(d=>!d.valid),
  manifestLayout:{statusBytes:manifest.layout.status_bytes,
   ownerBytes:manifest.layout.owner_bytes,
   imageCount:manifest.layout.image_count??null},
  ready:false};
}
async function gate({root=ROOT,read,telemetry}={}){
 const artifact=inspect(root,read);
 const gap=assess();
 let title=null;
 if(typeof telemetry==='function')title=await telemetry();
 return {backend:'balatro',mode:'canonical-launcher-startup-gate',
  phase:artifact.phase==='verified'?'artifacts-verified':'blocked',
  artifacts:artifact,titleState:title,
  entryMethods:['smilebasic','balatro','civilization'],
  canonicalImplementation:BIN,
  originalLauncherExecuted:false,
  blockedStages:gap.stages.map(s=>s.stage),
  nativeTransportReady:false,originalGraphicsReady:false,
  filesystemSessionReady:false,serviceIpcReady:false,
  canonicalMenuReady:false,ready:false};
}
async function main(){
 try{const value=await gate();console.log(JSON.stringify(value,null,2));
  if(value.artifacts.phase!=='verified')process.exitCode=1;
 }catch(e){console.error(JSON.stringify({backend:'balatro',phase:'error',ready:false,error:e.message}));process.exitCode=1;}
}
if(require.main===module)main();
module.exports={ROOT,BIN,MANIFEST,REQUIRED,inspect,gate};
