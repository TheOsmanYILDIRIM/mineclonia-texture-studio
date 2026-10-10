#!/usr/bin/env node
// Rebuild the B3D animation manifest from a local checkout of the pinned
// Mineclonia source. Literal numeric Lua fields only: never infer clip names.
import fs from 'node:fs';
import path from 'node:path';
const [sourceRoot,manifestPath='js/data/b3d-animation-clips.json']=process.argv.slice(2);
if(!sourceRoot){console.error('Usage: node scripts/extract-b3d-animation-clips.mjs <mineclonia-checkout> [manifest.json]');process.exit(2)}
const manifest=JSON.parse(fs.readFileSync(manifestPath,'utf8'));
const files=[];
function walk(dir){for(const ent of fs.readdirSync(dir,{withFileTypes:true})){const p=path.join(dir,ent.name);if(ent.isDirectory())walk(p);else if(p.endsWith('.lua'))files.push(p)}}
walk(path.join(sourceRoot,'mods','ENTITIES','mobs_mc'));
function table(src,start){
 const at=src.indexOf('{',start);if(at<0)return null;
 let depth=0,quote=null,escaped=false;
 for(let i=at;i<src.length;i++){
  const c=src[i];
  if(quote){if(escaped)escaped=false;else if(c==='\\')escaped=true;else if(c===quote)quote=null;continue}
  if(c==="'"||c==='"'){quote=c;continue}
  if(c==='{')depth++;
  else if(c==='}'&&!--depth)return {body:src.slice(at+1,i),end:i+1};
 }
 return null;
}
const entries={};
for(const file of files.sort()){
 const src=fs.readFileSync(file,'utf8');
 const meshes=[...src.matchAll(/\bmesh\s*=\s*["']([^"']+\.b3d)["']/g)];
 for(let m=0;m<meshes.length;m++){
  const model=path.basename(meshes[m][1]);
  if(!Object.hasOwn(manifest.models,model))continue;
  const frag=src.slice(meshes[m].index,meshes[m+1]?.index??src.length);
  const clips=[],re=/\b(animation|_child_animations)\s*=\s*\{/g;
  let match;
  while((match=re.exec(frag))){
   const b=table(frag,match.index);if(!b)continue;
   const fields={};
   for(const x of b.body.matchAll(/\b([a-z][a-z0-9_]*)\s*=\s*(-?\d+(?:\.\d+)?)/g))fields[x[1]]=Number(x[2]);
   const keys=new Set(Object.keys(fields).filter(k=>k.endsWith('_start')).map(k=>k.slice(0,-6)));
   for(const key of keys){
    const start=fields[key+'_start'],end=fields[key+'_end'];
    if(!Number.isInteger(start)||!Number.isInteger(end)||start<0||end<start)continue;
    const speed=fields[key+'_speed']??(key==='walk'?fields.speed_normal:key==='run'?fields.speed_run:undefined);
    clips.push({name:key,form:match[1]==='_child_animations'?'child':'adult',start,end,
      ...(Number.isFinite(speed)&&speed>0?{speed}:{})});
   }
   re.lastIndex=b.end;
  }
  if(clips.length&&(!entries[model]||clips.length>entries[model].clips.length))
   entries[model]={source:path.relative(sourceRoot,file).replaceAll(path.sep,'/'),clips};
 }
}
// Enderman selects animation ranges through a Lua helper, not a literal
// animation table attached to its mesh registration.
const endermanFile=path.join(sourceRoot,'mods','ENTITIES','mobs_mc','enderman.lua');
if(fs.existsSync(endermanFile)){
 const source=fs.readFileSync(endermanFile,'utf8'),clips=[];
 const re=/(?:if|elseif)\s+animation_type\s*==\s*["'](block|normal)["'][^{}]{0,120}?return\s*\{/g;
 let m;
 while((m=re.exec(source))){
  const b=table(source,m.index);if(!b)continue;
  const fields={};
  for(const x of b.body.matchAll(/\b([a-z][a-z0-9_]*)\s*=\s*(\d+)/g))fields[x[1]]=Number(x[2]);
  for(const name of new Set(Object.keys(fields).filter(k=>k.endsWith('_start')).map(k=>k.slice(0,-6)))){
   const start=fields[name+'_start'],end=fields[name+'_end'],speed=fields[name+'_speed'];
   if(Number.isInteger(start)&&Number.isInteger(end)&&end>=start)
    clips.push({name,form:'adult',state:m[1],start,end,...(Number.isFinite(speed)&&speed>0?{speed}:{})});
  }
  re.lastIndex=b.end;
 }
 if(clips.length)entries['mobs_mc_enderman.b3d']={source:'mods/ENTITIES/mobs_mc/enderman.lua',status:'source_helper_select_enderman_animation',clips};
}
for(const model of Object.keys(manifest.models))
 manifest.models[model]=entries[model]||{source:null,clips:[],status:'unresolved'};
fs.writeFileSync(manifestPath,JSON.stringify(manifest,null,2)+'\n');
console.log('Lua-sourced:',Object.keys(entries).length,'of',Object.keys(manifest.models).length);
