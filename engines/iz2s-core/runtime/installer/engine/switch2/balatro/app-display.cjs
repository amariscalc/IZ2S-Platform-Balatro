#!/usr/bin/env node
'use strict';
const {request}=require('./rpc.cjs');

// Display a bounded IZ2S application-layer banner on the existing Balatro
// launcher console. No native calls, memory access, save changes or launch.
const LUA=[
  'local ok,log=pcall(require,"bl.log")',
  'if not ok or type(log)~="table" or type(log.log)~="function" then',
  '  return "IZ2S_DISPLAY_V1;status=unavailable"',
  'end',
  'log.log("[IZ2S] APPLICATION LAYER ONLINE - LUA RPC")',
  'log.log("[IZ2S] Native core: unavailable (no verified privileged session)")',
  'return "IZ2S_DISPLAY_V1;status=displayed"',
].join('\n');
function parse(reply){
  if(typeof reply!=='string')throw Error('Invalid display response');
  const value=reply.trim();
  if(value==='-> IZ2S_DISPLAY_V1;status=unavailable')
    return {application:'IZ2S Balatro',onConsole:false,reason:'Balatro logger unavailable',nativeCoreLaunched:false};
  if(value!=='-> IZ2S_DISPLAY_V1;status=displayed')
    throw Error('Unrecognized IZ2S display response');
  return {application:'IZ2S Balatro',onConsole:true,
    message:'Application-layer banner sent to Balatro console',
    nativeCoreLaunched:false,privilegedSessionVerified:false};
}
async function run(host,options={}){
  return parse(await request({host,lua:LUA,...options}));
}
async function main(){
  const [host,portText]=process.argv.slice(2);
  if(!host){console.error('Usage: node app-display.cjs <console-ip> [port]');process.exitCode=2;return;}
  try{console.log(JSON.stringify(await run(host,{port:portText?Number(portText):9026}),null,2));}
  catch(error){console.error(JSON.stringify({application:'IZ2S Balatro',error:error.message}));process.exitCode=1;}
}
if(require.main===module)main();
module.exports={LUA,parse,run};
