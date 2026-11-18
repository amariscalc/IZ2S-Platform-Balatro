'use strict';
// Balatro backend transport contract for IZ2S Platform.
// Only demonstrated title-local capabilities are exposed. Native services
// remain explicitly unsupported until separately implemented and verified.
const {audit}=require('./diagnose.cjs');
const {execute}=require('./app-session.cjs');
const {observe}=require('./controller-observe.cjs');
const {profile}=require('./ffi-profile.cjs');
class UnsupportedNativeCapability extends Error {
  constructor(operation){
    super('Balatro native transport does not implement '+operation);
    this.name='UnsupportedNativeCapability';
    this.code='BALATRO_NATIVE_UNAVAILABLE';
    this.operation=operation;
  }
}
const NATIVE_OPERATIONS=Object.freeze([
  'call3','call4','read','write','query','verifyFunction',
  'store64','batch','openService','ipc','loadNro','startCore',
]);
function createBalatroBackend({
  capabilityAudit=audit,
  menuExecute=execute,
  menuObserve=observe,
  ffiProfile=profile,
}={}){
  if(typeof capabilityAudit!=='function'||typeof menuExecute!=='function'||
    typeof menuObserve!=='function'||typeof ffiProfile!=='function')throw Error('Invalid Balatro backend dependencies');
  const backend={
    id:'balatro',kind:'title-local-lua',port:9026,
    async probe(host,options){
      const result=await capabilityAudit(host,options);
      if(!result||result.backend!=='balatro'||!result.capabilities)
        throw Error('Invalid Balatro backend capability response');
      return {
        backend:'balatro',mode:'title-local-lua',
        capabilities:result.capabilities,
        nativeTransportReady:false,privilegedSessionVerified:false,
        nativeCoreReady:false,
      };
    },
    async menu(host,operation,value,options){
      return menuExecute(host,operation,value,options);
    },
    async observe(host,options){
      return menuObserve(host,options);
    },
    async inspectFfi(host,options){
      return ffiProfile(host,options);
    },
    nativeStatus(){
      return {
        backend:'balatro',ready:false,nativeTransportReady:false,
        privilegedSessionVerified:false,loaderAvailable:false,
        blockedOperations:[...NATIVE_OPERATIONS],
      };
    },
  };
  for(const operation of NATIVE_OPERATIONS){
    Object.defineProperty(backend,operation,{
      enumerable:true,value:async()=>{throw new UnsupportedNativeCapability(operation);},
    });
  }
  return Object.freeze(backend);
}
module.exports={createBalatroBackend,UnsupportedNativeCapability,NATIVE_OPERATIONS};
