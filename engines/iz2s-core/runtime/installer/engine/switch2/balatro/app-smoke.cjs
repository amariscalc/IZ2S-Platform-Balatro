#!/usr/bin/env node
'use strict';
const {request} = require('./rpc.cjs');
// Execute a fixed, bounded Lua application inside Balatro (not the IZ2S native core).
// No FFI, arbitrary memory, privileged IPC, save writes or package installation.
const LUA = [
  'local function app()',
  '  local runtime = tostring(_VERSION)',
  '  local framework = type(love)=="table"',
  '  local version = framework and type(love.getVersion)=="function"',
  '  return "IZ2S_BALATRO_SMOKE_OK;runtime="..runtime..";love="..tostring(framework)..";version_api="..tostring(version)',
  'end',
  'return app()',
].join('\n');
function parse(reply) {
  if(typeof reply !== 'string' || !reply.startsWith('-> IZ2S_BALATRO_SMOKE_OK;'))
    throw Error('Lua application did not complete');
  const fields={};
  for(const part of reply.slice(3).trim().split(';').slice(1)){
    const i=part.indexOf('=');
    if(i<1)throw Error('Malformed application response');
    const key=part.slice(0,i);
    if(!['runtime','love','version_api'].includes(key)||Object.hasOwn(fields,key))
      throw Error('Unexpected application field');
    fields[key]=part.slice(i+1);
  }
  if(Object.keys(fields).length!==3)throw Error('Incomplete application response');
  return {application:'balatro-lua-smoke',executedInsideTitle:true,
    runtime:fields.runtime,loveAvailable:fields.love==='true',
    loveVersionApiAvailable:fields.version_api==='true',
    nativeIz2sLaunched:false,privilegedSessionVerified:false};
}
async function run(host,options={}) {return parse(await request({host,lua:LUA,...options}));}
async function main() {
  const [host,portText]=process.argv.slice(2);
  if(!host){console.error('Usage: node app-smoke.cjs <console-ip> [port]');process.exitCode=2;return;}
  try{console.log(JSON.stringify(await run(host,{port:portText?Number(portText):9026}),null,2));}
  catch(error){console.error(JSON.stringify({application:'balatro-lua-smoke',success:false,error:error.message}));process.exitCode=1;}
}
if(require.main===module)main();
module.exports={LUA,parse,run};
