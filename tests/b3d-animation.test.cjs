// node tests/b3d-animation.test.cjs — no external dependencies
const assert=require('node:assert/strict');
const fs=require('node:fs'), vm=require('node:vm'), path=require('node:path');
const sandbox={window:{}};vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../js/b3d-animation.js'),'utf8'),sandbox);
const {parse}=sandbox.window.MTSB3DAnimation;
const bytes=s=>Uint8Array.from([...s].map(c=>c.charCodeAt(0)));
const cat=(...a)=>{const o=new Uint8Array(a.reduce((sum,v)=>sum+v.length,0));let p=0;for(const v of a){o.set(v,p);p+=v.length}return o};
const i=n=>{const a=new Uint8Array(4);new DataView(a.buffer).setInt32(0,n,true);return a};
const f=n=>{const a=new Uint8Array(4);new DataView(a.buffer).setFloat32(0,n,true);return a};
const chunk=(tag,...body)=>{const v=cat(...body);return cat(bytes(tag),i(v.length),v)};
const node=(name,p,...children)=>chunk('NODE',bytes(name+'\0'),...p.map(f),...[1,1,1,1,0,0,0].map(f),...children);
function fixture(){
 const vt=chunk('VRTS',i(0),i(1),i(2),...[0,0,0,0,0,1,0,0,1,0,0,1,0,1,1].map(f));
 const tri=chunk('TRIS',i(0),i(0),i(1),i(2));
 const weights=chunk('BONE',...[0,1,2].flatMap(n=>[i(n),f(1)]));
 const key=(frame,x)=>cat(i(frame),f(x),f(0),f(0));
 const keys=chunk('KEYS',i(1),key(0,0),key(10,1));
 const root=node('mesh',[0,0,0],chunk('MESH',i(0),vt,tri),node('bone',[0,0,0],chunk('BONE'),weights,keys));
 const b=chunk('BB3D',i(1),root,chunk('ANIM',i(0),i(10),f(10)));
 return b.buffer;
}
const a=parse(fixture());
assert.equal(a.animated,true);
assert.equal(a.bones,1);
assert.equal(a.frames,10);
assert.equal(a.mesh.idx.length,3);
const p0=Array.from(a.sample(0)),p5=Array.from(a.sample(5)),p10=Array.from(a.sample(10));
for(let v=0;v<3;v++){
 assert.ok(Math.abs(p5[v*3]-p0[v*3]-0.775)<1e-5,'half-frame interpolates animated translation');
 assert.ok(Math.abs(p10[v*3]-p0[v*3]-1.55)<1e-5,'end-frame reaches full animated translation');
 for(let c=1;c<3;c++)assert.equal(p0[v*3+c],p10[v*3+c],'unanimated axes unchanged');
}
assert.deepEqual(Array.from(a.mesh.uv),[0,0,1,0,1,1]);
assert.deepEqual(Array.from(a.mesh.idx),[0,1,2]);
console.log('B3D animation synthetic weighted-vertex interpolation + valid empty BONE chunk: PASS');

function rigidFixture(){
 const vt=chunk('VRTS',i(0),i(1),i(2),...[0,0,0,0,0,1,0,0,1,0,0,1,0,1,1].map(f));
 const tri=chunk('TRIS',i(0),i(0),i(1),i(2));
 const key=(frame,x)=>cat(i(frame),f(x),f(0),f(0));
 const root=node('animated-mesh',[0,0,0],chunk('MESH',i(0),vt,tri),chunk('KEYS',i(1),key(0,0),key(10,1)));
 return chunk('BB3D',i(1),root,chunk('ANIM',i(0),i(10),f(10))).buffer;
}
const rigid=parse(rigidFixture());
assert.equal(rigid.animated,true);
assert.equal(rigid.bones,0);
const r0=rigid.sample(0).slice(),r5=rigid.sample(5).slice(),r10=rigid.sample(10).slice();
for(let vertex=0;vertex<3;vertex++){
 assert.ok(Math.abs(r5[vertex*3]-r0[vertex*3]-.775)<1e-5,'unweighted mesh follows animated owner node at half frame');
 assert.ok(Math.abs(r10[vertex*3]-r0[vertex*3]-1.55)<1e-5,'unweighted mesh follows animated owner node at end frame');
}
console.log('B3D unweighted animated mesh owner transform: PASS');
