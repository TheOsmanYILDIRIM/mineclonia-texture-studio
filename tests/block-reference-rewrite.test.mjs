import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const root=new URL('../',import.meta.url);
const expected=[["6f8775a783","mcl_core_frosted_ice_0.png"],["19870d6f6b","mcl_core_frosted_ice_1.png"],["9ab3930f45","mcl_core_frosted_ice_2.png"],["0be3faf0c4","mcl_core_frosted_ice_3.png"],["0ad5b44126","mcl_core_glass_black.png"],["2a23481025","mcl_core_glass_black_detail.png"],["ccdff60625","mcl_core_glass_blue.png"],["c6fbf57802","mcl_core_glass_blue_detail.png"],["5c49040f98","mcl_core_glass_brown.png"],["563e29a494","mcl_core_glass_brown_detail.png"],["49aaa1ba5a","mcl_core_glass_cyan.png"],["c345e6ab75","mcl_core_glass_cyan_detail.png"],["af49416fd2","mcl_core_glass_gray.png"],["63e84376f0","mcl_core_glass_gray_detail.png"],["896996d185","mcl_core_glass_green.png"],["d720838421","mcl_core_glass_green_detail.png"],["bcd7920314","mcl_core_glass_light_blue.png"],["8eb6720383","mcl_core_glass_light_blue_detail.png"],["3d66b726f3","mcl_core_glass_lime.png"],["37f60ce525","mcl_core_glass_lime_detail.png"]];
const names=new Set(),ids=new Set(),contents=new Set();
for(const [id,name] of expected){
 const file=new URL(`prompts/blocks/tex_${id}.json`,root);
 const j=JSON.parse(await readFile(file,'utf8'));
 assert.equal(j.schema_version,2);assert.equal(j.family,'blocks');
 assert.equal(j.id,'tex_'+id);assert.equal(j.name,name);assert.equal(j.path,'ITEMS/mcl_core/'+name);
 const ref=j.stages.reference;
 assert.ok(ref.length>500,name);assert.ok(!ref.includes('Treat this exact surface, face or component as its own material problem.'),name);
 assert.ok(!ids.has(j.id)&&!names.has(name)&&!contents.has(ref));
 ids.add(j.id);names.add(name);contents.add(ref);
}
const queue=await readFile(new URL('docs/BLOCK_REFERENCE_REWRITE_QUEUE.md',root),'utf8');
assert.equal((queue.match(/^- \[x\] /gm)||[]).length,20);
console.log('PASS 20 individually authored block references and rewrite queue');
