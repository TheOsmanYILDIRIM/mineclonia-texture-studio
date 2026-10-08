(()=>{
'use strict';

const FAMILY_MANIFESTS=Object.freeze({
  blocks:'prompts/blocks/manifest.json',
  mobs:'prompts/mobs/manifest.json',
  armor:'prompts/armor/manifest.json',
  items:'prompts/items/manifest.json'
});

const recordsById=new Map();
const entriesById=new Map();
const idsByFamily=new Map(Object.keys(FAMILY_MANIFESTS).map(f=>[f,new Set()]));
const pathsByFamily=new Map(Object.keys(FAMILY_MANIFESTS).map(f=>[f,new Set()]));
const manifests=new Map();
const recordLoads=new Map();

function keyOf(target){
  if(!target)return null;
  return typeof target==='string'?target:target.id||null;
}
function record(target){
  const id=keyOf(target);
  return id?recordsById.get(id)||null:null;
}
function entry(target){
  const id=keyOf(target);
  return id?entriesById.get(id)||null:null;
}
function stage(target,name){
  const r=record(target);
  const value=r?.stages?.[name];
  return typeof value==='string'&&value.trim()?value:null;
}
function has(target){const e=entry(target);return !!record(target)||e?.status==='done'}
function family(target){return record(target)?.family||entry(target)?.family||null}
function belongsTo(target,wantedFamily){
  if(!target)return false;
  const e=entry(target);
  if(e)return e.family===wantedFamily;
  const path=typeof target==='object'?target.path:null;
  return !!path&&pathsByFamily.get(wantedFamily)?.has(path);
}
function authoredCount(family){return idsByFamily.get(family)?.size||0}
function manifest(family){return manifests.get(family)||null}

async function loadFamily(family,url){
  const res=await fetch(url,{cache:'force-cache'});
  if(!res.ok)throw new Error(family+' manifest '+res.status);
  const m=await res.json();
  if(m?.schema_version!==2||m?.family!==family||!Array.isArray(m.entries))throw new Error(family+' manifest is not canonical schema v2');
  manifests.set(family,m);

  let authored=0;
  for(const e of m.entries){
    if(!e?.id||!e?.texture_path)continue;
    entriesById.set(e.id,{...e,family});
    pathsByFamily.get(family).add(e.texture_path);
    if(e.status==='done'&&e.file){idsByFamily.get(family).add(e.id);authored++}
  }
  return {family,total:m.entries.length,authored};
}

async function ensure(target){
  const id=keyOf(target);if(!id)return null;
  if(recordsById.has(id))return recordsById.get(id);
  await ready;
  const e=entriesById.get(id);
  if(!e||e.status!=='done'||!e.file)return null;
  if(recordLoads.has(id))return recordLoads.get(id);
  const p=(async()=>{
    const q=await fetch(e.file,{cache:'force-cache'});
    if(!q.ok)throw new Error(e.file+' '+q.status);
    const j=await q.json();
    if(j?.schema_version!==2||j?.family!==e.family||j?.id!==e.id||j?.path!==e.texture_path||!j?.stages||typeof j.stages!=='object'){
      throw new Error('invalid canonical prompt '+e.id);
    }
    const frozen=Object.freeze(j);recordsById.set(id,frozen);return frozen;
  })().finally(()=>recordLoads.delete(id));
  recordLoads.set(id,p);return p;
}

const ready=Promise.all(Object.entries(FAMILY_MANIFESTS).map(([family,url])=>loadFamily(family,url)))
  .then(stats=>{
    console.info('Canonical prompt store ready:',stats);
    window.dispatchEvent(new CustomEvent('mts:prompts-ready',{detail:stats}));
    return stats;
  })
  .catch(err=>{
    console.error('Canonical prompt store failed',err);
    window.dispatchEvent(new CustomEvent('mts:prompts-error',{detail:String(err)}));
    throw err;
  });

window.MTSPromptStore=Object.freeze({
  ready,
  get:record,
  entry,
  stage,
  has,
  family,
  belongsTo,
  authoredCount,
  manifest,
  ensure
});
})();