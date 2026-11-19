#!/usr/bin/env node
'use strict';
// One fixed, read-only probe of Balatro's title-local Lua/LÖVE interfaces.
// A virtual filesystem hit or drawing API does NOT establish native IZ2S
// ownership, SD privileges, executable mappings or a supervisor.
const {request}=require('./rpc.cjs');
const {evaluate}=require('../../../../../../../core/console/sd-launcher/entry-contract.cjs');

const LUA=[
 'local f=type(love)=="table" and love.filesystem or nil',
 'local g=type(love)=="table" and love.graphics or nil',
 'local t=type(love)=="table" and love.thread or nil',
 'local function has(o,k) return type(o)=="table" and type(o[k])=="function" end',
 'local function bit(x) if x then return "1" else return "0" end end',
 'local vfs="unavailable"',
 'if has(f,"getInfo") then',
 ' local ok,info=pcall(f.getInfo,"iz2s/modules/book-reader/launcher.iza")',
 ' if not ok then vfs="error"',
 ' elseif info==nil then vfs="missing"',
 ' elseif type(info)=="table" and info.type=="file" then vfs="file"',
 ' elseif type(info)=="table" and info.type=="directory" then vfs="directory"',
 ' else vfs="other" end',
 'end',
 'local dimensions="unavailable"',
 'if has(g,"getDimensions") then',
 ' local ok,w,h=pcall(g.getDimensions)',
 ' if ok and type(w)=="number" and type(h)=="number" and',
 ' w==math.floor(w) and h==math.floor(h) and w>0 and h>0 and w<=8192 and h<=8192 then',
 '  dimensions=tostring(w).."x"..tostring(h)',
 ' else dimensions="error" end',
 'end',
 'return "IZ2S_READER_RUNTIME_V1"',
 ' ..";fsread="..bit(has(f,"read"))',
 ' ..";fsinfo="..bit(has(f,"getInfo"))',
 ' ..";fsreal="..bit(has(f,"getRealDirectory"))',
 ' ..";fsmount="..bit(has(f,"mount"))',
 ' ..";vfs="..vfs',
 ' ..";draw="..bit(has(g,"draw"))',
 ' ..";present="..bit(has(g,"present"))',
 ' ..";image="..bit(has(g,"newImage"))',
 ' ..";shader="..bit(has(g,"newShader"))',
 ' ..";dimensions="..dimensions',
 ' ..";thread="..bit(has(t,"newThread"))',
].join('\n');
const FORMAT=/^IZ2S_READER_RUNTIME_V1;fsread=([01]);fsinfo=([01]);fsreal=([01]);fsmount=([01]);vfs=(unavailable|missing|file|directory|other|error);draw=([01]);present=([01]);image=([01]);shader=([01]);dimensions=(unavailable|error|[1-9][0-9]{0,3}x[1-9][0-9]{0,3});thread=([01])$/;
function parse(reply){
 if(typeof reply!=='string'||!reply.startsWith('-> '))
  throw Error('Invalid Book Reader runtime response framing');
 const m=FORMAT.exec(reply.slice(3).trim());
 if(!m)throw Error('Malformed Book Reader runtime response');
 const [,fsread,fsinfo,fsreal,fsmount,vfs,draw,present,image,shader,dimensions,thread]=m;
 if((fsinfo==='0'&&vfs!=='unavailable')||(fsinfo==='1'&&vfs==='unavailable'))
  throw Error('Contradictory Book Reader virtual filesystem observation');
 if((dimensions!=='unavailable'&&dimensions!=='error')&&
    dimensions.split('x').some(n=>Number(n)<1||Number(n)>8192))
  throw Error('Unreasonable title graphics dimensions');
 const contract=evaluate({entry:'balatro'});
 const widthHeight=/^[0-9]+x[0-9]+$/.test(dimensions)?
   dimensions.split('x').map(Number):null;
 return {
  backend:'balatro',app:'book-reader',mode:'read-only-title-runtime-surface',
  phase:'title-api-inventoried-native-entry-blocked',
  filesystem:{
   readFunctionExposed:fsread==='1',getInfoFunctionExposed:fsinfo==='1',
   getRealDirectoryFunctionExposed:fsreal==='1',mountFunctionExposed:fsmount==='1',
   fixedBookReaderTitleRelativePath:'iz2s/modules/book-reader/launcher.iza',
   titleVirtualPathObservation:vfs,
   consoleSdAccessVerified:false,
  },
  graphics:{
   drawFunctionExposed:draw==='1',presentFunctionExposed:present==='1',
   newImageFunctionExposed:image==='1',newShaderFunctionExposed:shader==='1',
   titleCanvasDimensions:widthHeight?
    {width:widthHeight[0],height:widthHeight[1]}:null,
   dimensionsObservation:dimensions==='error'?'error':
    dimensions==='unavailable'?'unavailable':'reported',
   originalVulkanOwnershipVerified:false,
  },
  threading:{titleThreadFunctionExposed:thread==='1',originalSupervisorThreadVerified:false},
  rpcCalls:1,readOnly:true,titleScoped:true,
  missingNativePrerequisites:contract.missing,
  nativeTransportReady:false,originalLauncherReady:false,
  installedOnConsole:false,executedOnConsole:false,ready:false
 };
}
async function inspect(host,{port=9026,send=request}={}){
 if(typeof host!=='string'||!host.trim()||/\s/.test(host))
  throw Error('Invalid console host');
 if(!Number.isSafeInteger(port)||port<1||port>65535)
  throw Error('Invalid RPC port');
 return parse(await send({host,port,lua:LUA,timeoutMs:6000,maxReplyBytes:2048}));
}
async function main(){
 const [host,rawPort]=process.argv.slice(2);
 if(!host){console.error('Usage: node book-reader-runtime-surface.cjs <switch-ip> [port]');process.exitCode=2;return;}
 try{console.log(JSON.stringify(await inspect(host,{port:rawPort?Number(rawPort):9026}),null,2));}
 catch(error){console.error(JSON.stringify({backend:'balatro',app:'book-reader',phase:'blocked',ready:false,error:error.message}));process.exitCode=1;}
}
if(require.main===module)main();
module.exports={LUA,FORMAT,parse,inspect};
