#!/usr/bin/env node
'use strict';
// Explicit requirements derived from the IZ2S native startup source.
// A title-local Lua RPC result cannot authorize native launch.
const REQUIREMENTS=Object.freeze([
  {id:'lua-rpc',source:'switch2/balatro/rpc.cjs',status:'verified',
   detail:'Balatro accepts one Lua chunk over TCP 9026 with write half-close.'},
  {id:'lua-execution',source:'switch2/balatro/app-runtime.cjs',status:'verified',
   detail:'Fixed Lua commands ping/runtime/math executed successfully in the Balatro title.'},
  {id:'native-transport',source:'switch2/app/rpc.cjs',status:'unverified',
   detail:'IZ2S expects call3/call4, read, write, query, verifyFunction, store64 and batch.'},
  {id:'sdk-code-verification',source:'switch2/app/session.cjs',status:'unverified',
   detail:'Expected SDK instructions and executable mappings must be independently verified.'},
  {id:'owned-scratch-memory',source:'switch2/app/session.cjs',status:'unverified',
   detail:'Session allocates, queries and verifies owned memory before native operations.'},
  {id:'privileged-acquisition',source:'switch2/ro/start-core.cjs',status:'unverified',
   detail:'Native startup requires a current acquisition report and retained memory channel.'},
  {id:'service-sessions',source:'switch2/ro/start-core.cjs',status:'unverified',
   detail:'Native startup requires pm:shell and pm:dmnt from the verified acquisition.'},
  {id:'fs-notifier-proof',source:'switch2/ro/start-core.cjs',status:'unverified',
   detail:'Notifier identity, run/session linkage and pointer state require proof.'},
  {id:'native-image-start',source:'switch2/ro/start-core.cjs',status:'unverified',
   detail:'Requires staging, bootstrap verification, execution result and restoration.'},
]);
function inspect(capabilities={}) {
  if(capabilities===null||typeof capabilities!=='object'||Array.isArray(capabilities))
    throw Error('Expected capability object');
  const sdkAvailable=capabilities.sdk_base_present===true;
  const ffiAvailable=capabilities.native_declare===true && capabilities.native_invoke===true;
  return {
    backend:'balatro',platform:'Switch 2',kind:'native-readiness-gap-analysis',
    luaExecutionVerified:true,ffiInterfaceReported:ffiAvailable,sdkBaseReported:sdkAvailable,
    requirements:REQUIREMENTS,
    nativeOperationsVerified:false,privilegedSessionVerified:false,
    ready:false,
    conclusion:'Only Lua RPC/application execution is verified. The native IZ2S launch prerequisites are not established.',
  };
}
function main() {
  const result=inspect();
  process.stdout.write(JSON.stringify(result,null,2)+'\n');
}
if(require.main===module)main();
module.exports={REQUIREMENTS,inspect};
