#!/usr/bin/env node
'use strict';
// Live Book Reader handoff preflight for the existing ORBIT FOCUS detail.
// Read-only: no native memory, installation, filesystem writes or launch.
const {request}=require('./rpc.cjs');
const {verify}=require('./original-book-reader-handoff.cjs');
const {create:createBoundary}=require('./native-rpc-boundary.cjs');
const LUA=[
 'local a=rawget(_G,"__IZ2S_CANONICAL_FOCUS_LUA_V1")',
 'local d=type(a)=="table" and a.detail or nil',
 'local phase=type(a)~="table" and "idle" or type(d)=="table" and "detail" or "other"',
 'local id=type(d)=="table" and d.id=="book-reader" and "book-reader" or type(d)=="table" and "other" or "none"',
 'local kind=type(a)=="table" and a.catalogKind or nil',
 'kind=kind=="source" and "source" or kind=="pc" and "pc" or "none"',
 'local requests=type(a)=="table" and math.min(999999999,math.max(0,tonumber(a.bookReaderLaunchRequests) or 0)) or 0',
 'return "IZ2S_BOOK_READER_SELECTION_V1;phase="..phase..";id="..id..";kind="..kind..";requests="..math.floor(requests)',
].join('\n');
function parse(reply){
 if(typeof reply!=='string'||!reply.startsWith('-> '))throw Error('Unexpected ORBIT FOCUS RPC framing');
 const m=/^IZ2S_BOOK_READER_SELECTION_V1;phase=(idle|other|detail);id=(none|other|book-reader);kind=(none|pc|source)(?:;requests=(0|[1-9][0-9]{0,8}))?$/.exec(reply.slice(3).trim());
 if(!m||(m[1]==='detail'&&m[2]==='none')||(m[1]!=='detail'&&m[2]!=='none')||
   (m[1]==='idle'&&m[3]!=='none')||(m[1]==='detail'&&m[3]==='none'))
  throw Error('Invalid ORBIT FOCUS Book Reader selection');
 return {phase:m[1],selectedId:m[2],catalogKind:m[3],
  bookReaderSelected:m[1]==='detail'&&m[2]==='book-reader',
  launchRequests:m[4]===undefined?0:Number(m[4])};
}
async function inspect(host,{port=9026,packageFile,expectedSha256,send=request,
 verifyPackage=verify,makeBoundary=createBoundary}={}){
 if(typeof host!=='string'||!host.trim()||/\s/.test(host))throw Error('Invalid Switch host');
 if(!Number.isInteger(port)||port<1||port>65535)throw Error('Invalid RPC port');
 if(expectedSha256!==undefined&&!/^[a-f0-9]{64}$/.test(expectedSha256))
  throw Error('Invalid package SHA-256');
 const selected=parse(await send({host,port,timeoutMs:5000,lua:LUA}));
 const result={backend:'balatro',app:'book-reader',mode:'live-original-book-reader-launch-preflight',
  consoleSelection:selected,packageVerified:false,originalNativeSessionReady:false,
  originalApplicationExecuted:false,ready:false};
 if(!selected.bookReaderSelected)
  return {...result,phase:'selection-not-book-reader',blocker:'Select the original Book Reader detail in ORBIT FOCUS'};
 if(!packageFile)
  return {...result,phase:'package-not-supplied',blocker:'Provide the prepared original launcher.iza path'};
 const checked=await verifyPackage(packageFile,{expectedSha256});
 if(checked?.phase!=='package-verified'||checked.id!=='book-reader'||
    checked.sourceFormat!=='IZSDAPP1 native ABI2')throw Error('Original Book Reader package verification failed');
 const boundary=await makeBoundary({host,port}).status();
 return {...result,phase:'native-entry-blocked',packageVerified:true,
  originalPackageSha256:checked.packageSha256,
  packageBytes:checked.packageBytes,companionAssets:checked.companionAssets?.length||0,
  titleLuaAvailable:boundary.titleLuaAvailable===true,
  nativeRpcAvailable:boundary.nativeRpcAvailable===true,
  executableMappingAvailable:boundary.executableMappingAvailable===true,
  blocker:'Original native IZ2S supervisor, owned filesystem and executable mapping are not established'};
}
async function main(){
 const [host,packageFile,expectedSha256]=process.argv.slice(2);
 if(!host){console.error('Usage: node book-reader-launch-preflight.cjs <switch-ip> [prepared-launcher.iza] [sha256]');process.exitCode=2;return;}
 try{const result=await inspect(host,{packageFile,expectedSha256});console.log(JSON.stringify(result,null,2));
  if(!result.packageVerified)process.exitCode=1;
 }catch(error){console.error(JSON.stringify({backend:'balatro',phase:'error',ready:false,error:error.message}));process.exitCode=1;}
}
if(require.main===module)main();
module.exports={LUA,parse,inspect};
