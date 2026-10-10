import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const root=new URL('../',import.meta.url);
const m=JSON.parse(await readFile(new URL('prompts/mobs/manifest.json',root),'utf8'));
assert.equal(m.schema_version,2);assert.equal(m.family,'mobs');
assert.equal(m.total,m.entries.length);assert.equal(m.done,m.total);assert.equal(m.pending,0);
const ids=new Set(),paths=new Set();
for(const e of m.entries){
 assert.equal(e.status,'done',e.name);
 assert.equal(e.file,`prompts/mobs/${e.id}.json`);
 assert.ok(!ids.has(e.id)&&!paths.has(e.texture_path),e.name);
 ids.add(e.id);paths.add(e.texture_path);
 const v=JSON.parse(await readFile(new URL(e.file,root),'utf8'));
 assert.equal(v.schema_version,2,e.name);assert.equal(v.family,'mobs',e.name);
 assert.equal(v.id,e.id,e.name);assert.equal(v.path,e.texture_path,e.name);
 assert.equal(v.name,e.name,e.name);assert.deepEqual(Object.keys(v.stages),['reference'],e.name);
 assert.ok(v.stages.reference?.length>250,e.name);
 assert.ok(/reference/i.test(v.stages.reference),e.name);
 assert.ok(!/PROMPT YOK|placeholder|TBD/i.test(v.stages.reference),e.name);
}
for(const variant of ['black','brown','caerbannog','gold','salt','toast','white','white_splotched'])
 assert.ok(m.entries.some(e=>e.name===`mobs_mc_rabbit_${variant}.png`),'rabbit '+variant);
console.log('Mobs authored reference coverage:',ids.size);
