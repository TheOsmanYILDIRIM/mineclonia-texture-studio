import assert from 'node:assert/strict';
import {createPlan,loadPlan,pack,unpack,estimateShift} from '../js/uv-generation-roundtrip.mjs';
const img=(w,h)=>({width:w,height:h,data:new Uint8ClampedArray(w*h*4)});
const set=(im,x,y,rgba)=>im.data.set(rgba,(y*im.width+x)*4);
const get=(im,x,y)=>Array.from(im.data.slice((y*im.width+x)*4,(y*im.width+x)*4+4));
function source(kind){
 const im=img(64,32);
 for(let y=0;y<32;y++) for(let x=0;x<64;x++){
  const on=kind==='enderman'?((x<28&&y>5&&y<24)||(x>44&&y<29)||(x>8&&x<17&&y<6)||(x>20&&x<32&&y>24)):
   ((x<20&&y<10)||(x>=20&&x<40&&y<22)||(x>=40&&x<48&&y<12)||(x<20&&y>=10&&y<28)||(x>=26&&x<35&&y>=29));
  // Includes totally black foreground and hidden-RGB background to ensure alpha authority.
  set(im,x,y,on?[(x+y)%3?0:5,(x+y)%7,0,255]:[77,44,16,0]);
 }
 return im;
}
function shifted(im,dx,dy) {
 const r=img(im.width,im.height);
 for(let y=0;y<im.height;y++)for(let x=0;x<im.width;x++){
  const tx=x+dx,ty=y+dy;if(tx>=0&&ty>=0&&tx<im.width&&ty<im.height)set(r,tx,ty,get(im,x,y));
 } return r;
}
function roundtrip(kind,options) {
 const orig=source(kind),p=createPlan(orig,options);
 const forward=pack(orig,p),loaded=loadPlan(orig,JSON.parse(JSON.stringify(p.manifest)));
 assert.deepEqual(Array.from(loaded.occupied),Array.from(p.occupied));
 const inverse=unpack(orig,forward,p,{autoShift:false});
 const s=p.manifest.scale;
 assert.equal(inverse.image.width,orig.width*s);
 assert.equal(inverse.image.height,orig.height*s);
 for(let y=0;y<32;y++)for(let x=0;x<64;x++){
  assert.deepEqual(get(inverse.image,x*s+Math.floor(s/2),y*s+Math.floor(s/2)),get(orig,x,y),kind+' texel '+x+','+y);
 }
 assert.equal(inverse.report.borderMagentaCandidates,0);
 assert.equal(inverse.report.originalAlphaForced,true);
 assert.equal(inverse.report.rawGeneratedGeometryIoU,'not measured');
 for(let y=0;y<forward.height;y++)for(let x=0;x<forward.width;x++){
  if(!p.occupied[Math.floor(y/s)*p.manifest.layout_size[0]+Math.floor(x/s)])continue;
  const c=get(forward,x,y);
  assert.ok(!(c[0]>85&&c[2]>85&&c[1]<50),'grid invaded UV pixel');
 }
 console.log('PASS '+kind+' exact pack→unpack including alpha, background, original UV color');
 return {orig,plan:p,packed:forward};
}
const cat=source('cat');
const catMap={source_size:[64,32],layout_size:[64,64],groups:[
 {id:'head',source:[0,0,20,10],dest:[8,19]},
 {id:'body',source:[20,0,40,22],dest:[28,15]},
 {id:'tail',source:[40,0,48,12],dest:[48,20]},
 {id:'legs',source:[0,10,20,28],dest:[28,37]},
 {id:'strip',source:[26,29,35,32],dest:[32,55]}
]};
roundtrip('cat',{scale:4,spacing:16,clearance:2,mapping:catMap});
const e=roundtrip('enderman',{scale:4,spacing:16,clearance:2});
assert.equal(e.plan.manifest.groups[0].dest[1],16);
assert.equal(get(e.packed,15,15)[3],255);
assert.deepEqual(get(e.packed,15,15).slice(0,3),[28,31,39]);
// Global grid shift detection (both axes independently); correction must NOT silently warp.
const shiftedImage=shifted(e.packed,3,-2), alignment=estimateShift(shiftedImage,e.plan,5);
assert.equal(alignment.dx,3);assert.equal(alignment.dy,-2);assert.equal(alignment.applied,true);
const restored=unpack(e.orig,shiftedImage,e.plan,{autoShift:true});
assert.deepEqual(get(restored.image,80,80),get(unpack(e.orig,e.packed,e.plan,{autoShift:false}).image,80,80));
console.log('PASS bounded 2-axis grid-registration correction');
// Protect from overlapping source groups and missing opaque mappings.
assert.throws(()=>createPlan(cat,{scale:2,mapping:{source_size:[64,32],layout_size:[64,64],groups:[{id:'tiny',source:[0,0,2,2],dest:[3,3]}]}}),/Unmapped opaque/);
assert.throws(()=>unpack(e.orig,img(512,512),e.plan),/size changed/);
console.log('PASS bad map / wrong AI canvas refused');
// Magenta may leak inside a border pixel; repair from same UV island, NOT from matte.
const contaminated=img(e.packed.width,e.packed.height);contaminated.data.set(e.packed.data);
const x=4*8,y=4*(16+6); // UV edge at x=8 y=7 (native), top of head rectangular face
assert.equal(e.plan.occupied[Math.floor(y/4)*64+Math.floor(x/4)],1);
set(contaminated,x,y,[255,0,255,255]);
const repaired=unpack(e.orig,contaminated,e.plan,{repairMagenta:true,autoShift:false,edgeBand:3,repairRadius:5});
assert.ok(repaired.report.borderMagentaRepaired>0);
assert.notDeepEqual(get(repaired.image,x,y).slice(0,3),[255,0,255]);
console.log('PASS bounded magenta fringe repair without changing alpha');
