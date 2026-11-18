#!/usr/bin/env node
'use strict';
// Source-only compatibility audit. Does not import or execute any native runtime.
const fs=require('node:fs');
const path=require('node:path');
const ROOT=path.resolve(__dirname,'..');
const FILES=Object.freeze({
  balatroRpc:'switch2/balatro/rpc.cjs',
  preflight:'switch2/balatro/native-preflight.cjs',
  originalRpc:'switch2/app/rpc.cjs',
  session:'switch2/app/session.cjs',
  nro:'switch2/ro/nro.cjs',
  core:'switch2/ro/start-core.cjs',
});
const CHECKS=Object.freeze([
  {id:'lua-rpc',file:'balatroRpc',markers:['node:net','sock.end(lua)'],
    observation:'Lua chunks use TCP 9026 and a write half-close.'},
  {id:'ffi-interface',file:'preflight',markers:['declare_present','invoke_present','sdk_base_present'],
    observation:'Runtime report only confirms presence of Lua-side interface members.'},
  {id:'native-call-transport',file:'originalRpc',markers:['call3','call4','transport.callAddress'],
    observation:'Original call semantics rely on a separate native RPC transport.'},
  {id:'memory-transport',file:'originalRpc',markers:['transport.read','transport.write','transport.query'],
    observation:'Read, write and query are required; no equivalence is established by FFI presence.'},
  {id:'function-verification',file:'session',markers:['verifyCode','expected.bytes','region.permissions === 5'],
    observation:'Instruction bytes and executable memory region must be verified.'},
  {id:'owned-scratch',file:'session',markers:['async initialize()','this.rpc.query(temporary)','this.call(\'allocate\''],
    observation:'Scratch allocation and ownership checks are required.'},
  {id:'ro-service',file:'nro',markers:['openService(\'ldr:ro\')','command(handle, 0','command(handle, 1'],
    observation:'NRO load/unload relies on an ldr:ro service session.'},
  {id:'ro-permissions',file:'nro',markers:['expectedPermissions = [5, 1, 3, 3]','record.mappings'],
    observation:'Mapped NRO pages require a permissions check.'},
  {id:'privileged-prerequisites',file:'core',markers:['pm:shell','pm:dmnt','current-acquisition.json','-notifier-proof.json'],
    observation:'Core startup requires retained acquisition state and service handles.'},
]);
function analyze(read=key=>fs.readFileSync(path.join(ROOT,FILES[key]),'utf8')){
  const result=CHECKS.map(check=>{
    const source=read(check.file);
    if(typeof source!=='string')throw Error('Expected source string for '+check.file);
    const absent=check.markers.filter(marker=>!source.includes(marker));
    return {id:check.id,source:FILES[check.file],sourceMarkersPresent:absent.length===0,
      missingMarkers:absent,observation:check.observation,
      runtimeVerified:false};
  });
  return {
    schema:'iz2s-balatro-static-compatibility-v1',
    mode:'source-only',
    executedNativeCalls:false,
    contactedConsole:false,
    checked:result.length,
    sourceConsistency:result.every(x=>x.sourceMarkersPresent),
    ready:false,
    limitations:[
      'Source-marker matches are not a code proof or a behavioral compatibility test.',
      'Runtime FFI presence does not prove native calls, read/write/query, IPC or services.',
      'The original loader depends on verified acquisition, mappings and restoration.',
    ],
    checks:result,
  };
}
function main(){
  const report=analyze();
  process.stdout.write(JSON.stringify(report,null,2)+'\n');
  if(!report.sourceConsistency)process.exitCode=1;
}
if(require.main===module)main();
module.exports={FILES,CHECKS,analyze};
