#!/usr/bin/env node
'use strict';
// Offline-only: refuses non-pinned or modified upstream main.lua.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const ROOT=__dirname;
const UPSTREAM_SHA='059d281161ab7639434e4b46608268c7d8ccb49e53ef111e32aa35058adad0e7';
const MAIN_APPEND="-- Optional IZ2S R selector. Guarded extension; original launcher remains intact.\nlocal __iz2s_previous_load=love.load\nfunction love.load(...)\n if type(__iz2s_previous_load)==\"function\" then __iz2s_previous_load(...) end\n local ok,selector=pcall(require,\"iz2s.rboot\")\n if ok and type(selector)==\"table\" and type(selector.install)==\"function\" then\n  local started,err=pcall(selector.install)\n  if not started then pcall(love.filesystem.append,\"bl_log.txt\",\"[IZ2S/R] install failed: \"..tostring(err)..\"\\n\") end\n end\nend\n";
function sha(data){return crypto.createHash('sha256').update(data).digest('hex')}
function stage(source,out){
 const candidates=[path.join(source,'main.lua'),path.join(source,'.lovegame','main.lua')];
 const matches=candidates.filter(p=>fs.existsSync(p)&&fs.statSync(p).isFile());
 if(matches.length!==1)throw Error('Expected one staged original main.lua');
 const original=fs.readFileSync(matches[0]);
 if(sha(original)!==UPSTREAM_SHA)throw Error('Refusing non-v1.1.0 or modified main.lua');
 if(fs.existsSync(out))throw Error('Output already exists; select a fresh directory');
 const focus=fs.readFileSync(path.join(ROOT,'canonical-focus.lua'),'utf8');
 if(!focus.includes('local OP="status"'))throw Error('Unrecognized focus Lua template');
 const files=[
  ['.lovegame/main.lua',Buffer.from(original.toString('utf8')+'\n'+MAIN_APPEND)],
  ['.lovegame/iz2s/rboot.lua',fs.readFileSync(path.join(ROOT,'boot-r-persistent.lua'))],
  ['.lovegame/iz2s/model.lua',fs.readFileSync(path.join(ROOT,'canonical-focus-model.lua'))],
  ['.lovegame/iz2s/visual_base.lua',fs.readFileSync(path.join(ROOT,'canonical-visual-base.lua'))],
  ['.lovegame/iz2s/visual_scene.lua',fs.readFileSync(path.join(ROOT,'canonical-visual-scene.lua'))],
  ['.lovegame/iz2s/focus.lua',Buffer.from(focus.replace('local OP="status"','local OP="start"'))],
 ];
 fs.mkdirSync(out,{recursive:false});
 for(const [name,bytes] of files){
  const target=path.join(out,name);
  fs.mkdirSync(path.dirname(target),{recursive:true});
  fs.writeFileSync(target,bytes,{flag:'wx'});
 }
 const manifest={mode:'offline-stage',upstreamMainSha256:UPSTREAM_SHA,
  automaticTitleBoot:false,activation:'Hold R during first five seconds of Balatro launch',
  files:files.map(([name,bytes])=>({path:'/'+name,size:bytes.length,sha256:sha(bytes)}))};
 fs.writeFileSync(path.join(out,'manifest.json'),JSON.stringify(manifest,null,2)+'\n',{flag:'wx'});
 return manifest;
}
if(require.main===module){
 const [op,source,out]=process.argv.slice(2);
 if(op!=='stage'||!source||!out){console.error('Usage: node boot-r-persistent-stage.cjs stage <pinned-stage-dir> <new-output-dir>');process.exitCode=2}
 else try{console.log(JSON.stringify(stage(path.resolve(source),path.resolve(out)),null,2))}
 catch(e){console.error('FAILED: '+e.message);process.exitCode=1}
}
module.exports={UPSTREAM_SHA,MAIN_APPEND,stage};
