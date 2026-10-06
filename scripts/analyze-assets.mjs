#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
// IMPORTANT: This file generates STATIC ASSET FACTS only.
// Never add user/browser state here: prompt authored/saved status, edited/changed status,
// variant winner, verification state, timestamps, or any IndexedDB/localStorage-derived value.
// Those remain runtime state so old browser records stay compatible.


const root=path.resolve(path.dirname(new URL(import.meta.url).pathname),'..');
const dataDir=path.join(root,'js','data');
const catalogDir=path.join(dataDir,'catalog');
const loader=fs.readFileSync(path.join(dataDir,'catalog-loader.js'),'utf8');
const mm=loader.match(/const CATALOG_META=(\{.*?\});/s);
if(!mm)throw Error('CATALOG_META not found');
const META=Function('return '+mm[1])();
const rows=fs.readdirSync(catalogDir).filter(x=>x.endsWith('.json')).flatMap(x=>JSON.parse(fs.readFileSync(path.join(catalogDir,x),'utf8')));
const assets=rows.map(r=>({category:META.c[r[0]],mod:META.m[r[1]],priority:META.p[r[2]],w:r[3],h:r[4],animated:!!r[5],rank:r[6],id:'tex_'+r[7],name:r[8]}));

let nodeManifest={nodes:{}};
try{nodeManifest=JSON.parse(fs.readFileSync(path.join(dataDir,'node-faces.json'),'utf8'))}catch{}
const nodeRefs=new Map();
for(const [node,def] of Object.entries(nodeManifest.nodes||{})){
 const all=[...(def.textures||[]),...(def.overlays||[])];
 for(const expr of all)for(const m of String(expr||'').matchAll(/[A-Za-z0-9_./-]+\.png/g)){
  const n=m[0].toLowerCase();if(!nodeRefs.has(n))nodeRefs.set(n,[]);nodeRefs.get(n).push({node,def,expr});
 }
}
const faceRules=[['front',/_(?:front_(?:active|on|off)|front_(?:horizontal|vertical)|front)\.png$/],['back',/_(?:back_lit|back)\.png$/],['top',/_top(?:_damaged_\d+)?\.png$/],['bottom',/_bottom\.png$/],['side',/_side\.png$/],['side1',/_side1\.png$/],['side2',/_side2\.png$/],['side3',/_side3\.png$/],['side4',/_side4\.png$/]];
function faceRole(n){n=n.toLowerCase();for(const [r,re] of faceRules)if(re.test(n))return r;return null}
function family(n){n=n.toLowerCase();for(const [,re] of faceRules)if(re.test(n))return n.replace(re,'');return n.replace(/\.png$/,'')}
function tags(a){
 const n=a.name.toLowerCase(),q=(a.category+'/'+a.mod+'/'+a.name).toLowerCase(),t=new Set();
 t.add('priority:'+a.priority.toLowerCase());t.add('asset:'+a.category.toLowerCase());t.add('mod:'+a.mod.toLowerCase());
 if(a.animated)t.add('animated');
 const fr=faceRole(n);if(fr){t.add('face');t.add('face:'+fr);t.add('family:'+family(n))}
 if(/overlay/.test(n))t.add('overlay');
 if(/palette/.test(n))t.add('palette');
 if(/(?:grass_block_top|grass_block_side_overlay|papyrus|leaves|redstone.*dust|banner_base|leather_desat|collar)/.test(n))t.add('runtime-tint');
 if(/(?:ore|mineral|diamond|emerald|lapis)/.test(q))t.add('ore');
 const refs=nodeRefs.get(n)||[];
 if(refs.length){t.add('lua:node');for(const r of refs){t.add('node:'+r.node);if(String(r.expr).includes('^'))t.add('composite');if((r.def.overlays||[]).length)t.add('node-overlay');if(r.def.palette)t.add('runtime-tint')}}
 if(a.w!==a.h)t.add('non-square');
 if(a.w>16||a.h>16)t.add('atlas-or-hires');
 return [...t].sort();
}
const records={};
for(const a of assets)records[a.id]={name:a.name,mod:a.mod,tags:tags(a)};
const out={schema:1,generator:'scripts/analyze-assets.mjs',count:assets.length,records};
fs.writeFileSync(path.join(dataDir,'asset-tags.json'),JSON.stringify(out));
console.log('asset tags:',assets.length);
