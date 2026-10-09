import assert from 'node:assert/strict';
import {triangleUV,uvBounds,findUVTriangle} from '../js/b3d-uv-selection.mjs';
const mesh={uv:[.1,.2,.5,.2,.1,.7,.8,.8,.9,.8,.8,.9],idx:[0,1,2,3,4,5]};
assert.equal(findUVTriangle(mesh,.2,.3),0);
assert.equal(findUVTriangle(mesh,.82,.82),1);
assert.equal(findUVTriangle(mesh,.65,.5),-1);
assert.deepEqual(uvBounds(triangleUV(mesh,0),100,100),{x:10,y:20,w:40,h:50});
assert.throws(()=>triangleUV(mesh,99));
console.log('B3D UV triangle mapping: PASS');
