#!/usr/bin/env node
'use strict';
// Read-only preflight for optional FTP-uploaded IZ2S Lua files.
// Does not require/execute any uploaded module or alter the Balatro boot state.
const {request}=require('./rpc.cjs');
const LUA=[
 'local names={"rboot.lua","model.lua","visual_base.lua","visual_scene.lua","focus.lua"}',
 'local expected={2348,1952,2003,6371,8101}',
 'local present=0;local valid=0;local result={}',
 'for i,n in ipairs(names) do',
 ' local p="iz2s/"..n',
 ' local ok,info=pcall(love.filesystem.getInfo,p)',
 ' local exists=ok and type(info)=="table" and info.type=="file" and info.size==expected[i]',
 ' if exists then present=present+1 end',
 ' local compiled=false',
 ' if exists and type(love.filesystem.load)=="function" then',
 '  local success,chunk=pcall(love.filesystem.load,p)',
 '  compiled=success and type(chunk)=="function"',
 ' end',
 ' if compiled then valid=valid+1 end',
 ' result[#result+1]=(exists and "1" or "0")..(compiled and "1" or "0")',
 'end',
 'return "IZ2S_RBOOT_PREFLIGHT_V1;files="..table.concat(result,",")..";present="..present..";compiled="..valid',
].join('\n');
const FILES=Object.freeze(['rboot.lua','model.lua','visual_base.lua','visual_scene.lua','focus.lua']);
function parse(reply){
 if(typeof reply!=='string'||!reply.startsWith('-> '))throw Error('Invalid preflight reply');
 const m=/^IZ2S_RBOOT_PREFLIGHT_V1;files=([01]{2}(?:,[01]{2}){4});present=([0-5]);compiled=([0-5])$/.exec(reply.slice(3).trim());
 if(!m)throw Error('Invalid preflight frame');
 const flags=m[1].split(',');const files={};let p=0,c=0;
 for(let i=0;i<FILES.length;i++){
  const [exists,compiles]=flags[i];
  if(compiles==='1'&&exists==='0')throw Error('Contradictory Lua preflight');
  p+=Number(exists);c+=Number(compiles);
  files[FILES[i]]={presentWithExpectedSize:exists==='1',syntaxAccepted:compiles==='1'};
 }
 if(p!==Number(m[2])||c!==Number(m[3]))throw Error('Contradictory Lua preflight counts');
 return {backend:'balatro',mode:'read-only-rboot-module-preflight',phase:'observed',
  files,present:p,compiled:c,allModulesPrepared:p===5&&c===5,
  modulesExecuted:false,mainLuaModified:false,automaticBootVerified:false,ready:false};
}
async function execute(host,{port=9026,send=request}={}){
 return parse(await send({host,port,lua:LUA,timeoutMs:5000,maxReplyBytes:1024}));
}
async function main(){
 const [host,portRaw]=process.argv.slice(2);
 if(!host){console.error('Usage: node boot-r-persistent-preflight.cjs <switch-ip> [port]');process.exitCode=2;return;}
 try{const r=await execute(host,{port:portRaw?Number(portRaw):9026});console.log(JSON.stringify(r,null,2));if(!r.allModulesPrepared)process.exitCode=1;}
 catch(e){console.error(JSON.stringify({phase:'error',ready:false,error:e.message}));process.exitCode=1;}
}
if(require.main===module)main();
module.exports={FILES,LUA,parse,execute};
