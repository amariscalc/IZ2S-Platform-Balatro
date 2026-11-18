#!/usr/bin/env node
'use strict';
// Offline API-contract inventory. Never imports or executes the target modules.
const fs=require('node:fs');
const path=require('node:path');
const ROOT=path.resolve(__dirname,'../..');
const SOURCES=Object.freeze({
  balatro:'switch2/balatro/rpc.cjs',
  ffi:'switch2/balatro/native-preflight.cjs',
  original:'switch2/app/rpc.cjs',
  session:'switch2/app/session.cjs',
  loader:'switch2/ro/nro.cjs',
  core:'switch2/ro/start-core.cjs',
});
const CONTRACTS=Object.freeze([
  {id:'transport',left:'balatro',right:'original',
    leftTokens:['sock.end(lua)','maxReplyBytes','timeoutMs'],
    rightTokens:['transport.request','transport.callAddress','transport.read'],
    gap:'Balatro sends Lua source over a TCP half-close; the original client relies on a separate command-oriented native transport.'},
  {id:'return-types',left:'balatro',right:'original',
    leftTokens:["toString('utf8')"],rightTokens:['result32','reply.result'],
    gap:'Balatro returns UTF-8 text; native calls normalize numeric results and memory operations require structured/binary replies.'},
  {id:'ffi-presence-versus-call',left:'ffi',right:'original',
    leftTokens:['declare_present','invoke_present','sdk_base_present'],
    rightTokens:['rpc.call3','rpc.call4','rpc.verifyFunction'],
    gap:'Presence of FFI members does not establish argument ABI, invocation safety, or native-call parity.'},
  {id:'memory-contract',left:'balatro',right:'original',
    leftTokens:['function request(', 'sock.on(\'data\''],
    rightTokens:['rpc.read = transport.read','rpc.write = transport.write','rpc.query = transport.query'],
    gap:'The Balatro TCP wrapper exposes no equivalent read/write/query contract.'},
  {id:'code-verification',left:'ffi',right:'session',
    leftTokens:['sdk_base_present'],rightTokens:['verifyCode(expected','region.permissions === 5','expected.bytes'],
    gap:'Reporting an SDK base is not verification of instruction bytes or executable mappings.'},
  {id:'resource-ownership',left:'balatro',right:'session',
    leftTokens:['function request('],rightTokens:['this.handles = new Set()','this.threads = new Set()','async cleanup()'],
    gap:'Original startup tracks owned allocations, handles and threads; the title-local Lua RPC has no corresponding lifecycle contract.'},
  {id:'loader-dependency',left:'balatro',right:'loader',
    leftTokens:['function request('],rightTokens:["openService('ldr:ro')",'session.ipc(','expectedPermissions = [5, 1, 3, 3]'],
    gap:'The NRO loader requires service IPC and mapping checks not proven by the Lua transport.'},
  {id:'core-prerequisites',left:'ffi',right:'core',
    leftTokens:['sdk_base_present'],rightTokens:['pm:shell','pm:dmnt','-notifier-proof.json'],
    gap:'The core requires acquisition evidence, sessions and notifier proofs beyond FFI discovery.'},
]);
function audit(read=key=>fs.readFileSync(path.join(ROOT,SOURCES[key]),'utf8')){
  const checks=CONTRACTS.map(contract=>{
    const left=read(contract.left),right=read(contract.right);
    if(typeof left!=='string'||typeof right!=='string')throw Error('Expected source text: '+contract.id);
    const missingLeft=contract.leftTokens.filter(token=>!left.includes(token));
    const missingRight=contract.rightTokens.filter(token=>!right.includes(token));
    return {
      id:contract.id,
      sources:[SOURCES[contract.left],SOURCES[contract.right]],
      markersPresent:missingLeft.length===0&&missingRight.length===0,
      missingMarkers:{left:missingLeft,right:missingRight},
      compatibility:'unverified',gap:contract.gap,
    };
  });
  return {
    schema:'iz2s-balatro-contract-diff-v1',
    mode:'offline-source-inspection',
    contactedConsole:false,executedNativeCalls:false,
    sourceConsistency:checks.every(c=>c.markersPresent),
    nativeCompatibilityVerified:false,ready:false,
    caveat:'Text markers document implementation dependencies, not behavioral equivalence or proof of access.',
    checks,
  };
}
if(require.main===module){
  const result=audit();
  process.stdout.write(JSON.stringify(result,null,2)+'\n');
  if(!result.sourceConsistency)process.exitCode=1;
}
module.exports={ROOT,SOURCES,CONTRACTS,audit};
