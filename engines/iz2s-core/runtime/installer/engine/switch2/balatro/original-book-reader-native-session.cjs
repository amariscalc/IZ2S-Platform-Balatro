'use strict';
// Original Book Reader via an existing canonical IZ2S native supervisor.
// Never treats title-local Balatro Lua RPC as a native session.
const fs=require('node:fs/promises');
const crypto=require('node:crypto');
const {verify}=require('./original-book-reader-handoff.cjs');
const nativeInstall=require('../../../../../../../core/console/sd-launcher/install.cjs');
const originalPackage=require('../../../../../../../core/console/sd-launcher/package.cjs');
const hash=b=>crypto.createHash('sha256').update(b).digest('hex');
function idle(s){return !!(s&&s.state===2&&s.active===0&&!s.poisoned&&s.catalogStable===true&&!s.auto_scan_error&&Array.isArray(s.applications));}
function owned(supervisor,storage){
 if(!supervisor||!['status','holdMenu','command'].every(n=>typeof supervisor[n]==='function'))throw Error('Native IZ2S supervisor required, Balatro RPC is insufficient');
 if(!storage||!storage.writableMounts?.includes('sd')||!storage.filesystem||storage.uncertain||!['read','openRead','openWrite'].every(n=>typeof storage[n]==='function'))throw Error('Owned native SD filesystem required');
}
function tile(s,crc){if(!idle(s))return null;const found=s.applications.map((app,i)=>({app,i})).filter(x=>x.app?.id==='book-reader'&&x.app?.source==='sd'&&x.app?.headerCrc===crc);return found.length===1?found[0]:null;}
async function install(file,{supervisor,storage,expectedSha256,verifyArtifact=verify,installBytes=nativeInstall.installBytes,decode=originalPackage.decode,readFile=fs.readFile}={}){
 owned(supervisor,storage);
 const a=await verifyArtifact(file,{expectedSha256});
 if(a?.phase!=='package-verified'||a.id!=='book-reader'||a.sourceFormat!=='IZSDAPP1 native ABI2')throw Error('Verified original Book Reader package required');
 if(!idle(await supervisor.status()))throw Error('Native menu must be idle');
 const bytes=await readFile(a.packageFile);
 if(!Buffer.isBuffer(bytes)||bytes.length!==a.packageBytes||hash(bytes)!==a.packageSha256)throw Error('Original package changed');
 const header=decode(bytes);
 if(header?.id!=='book-reader'||!header.native||header.delegated)throw Error('Not a Book Reader native image');
 let lease,result;
 try{
  lease=await supervisor.holdMenu();
  if(!lease?.active||!idle(await supervisor.status())||storage.uncertain)throw Error('Native SD lease unavailable');
  result=await installBytes(storage,bytes,{assets:a.companionAssets});
  if(result?.id!=='book-reader'||result.readbackVerified!==true||result.sha256!==a.packageSha256||storage.uncertain)throw Error('Native SD readback not verified');
 }finally{if(lease?.active)await lease.release({rescan:true});}
 return {phase:'sd-installed-readback-verified',id:'book-reader',headerCrc:result.headerCrc,sha256:result.sha256,readbackVerified:true,nativeCatalogAccepted:false,executedOnConsole:false,ready:false};
}
async function launch({supervisor,headerCrc,checks=24,pause=()=>new Promise(r=>setTimeout(r,250))}={}){
 if(!supervisor||typeof supervisor.status!=='function'||typeof supervisor.command!=='function')throw Error('Native IZ2S supervisor required');
 if(!Number.isInteger(headerCrc)||headerCrc<0||headerCrc>0xffffffff||!Number.isInteger(checks)||checks<1||checks>60)throw Error('Invalid native launch arguments');
 const initial=await supervisor.status();const t=tile(initial,headerCrc);
 if(!t||t.i>=15||!Number.isSafeInteger(initial.native_launches))throw Error('Book Reader is not verified in native SD menu');
 await supervisor.command(t.i+1);
 for(let i=0;i<checks;i++){
  const s=await supervisor.status();
  if(s?.poisoned||s?.state===4||s?.launchFailure?.id==='book-reader'||s?.last_id==='book-reader'&&s?.last_app_error)return {phase:'native-launch-failed',executedOnConsole:false,ready:false,error:s.launchFailure?.error||s.last_app_error||s.error};
  if(s?.native_launches>initial.native_launches&&s?.last_id==='book-reader'&&s.active>0)return {phase:'native-app-running',id:'book-reader',executedOnConsole:true,ready:true};
  if(i+1<checks)await pause();
 }
 return {phase:'native-launch-unconfirmed',executedOnConsole:false,ready:false};
}
module.exports={idle,owned,tile,install,launch};
