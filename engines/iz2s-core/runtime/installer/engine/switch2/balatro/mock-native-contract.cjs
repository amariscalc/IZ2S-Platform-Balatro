'use strict';
// Deliberately isolated transport contract simulator.
// This file never imports network, FFI, native IZ2S modules or service IPC.
const SIZE=4096;
const MAX_TRANSFER=256;
function u32(value){
  if(!Number.isSafeInteger(value)||value<0||value>0xffffffff)
    throw Error('Expected unsigned 32-bit integer');
  return value;
}
function span(address,length){
  if(!Number.isInteger(address)||!Number.isInteger(length)||
      address<0||length<1||length>MAX_TRANSFER||address+length>SIZE)
    throw Error('Mock memory access out of bounds');
}
function createMock(){
  const bytes=Buffer.alloc(SIZE);
  let closed=false;
  const log=[];
  function active(){if(closed)throw Error('Mock transport closed');}
  async function read(address,length){
    active();span(address,length);log.push({op:'read',address,length});
    return Buffer.from(bytes.subarray(address,address+length));
  }
  async function write(address,data){
    active();
    if(!Buffer.isBuffer(data))throw Error('Expected Buffer');
    span(address,data.length);
    data.copy(bytes,address);log.push({op:'write',address,length:data.length});
    return {result:0};
  }
  async function query(address){
    active();u32(address);
    if(address>=SIZE)throw Error('Mock address out of bounds');
    log.push({op:'query',address});
    return {result:0,address:0,size:SIZE,type:5,permissions:3,attributes:0,
      ipcReferences:0,deviceReferences:0,simulated:true};
  }
  async function call3(fn,...args){
    active();
    if(fn!=='mock:add-u32'||args.length!==2)throw Error('Mock call not supported');
    const result=u32(args[0])+u32(args[1]);
    if(result>0xffffffff)throw Error('Mock arithmetic overflow');
    log.push({op:'call3',fn});return result;
  }
  async function call4(fn,...args){return call3(fn,...args);}
  async function verifyFunction(){throw Error('Not supported: native instruction verification');}
  async function store64(){throw Error('Not supported: native memory primitive');}
  async function batch(){throw Error('Not supported: native batch execution');}
  async function openService(){throw Error('Not supported: service IPC');}
  function close(){if(!closed){closed=true;bytes.fill(0);}}
  function snapshot(){return {mode:'mock-only',closed,operations:log.map(x=>({...x})),
    nativeCompatible:false,ready:false};}
  return Object.freeze({read,write,query,call3,call4,verifyFunction,store64,batch,
    openService,close,snapshot});
}
module.exports={createMock,SIZE,MAX_TRANSFER};
