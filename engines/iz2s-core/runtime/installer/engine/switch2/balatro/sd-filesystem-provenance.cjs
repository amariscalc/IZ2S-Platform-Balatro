#!/usr/bin/env node
'use strict';
// Safe read-only Balatro filesystem provenance probe.
// LÖVE VFS root/source/save metadata does NOT prove physical SD access.
// Does not enumerate user files, mount, read file bytes or write anything.
const {request}=require('./rpc.cjs');
const LUA=[
 'local f=type(love)=="table" and love.filesystem or nil',
 'local function has(k) return type(f)=="table" and type(f[k])=="function" end',
 'local function classify(fn)',
 ' if not has(fn) then return "unsupported" end',
 ' local ok,v=pcall(f[fn])',
 ' if not ok then return "error" end',
 ' if type(v)~="string" or v=="" then return "unavailable" end',
 ' local s=v:lower()',
 ' if s:find("sdmc:",1,true) or s:match("^sd:/") or s:match("^/sdmc/") then return "sd-like" end',
 ' if s:find("save",1,true) or s:find("user",1,true) then return "private-like" end',
 ' return "opaque"',
 'end',
 'local target="iz2s/modules/book-reader/launcher.iza"',
 'local info="unsupported"',
 'local source="unsupported"',
 'if has("getInfo") then',
 ' local ok,v=pcall(f.getInfo,target)',
 ' info=not ok and "error" or (v==nil and "missing" or (type(v)=="table" and v.type=="file" and "file" or "other"))',
 'end',
 'if has("getRealDirectory") then',
 ' local ok,v=pcall(f.getRealDirectory,target)',
 ' if not ok then source="error"',
 ' elseif type(v)~="string" or v=="" then source="missing"',
 ' elseif v:lower():find("sdmc:",1,true) or v:lower():match("^sd:/") then source="sd-like"',
 ' else source="opaque" end',
 'end',
 'return "IZ2S_SD_SURFACE_V1;save="..classify("getSaveDirectory")..',
 ' ";source="..classify("getSourceBaseDirectory")..";file="..info..";real="..source..',
 ' ";mount="..(has("mount") and "1" or "0")',
].join('\n');
const RE=/^IZ2S_SD_SURFACE_V1;save=(unsupported|error|unavailable|sd-like|private-like|opaque);source=(unsupported|error|unavailable|sd-like|private-like|opaque);file=(unsupported|error|missing|file|other);real=(unsupported|error|missing|sd-like|opaque);mount=([01])$/;
function parse(reply){
 if(typeof reply!=='string'||!reply.startsWith('-> '))throw Error('Invalid SD probe framing');
 const m=RE.exec(reply.slice(3).trim());
 if(!m)throw Error('Invalid SD probe response');
 return {backend:'balatro',mode:'read-only-sd-provenance',
  phase:'filesystem-provenance-observed',
  saveDirectoryClass:m[1],sourceDirectoryClass:m[2],
  bookReaderVirtualFile:m[3],bookReaderRealDirectoryClass:m[4],
  mountFunctionPresent:m[5]==='1',physicalSdReadVerified:false,
  physicalSdWriteVerified:false,sdMountedByProbe:false,
  nativeFilesystemServiceVerified:false,originalBookReaderExecuted:false,ready:false};
}
async function inspect(host,{port=9026,send=request}={}){
 if(typeof host!=='string'||!host||/\s/.test(host))throw Error('Invalid host');
 if(!Number.isSafeInteger(port)||port<1||port>65535)throw Error('Invalid port');
 return parse(await send({host,port,lua:LUA,timeoutMs:5000,maxReplyBytes:1024}));
}
async function main(){
 const [host,portArg]=process.argv.slice(2);
 if(!host){console.error('Usage: node sd-filesystem-provenance.cjs <switch-ip> [port]');process.exitCode=2;return}
 try{console.log(JSON.stringify(await inspect(host,{port:portArg?Number(portArg):9026}),null,2))}
 catch(e){console.error(JSON.stringify({phase:'error',ready:false,error:e.message}));process.exitCode=1}
}
if(require.main===module)main();
module.exports={LUA,RE,parse,inspect};
