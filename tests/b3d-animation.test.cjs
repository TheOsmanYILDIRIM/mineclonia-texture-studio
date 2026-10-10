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

 // An animated mesh-owner NODE must carry unweighted vertices rigidly.
 // Without this, non-BONE model parts remain frozen while weighted parts move.
function rigidOwnerFixture(){
 const vt=chunk('VRTS',i(0),i(1),i(2),...[0,0,0,0,0,1,0,0,1,0,0,1,0,1,1].map(f));
 const tri=chunk('TRIS',i(0),i(0),i(1),i(2));
 const key=(frame,x)=>cat(i(frame),f(x),f(0),f(0));
 const keys=chunk('KEYS',i(1),key(0,0),key(10,1));
 return chunk('BB3D',i(1),node('moving-owner',[0,0,0],chunk('MESH',i(0),vt,tri),keys),chunk('ANIM',i(0),i(10),f(10))).buffer;
}
const rigid=parse(rigidOwnerFixture());
const rigid0=Array.from(rigid.sample(0)),rigid10=Array.from(rigid.sample(10));
assert.equal(rigid.bones,0);
for(let v=0;v<3;v++)assert.ok(Math.abs((rigid10[v*3]-rigid0[v*3])-1.55)<1e-5,'owner animated rigid vertex '+v);
console.log('B3D animated mesh-owner rigid vertices: PASS');

console.log('B3D animation synthetic weighted-vertex interpolation + valid empty BONE chunk: PASS');



// Real Mineclonia pig/cat/wolf rigs use rest-space quaternions whose skeletal
// rotation direction is opposite the legacy static mesh-owner transform.
// This fixture reproduces the giant-pivot-radius regression without storing
// copyrighted model binaries: a bone at +Z=6 must not rotate geometry around -Z=6.
const nodeWithRotation=(name,p,q,...children)=>chunk('NODE',bytes(name+String.fromCharCode(0)),...p.map(f),...[1,1,1].map(f),...q.map(f),...children);
const near=(actual,expected,eps=1e-4)=>assert.ok(Math.abs(actual-expected)<eps,actual+' !== '+expected);
function handednessFixture(){
 const verts=chunk('VRTS',i(0),i(1),i(2),...[0,0,6,0,0, 1,0,6,1,0, 0,1,6,0,1].map(f));
 const triangles=chunk('TRIS',i(0),i(0),i(1),i(2));
 const boneWeights=chunk('BONE',...[0,1,2].flatMap(v=>[i(v),f(1)]));
 const a=Math.PI/4,b=Math.PI/12;
 const rotation=chunk('KEYS',i(4),i(0),...[1,0,0,0].map(f),i(10),...[Math.cos(b),Math.sin(b),0,0].map(f));
 const body=nodeWithRotation('body',[0,0,0],[Math.cos(a),-Math.sin(a),0,0],
   node('bone',[0,6,0],boneWeights,rotation));
 const mesh=node('root',[0,0,0],chunk('MESH',i(0),verts,triangles),body);
 return chunk('BB3D',i(1),mesh,chunk('ANIM',i(0),i(10),f(10))).buffer;
}
const handed=parse(handednessFixture());
const h0=Array.from(handed.sample(0)),h10=Array.from(handed.sample(10));
for(let axis=0;axis<3;axis++)near(h0[axis],handed.mesh.p[axis]);
// The first vertex is exactly on the correct bind pivot; it must not fly away.
near(Math.hypot(...h10.slice(0,3).map((x,j)=>x-h0[j])),0,2e-4);
// A vertex one unit from the pivot must move, but by less than a model unit.
const swing=Math.hypot(...h10.slice(6,9).map((x,j)=>x-h0[j+6]));
assert.ok(swing>0.2&&swing<1.5,'bone swing radius must match its nearby vertex: '+swing);

// Unweighted static meshes retain the original mesh-owner transform and UVs.
// Changing skeletal handedness must not shift the static reference at rest.
const v2=chunk('VRTS',i(0),i(1),i(2),...[0,0,0,0,0, 0,1,0,1,0, 1,0,0,0,1].map(f));
const meshOwner=nodeWithRotation('owner',[0,0,0],[Math.SQRT1_2,-Math.SQRT1_2,0,0],
 chunk('MESH',i(0),v2,chunk('TRIS',i(0),i(0),i(1),i(2))));
const staticRotated=parse(chunk('BB3D',i(1),meshOwner).buffer);
near(staticRotated.mesh.p[0],-0.775);
near(staticRotated.mesh.p[2],0.775);
near(staticRotated.mesh.p[5],-0.775);
near(staticRotated.mesh.p[8],0.775);
assert.deepEqual(Array.from(staticRotated.mesh.uv),[0,0,1,0,0,1]);
console.log('B3D skeletal handedness + unchanged static mesh-owner parity: PASS');
