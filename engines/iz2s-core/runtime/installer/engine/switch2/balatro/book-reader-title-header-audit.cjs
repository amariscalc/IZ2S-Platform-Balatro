#!/usr/bin/env node
'use strict';
// First genuine package-data step: independently inspect an authenticated
// 512-byte ORIGINAL Book Reader IZA header inside Balatro's title-local Lua.
// This is validation, NOT native code mapping or execution.
const fs=require('node:fs/promises');
const crypto=require('node:crypto');
const {request}=require('./rpc.cjs');
const {verify}=require('./original-book-reader-handoff.cjs');
const codec=require('../../../../../../../core/console/sd-launcher/package.cjs');
function luaFor(headerHex){
 if(!/^[0-9a-f]{1024}$/.test(headerHex))throw Error('Exactly 512 verified header bytes required');
 return [
 'local hex="'+headerHex+'"',
 'if #hex~=1024 or hex:find("[^0-9a-f]") then return "IZ2S_HEADER_AUDIT;phase=invalid-hex" end',
 'local bytes=hex:gsub("..",function(h)return string.char(tonumber(h,16)) end)',
 'local function u32(p) local a,b,c,d=bytes:byte(p,p+3);return a+b*256+c*65536+d*16777216 end',
 'local id=bytes:sub(25,72):match("^([^%z]+)")',
 'local ok=bytes:sub(1,8)=="IZSDAPP1" and u32(9)==2 and u32(13)==512',
 'ok=ok and id=="book-reader" and u32(17)>=512 and u32(17)<=33554432',
 'ok=ok and u32(21)%2==1 and u32(157)>0',
 'return ok and "IZ2S_HEADER_AUDIT;phase=title-header-accepted" or "IZ2S_HEADER_AUDIT;phase=title-header-rejected"'
 ].join('\n');
}
async function audit(host,file,expectedSha256,{port=9026,send=request}={}){
 if(!host||/\s/.test(host))throw Error('Invalid host');
 const checked=await verify(file,{expectedSha256});
 const bytes=await fs.readFile(checked.packageFile);
 if(bytes.length!==checked.packageBytes||
 crypto.createHash('sha256').update(bytes).digest('hex')!==checked.packageSha256)
  throw Error('Book Reader image changed after verification');
 const header=codec.decodeHeader(bytes.subarray(0,512),bytes.length);
 if(header.id!=='book-reader'||header.version!==2||header.nativeAbi!==2||!header.native)
  throw Error('Original Book Reader native ABI2 header required');
 const response=await send({host,port,timeoutMs:5000,maxReplyBytes:1024,
  lua:luaFor(bytes.subarray(0,512).toString('hex'))});
 const m=/^-> IZ2S_HEADER_AUDIT;phase=(title-header-accepted|title-header-rejected|invalid-hex)\s*$/.exec(response);
 if(!m)throw Error('Invalid title header audit reply');
 return {backend:'balatro',app:'book-reader',phase:m[1],
  verifiedPackageSha256:checked.packageSha256,
  packageBytes:checked.packageBytes,
  headerBytesCheckedInTitle:512,
  titleHeaderAccepted:m[1]==='title-header-accepted',
  originalNativeSupervisorStarted:false,originalBookReaderExecuted:false,ready:false};
}
async function main(){
 const [host,file,sha]=process.argv.slice(2);
 if(!host||!file){console.error('Usage: node book-reader-title-header-audit.cjs <ip> <launcher.iza> [sha256]');process.exitCode=2;return}
 try{const result=await audit(host,file,sha);console.log(JSON.stringify(result,null,2));if(!result.titleHeaderAccepted)process.exitCode=1}
 catch(e){console.error(JSON.stringify({phase:'error',ready:false,error:e.message}));process.exitCode=1}
}
if(require.main===module)main();
module.exports={luaFor,audit};
