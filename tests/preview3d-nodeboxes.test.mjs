import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {nodeboxMesh,nodeboxKind} from '../js/preview3d-nodeboxes.mjs';
const data=JSON.parse(readFileSync(new URL('../js/data/preview3d-nodeboxes.json',import.meta.url),'utf8'));
assert.equal(data.source.repo,'mineclonia-mirror/mineclonia');
assert.equal(data.profiles.fence.type,'connected');
assert.deepEqual(data.profiles.fence.fixed[0],[-.125,-.5,-.125,.125,.5,.125]);
assert.equal(nodeboxMesh(data.profiles.fence).boxes,1);
assert.equal(nodeboxMesh(data.profiles.fence,['front','back','left','right']).boxes,9);
assert.equal(nodeboxMesh(data.profiles.stair).boxes,2);
assert.equal(nodeboxMesh(data.profiles.fence_gate_closed).boxes,8);
assert.equal(nodeboxMesh(data.profiles.door_half).boxes,1);
assert.equal(nodeboxKind({node:'mcl_stairs:stair_oak'},{name:'oak.png'}),'stair');
assert.equal(nodeboxKind({node:'mcl_fences:fence_oak'},{name:'oak.png'}),'fence');
assert.equal(nodeboxKind({}, {name:'default_stone.png'}),null);
for(const def of Object.values(data.profiles)){
 const m=nodeboxMesh(def);
 assert.ok(m&&m.positions.length%12===0);
 assert.equal(m.uv.length,m.positions.length/3*2);
 assert.equal(m.indices.length,m.positions.length/12*6);
}
console.log('Mineclonia nodebox manifest and mesh checks passed');
