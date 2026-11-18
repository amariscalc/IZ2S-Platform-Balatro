'use strict';
// Source-backed, fail-closed readiness assessment. NO native RPC is issued.
// This is a diagnostic contract, not a native transport or launch adapter.
const STAGES=Object.freeze([
 {id:'connection',requires:['status.ready','live.platform=2'],verified:false,
  evidence:'switch2/app/session.cjs Session.ready()'},
 {id:'native-functions',requires:['verifyCode(allocate)','verifyCode(free)',
  'verifyCode(getService)','verifyCode(send)','verifyCode(close)','verifyCode(memset)'],
  verified:false,evidence:'switch2/app/session.cjs Session.initialize()'},
 {id:'mapped-scratch',requires:['query(scratch)','owned RW mapping',
  'scratch saved/restored','allocate result'],verified:false,
  evidence:'switch2/app/session.cjs Session.initialize()'},
 {id:'addressable-memory',requires:['read(address,size)','write(address,bytes)',
  'query(address)','mapped allocation verification','free(address)'],
  verified:false,evidence:'switch2/app/session.cjs readOwned/write/cleanup'},
 {id:'service-ipc',requires:['getService(name)','send(packet,handle)',
  'owned handle lifecycle','IPC response'],verified:false,
  evidence:'switch2/app/session.cjs openService/ipc/close'},
 {id:'ro-mapping',requires:['ldr:ro access','map NRO','RX/R/RW region validation',
  'unmap NRO','unmap validation'],verified:false,
  evidence:'switch2/ro/nro.cjs main()'},
 {id:'core-boot',requires:['retained FS acquisition','root-native-info',
  'pm:shell','pm:dmnt','notifier identity','loader handle export',
  'bootstrap synchronization'],verified:false,
  evidence:'switch2/ro/start-core.cjs main()'},
]);
const OBSERVED=Object.freeze({
 balatroRpc:true,titleLocalFfi:true,nativeGetterCall:true,nativeMemcpyOwned:true,
 ownedBufferLifecycle:true,persistentOwnedHandles:true,boundedAccess:true,
 arbitraryAddressReadWrite:false,processMappingQuery:false,
 nativeSdkAllocationAndFree:false,serviceIpc:false,nroMapping:false,
 privilegedAcquisition:false,
});
function assess(observed=OBSERVED){
 if(!observed||typeof observed!=='object'||Array.isArray(observed))throw Error('Invalid observed capability summary');
 const findings=STAGES.map(stage=>({
  stage:stage.id,evidence:stage.evidence,required:stage.requires,
  supported:false,blocker:'native transport or ownership prerequisites not verified',
 }));
 const summary={backend:'balatro',mode:'source-backed-native-readiness-gap',
  sourceFiles:['switch2/app/session.cjs','switch2/app/rpc.cjs',
   'switch2/ro/nro.cjs','switch2/ro/start-core.cjs'],
  observed:{
   balatroRpc:observed.balatroRpc===true,
   nativeGetterCall:observed.nativeGetterCall===true,
   nativeMemcpyOwned:observed.nativeMemcpyOwned===true,
   persistentOwnedHandles:observed.persistentOwnedHandles===true,
  },
  unsupported:{
   arbitraryAddressReadWrite:true,processMappingQuery:true,
   nativeSdkAllocationAndFree:true,serviceIpc:true,nroMapping:true,
   privilegedAcquisition:true,
  },
  stages:findings,nativeTransportReady:false,ipcVerified:false,
  nroLoaderVerified:false,nativeCoreReady:false,ready:false};
 return summary;
}
module.exports={STAGES,OBSERVED,assess};
