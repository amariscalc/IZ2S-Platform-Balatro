'use strict';
const {validateTarget}=require('./balatro-diagnostics.cjs');
const {createBalatroBackend}=require('../engines/iz2s-core/runtime/installer/engine/switch2/balatro/backend.cjs');
const backend=createBalatroBackend();
function create({run=(...args)=>backend.menu(...args)}={}){
  let busy=false;
  async function action({host,operation,value}){
    validateTarget(host);
    if(!['start','status','step','stop','up','down','select','back'].includes(operation))throw Error('Unknown Balatro application action');
    if(operation==='step'&&value!==5)throw Error('Only the fixed five-step action is supported');
    if(operation!=='step'&&value!==undefined)throw Error('Unexpected action argument');
    if(busy)throw Error('Balatro application action already in progress');
    busy=true;
    try{return await run(host,operation,value,{port:9026,timeoutMs:5000});}
    finally{busy=false;}
  }
  return {action};
}
module.exports={create};
