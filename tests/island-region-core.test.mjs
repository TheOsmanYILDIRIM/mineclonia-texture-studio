import assert from 'node:assert/strict';
import {boundsOf,extractRegion,compositeRegion,scaleSavedRects} from '../js/island-region-core.mjs';
const rgba=(w,h,f)=>{const data=new Uint8ClampedArray(w*h*4);for(let y=0;y<h;y++)for(let x=0;x<w;x++)data.set(f(x,y),(y*w+x)*4);return{width:w,height:h,data}};
const base=rgba(6,4,(x,y)=>[10+x,30+y,50, (x===2&&y===1)?0:255]);
const chosen=[{x:1,y:1,w:2,h:2},{x:4,y:0,w:1,h:3}];
assert.deepEqual(boundsOf(chosen,6,4).w,4);
const patch=extractRegion(base,chosen);
assert.equal(patch.image.width,4);assert.equal(patch.image.height,3);
assert.deepEqual([...patch.image.data.slice(0,4)],[0,0,0,0],'outside selected rect is transparent');
assert.deepEqual([...patch.image.data.slice(4*4,4*5)],[11,31,50,255],'selected pixels export unchanged');
const filled=rgba(4,3,()=>[222,111,90,255]);
const merged=compositeRegion(base,filled,chosen);
for(let y=0;y<4;y++)for(let x=0;x<6;x++){
 const p=(y*6+x)*4,inside=chosen.some(r=>x>=r.x&&x<r.x+r.w&&y>=r.y&&y<r.y+r.h);
 assert.equal(merged.image.data[p+3],base.data[p+3],'alpha is always byte-identical');
 if(!inside||base.data[p+3]===0)assert.deepEqual([...merged.image.data.slice(p,p+4)],[...base.data.slice(p,p+4)],'outside and invisible texels untouched');
 else assert.deepEqual([...merged.image.data.slice(p,p+3)],[222,111,90],'visible selection replaced');
}
assert.equal(merged.selected,7);
const atlas=rgba(12,8,(x,y)=>[x,y,70,255]);
const full=compositeRegion(base,atlas,[{x:0,y:0,w:2,h:2}],{mode:'atlas'});
assert.deepEqual([...full.image.data.slice(0,3)],[1,1,70],'atlas import samples corresponding entire-atlas location');
assert.deepEqual([...full.image.data.slice(4*5,4*5+4)],[...base.data.slice(4*5,4*5+4)],'atlas outside mask untouched');
const shift=compositeRegion(base,filled,[{x:1,y:1,w:2,h:2}],{dx:100});
assert.deepEqual([...shift.image.data],[...base.data],'out-of-bounds alignment cannot erase existing pixels');
assert.deepEqual(scaleSavedRects([{x:1,y:1,w:2,h:2}],6,4,12,8),[{x:2,y:2,w:4,h:4}]);
const empty=rgba(4,3,()=>[0,0,0,0]);
assert.deepEqual([...compositeRegion(base,empty,chosen).image.data],[...base.data],'transparent imported pixels do not erase alpha or colors');
assert.throws(()=>extractRegion(base,[{x:99,y:99,w:2,h:2}]));

const colored=rgba(8,4,(x,y)=>x<4?[20+x,5,7,255]:[140+x,9,12,255]);
const dst=rgba(4,4,()=>[13,17,19,255]);
const onlyRight=compositeRegion(dst,colored,[{x:1,y:1,w:2,h:2}],{sourceRect:{x:4,y:0,w:4,h:4}});
for(let y=0;y<4;y++)for(let x=0;x<4;x++){
 const i=(y*4+x)*4;
 if(x>=1&&x<=2&&y>=1&&y<=2)assert.ok(onlyRight.image.data[i]>=144,'only source island from RIGHT is sampled');
 else assert.deepEqual([...onlyRight.image.data.slice(i,i+4)],[13,17,19,255],'all unselected target pixels untouched');
}
assert.equal(onlyRight.image.data[(1*4+1)*4],145,'selected crop maps its own left edge, not imported atlas left');
assert.throws(()=>compositeRegion(dst,colored,[{x:0,y:0,w:1,h:1}],{sourceRect:{x:99,y:0,w:2,h:2}}),/outside PNG/);

console.log('UV partial-region extraction, masking, alpha lock, atlas mapping and saved rectangle scaling: PASS');
