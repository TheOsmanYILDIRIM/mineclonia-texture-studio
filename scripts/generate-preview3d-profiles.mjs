#!/usr/bin/env node
import fs from 'node:fs';

const [input='js/data/node-faces.json',output='js/data/preview3d-profiles.generated.json']=process.argv.slice(2);
const src=JSON.parse(fs.readFileSync(input,'utf8'));
const faceOrder=src.face_order||['top','bottom','right','left','back','front'];

function expand(list=[]){
  if(!list.length)return [];
  if(list.length===1)return Array(6).fill(list[0]);
  if(list.length===2)return [list[0],list[1],list[1],list[1],list[1],list[1]];
  if(list.length===3)return [list[0],list[1],list[2],list[2],list[2],list[2]];
  return Array.from({length:6},(_,i)=>list[i]||list[0]);
}
function splitExpr(expr){
  return String(expr||'').split('^').map(s=>s.trim()).filter(Boolean).map(texture=>({texture}));
}
function profileFor(node,def){
  const tex=expand(def.textures||[]),ov=expand(def.overlays||[]);
  if(!tex.length)return null;
  const faces={};
  const logical=['top','bottom','east','west','north','south'];
  for(let i=0;i<6;i++){
    const layers=splitExpr(tex[i]);
    for(const x of splitExpr(ov[i]))layers.push(x);
    if(def.color&&def.palette&&layers.length)layers[layers.length-1]={...layers[layers.length-1],tint:def.color};
    faces[logical[i]]=layers.length?layers:[{texture:tex[0]}];
  }
  const names=[...new Set([...tex,...ov].flatMap(x=>String(x||'').match(/[A-Za-z0-9_./-]+\.png/g)||[]))];
  return {id:'node:'+node,match:{names},node,geometry:'cube',projection:'orthographic',faces};
}
const profiles=[];
for(const [node,def] of Object.entries(src.nodes||{})){const p=profileFor(node,def);if(p)profiles.push(p)}
fs.writeFileSync(output,JSON.stringify({schema_version:1,source:src.source||'Mineclonia node faces',generated:true,profiles},null,2)+'\n');
console.log('generated',profiles.length,'preview profiles');
