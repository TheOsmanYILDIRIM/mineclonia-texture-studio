#!/usr/bin/env node
// Generic Luanti/Mineclonia static face extractor.
// Usage: node scripts/extract-luanti-node-faces.mjs <lua-file-or-directory...>
// Output schema is intentionally game/mod agnostic: node name + tiles/overlay_tiles/palette/color/paramtype2.
// This conservative parser extracts literal core/minetest.register_node blocks and literal tile strings.
// Dynamic registration helpers remain explicit adapter work rather than guessed mappings.
import fs from 'node:fs';
import path from 'node:path';

const inputs=process.argv.slice(2);
if(!inputs.length){console.error('usage: node scripts/extract-luanti-node-faces.mjs <lua paths...>');process.exit(2)}
function walk(p,out=[]){const st=fs.statSync(p);if(st.isDirectory())for(const n of fs.readdirSync(p))walk(path.join(p,n),out);else if(/\.lua$/i.test(p))out.push(p);return out}
function balanced(src,start){
 let depth=0,quote=null,escaped=false;
 for(let i=start;i<src.length;i++){
  const c=src[i];
  if(quote){
   if(escaped)escaped=false;
   else if(c==='\\\\')escaped=true;
   else if(c===quote)quote=null;
   continue;
  }
  if(c==='"'||c==="'"){quote=c;continue}
  if(c==='{')depth++;
  else if(c==='}'){depth--;if(depth===0)return src.slice(start,i+1)}
 }
 return null;
}
function field(body,key){const m=new RegExp('(?:^|[\\n,])\\s*'+key+'\\s*=\\s*').exec(body);if(!m)return null;let i=m.index+m[0].length;if(body[i]==='{')return balanced(body,i);const s=body.slice(i).match(/^["']([^"']*)["']/);return s?s[1]:null}
function tiles(v){if(!v)return null;const out=[];for(const m of v.matchAll(/(?:name\s*=\s*)?["']([^"']+\.png(?:\^[^"']+)?)["']/g))out.push(m[1]);return out.length?out:null}
const nodes={};
for(const file of inputs.flatMap(p=>walk(p))){
 const src=fs.readFileSync(file,'utf8'),re=/(?:core|minetest)\.register_node\s*\(\s*["']([^"']+)["']\s*,\s*\{/g;let m;
 while((m=re.exec(src))){const brace=src.indexOf('{',m.index),body=balanced(src,brace);if(!body)continue;const t=tiles(field(body,'tiles'));if(!t)continue;nodes[m[1]]={textures:t};const o=tiles(field(body,'overlay_tiles'));if(o)nodes[m[1]].overlays=o;for(const k of ['palette','color','paramtype2']){const v=field(body,k);if(typeof v==='string')nodes[m[1]][k]=v}re.lastIndex=brace+body.length}
}
process.stdout.write(JSON.stringify({schema:1,source:'Luanti Lua static extraction',face_order:['top','bottom','right','left','back','front'],nodes},null,2));
