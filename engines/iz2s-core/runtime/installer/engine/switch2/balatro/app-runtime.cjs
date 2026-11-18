#!/usr/bin/env node
'use strict';
const {request} = require('./rpc.cjs');

// A bounded application-level command protocol. No arbitrary Lua input is exposed
// by this CLI; every request is generated from a fixed command whitelist.
const COMMANDS = Object.freeze(['ping', 'math', 'runtime']);
function build(command, value) {
  if(!COMMANDS.includes(command)) throw Error('Unsupported Balatro application command');
  if(command==='math' && (!Number.isSafeInteger(value)||value<0||value>100000))
    throw Error('Math argument must be an integer from 0 to 100000');
  const prefix=[
    'local function main()',
    '  local tag="IZ2S_APP_V1"',
  ];
  const suffix=['end','return main()'];
  const body = command==='ping'
    ? ['  return tag..";command=ping;result=pong"']
    : command==='runtime'
    ? ['  return tag..";command=runtime;result="..tostring(_VERSION)']
    : ['  local n='+value,'  return tag..";command=math;result="..tostring(n*n+1)'];
  return [...prefix,...body,...suffix].join('\n');
}
function parse(reply, command) {
  if (typeof reply!=='string'||!reply.startsWith('-> IZ2S_APP_V1;'))
    throw Error('Unrecognized Balatro application response');
  const fields={};
  for (const part of reply.slice(3).trim().split(';').slice(1)) {
    const index=part.indexOf('=');
    if(index<1) throw Error('Malformed Balatro application field');
    const key=part.slice(0,index);
    if(!['command','result'].includes(key)||Object.hasOwn(fields,key))
      throw Error('Unexpected Balatro application field');
    fields[key]=part.slice(index+1);
  }
  if(Object.keys(fields).length!==2||fields.command!==command||!fields.result)
    throw Error('Balatro application response mismatch');
  if(command==='ping'&&fields.result!=='pong')throw Error('Unexpected ping result');
  if(command==='math'&&!/^\d+$/.test(fields.result))throw Error('Invalid math result');
  return {protocol:'IZ2S_APP_V1',command,result:fields.result,
    luaAppExecuted:true,nativeCoreLaunched:false,privilegedSessionVerified:false};
}
async function execute(host, command, value, options={}) {
  const lua=build(command,value);
  return parse(await request({host,lua,...options}),command);
}
async function main() {
  const [host, command, raw, portArg]=process.argv.slice(2);
  if(!host||!command||!COMMANDS.includes(command)){
    console.error('Usage: node app-runtime.cjs <console-ip> ping|runtime|math [value] [port]');
    process.exitCode=2;return;
  }
  try {
    const value=command==='math'?Number(raw):undefined;
    const port=command==='math'?(portArg?Number(portArg):9026):(raw?Number(raw):9026);
    console.log(JSON.stringify(await execute(host,command,value,{port}),null,2));
  } catch(error){
    console.error(JSON.stringify({protocol:'IZ2S_APP_V1',success:false,error:error.message}));
    process.exitCode=1;
  }
}
if(require.main===module)main();
module.exports={COMMANDS,build,parse,execute};
