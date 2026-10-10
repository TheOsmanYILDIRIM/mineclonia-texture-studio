import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const data=JSON.parse(readFileSync(new URL('../js/data/b3d-animation-clips.json',import.meta.url),'utf8'));
const models=Object.entries(data.models);
assert.equal(models.length,85,'all 85 source B3D files must be accounted for');
let sourced=0,unresolved=0;
for(const [model,entry] of models){
 assert.match(model,/\.b3d$/);
 if(!entry.clips.length){unresolved++;assert.equal(entry.status,'unresolved');continue}
 sourced++;
 assert.match(entry.source,/\.lua$/);
 for(const c of entry.clips){
  assert.ok(Number.isInteger(c.start)&&Number.isInteger(c.end)&&c.start>=0&&c.end>=c.start);
  assert.ok(['adult','child'].includes(c.form));
  assert.match(c.name,/^[a-z][a-z0-9_]*$/);
 }
}
assert.equal(sourced,47);
assert.equal(unresolved,38);
const cow=data.models['mobs_mc_cow.b3d'].clips;
assert.ok(cow.some(c=>c.form==='adult'&&c.name==='walk'&&c.start===0&&c.end===40));
assert.ok(cow.some(c=>c.form==='child'&&c.name==='walk'&&c.start===41&&c.end===81));
const rabbit=data.models['mobs_mc_rabbit.b3d'].clips;
assert.ok(rabbit.some(c=>c.form==='child'&&c.start===21&&c.end===41));
const enderman=data.models['mobs_mc_enderman.b3d'].clips;
assert.ok(enderman.some(c=>c.state==='block'&&c.name==='walk'&&c.start===161&&c.end===200));
assert.ok(enderman.some(c=>c.state==='normal'&&c.name==='stand'&&c.start===40&&c.end===80));
const controls=readFileSync(new URL('../js/b3d-preview-controls.js',import.meta.url),'utf8');
assert.ok(!controls.includes('const nativeClips='));
assert.ok(controls.includes('Tüm kareler (ham inceleme)'));
assert.ok(controls.includes('js/data/b3d-animation-clips.json'));
console.log('B3D Lua animation manifest: 85 indexed, 47 source-mapped, 38 unresolved: PASS');
