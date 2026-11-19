#!/usr/bin/env node
'use strict';
// Read-only names-only inventory of Balatro's existing bl.app SDK metadata.
// No pointer values, addresses, invocation, memory access, service IPC or mounting.
// A name in a table does NOT prove that an operation is callable or authorized.
const {request}=require('./rpc.cjs');
const LUA=[
 'local app=package.loaded["bl.app"]',
 'local info=type(app)=="table" and app.info or nil',
 'local off=type(info)=="table" and info.off or nil',
 'local ffi=type(love)=="table" and love.ffi or nil',
 'local function names(t)',
 ' if type(t)~="table" then return "none",0 end',
 ' local keys={}',
 ' local total=0',
 ' for k,v in pairs(t) do',
 '  if type(k)=="string" and k:match("^[a-z][a-z0-9_]*$") and #k<=40',
 '    and (type(v)=="number" or type(v)=="function") then',
 '   total=total+1',
 '   if #keys<120 then keys[#keys+1]=k end',
 '  end',
 ' end',
 ' table.sort(keys)',
 ' if #keys>32 then',
 '  while #keys>32 do keys[#keys]=nil end',
 ' end',
 ' return #keys>0 and table.concat(keys,",") or "none",math.min(total,9999)',
 'end',
 'local a,n=names(off)',
 'local b,m=names(ffi)',
 'return "IZ2S_SDK_KEYS_V1;off="..a..";offtotal="..n..";ffi="..b..";ffitotal="..m',
].join('\n');
function decodeKeys(raw){
 if(raw==='none')return [];
 const keys=raw.split(',');
 if(keys.length>32||keys.some(k=>!/^[a-z][a-z0-9_]{0,39}$/.test(k))||
   new Set(keys).size!==keys.length)throw Error('Invalid SDK key list');
 return keys;
}
function parse(reply){
 if(typeof reply!=='string'||!reply.startsWith('-> '))throw Error('Invalid SDK keys RPC framing');
 const raw=reply.slice(3).trim();
 const m=/^IZ2S_SDK_KEYS_V1;off=(none|[a-z0-9_,]+);offtotal=([0-9]{1,4});ffi=(none|[a-z0-9_,]+);ffitotal=([0-9]{1,4})$/.exec(raw);
 if(!m)throw Error('Invalid SDK keys response');
 const offsetNames=decodeKeys(m[1]),ffiNames=decodeKeys(m[3]);
 const totalOffsets=Number(m[2]),totalFfi=Number(m[4]);
 if(totalOffsets<offsetNames.length||totalFfi<ffiNames.length)throw Error('Contradictory SDK inventory');
 return {backend:'balatro',mode:'read-only-sdk-symbol-names',phase:'metadata-inventoried',
  sdkOffsetNames:offsetNames,ffiFunctionNames:ffiNames,
  counts:{sdkOffsetEntries:totalOffsets,ffiEntries:totalFfi},
  inventoryTruncated:totalOffsets>offsetNames.length||totalFfi>ffiNames.length,
  nativeFunctionsInvoked:false,pointerValuesExposed:false,
  serviceAccessVerified:false,physicalSdAccessVerified:false,
  executableMappingVerified:false,originalLauncherReady:false,ready:false};
}
async function inspect(host,{port=9026,send=request}={}){
 if(typeof host!=='string'||!host||/\s/.test(host))throw Error('Invalid Balatro host');
 if(!Number.isInteger(port)||port<1||port>65535)throw Error('Invalid port');
 return parse(await send({host,port,lua:LUA,timeoutMs:5000,maxReplyBytes:4096}));
}
async function main(){
 const [host,rawPort]=process.argv.slice(2);
 if(!host){console.error('Usage: node native-sdk-symbol-inventory.cjs <switch-ip> [port]');process.exitCode=2;return;}
 try{console.log(JSON.stringify(await inspect(host,{port:rawPort?Number(rawPort):9026}),null,2));}
 catch(e){console.error(JSON.stringify({backend:'balatro',phase:'error',ready:false,error:e.message}));process.exitCode=1;}
}
if(require.main===module)main();
module.exports={LUA,parse,decodeKeys,inspect};
