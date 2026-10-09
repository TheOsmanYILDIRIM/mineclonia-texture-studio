/* Mineclonia B3D skeletal animation - CPU skinning; no changes to saved UV/texture data. */
(()=>{'use strict';
const ident=()=>[1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1];
const mul=(a,b)=>{const o=new Array(16).fill(0);for(let c=0;c<4;c++)for(let r=0;r<4;r++)for(let k=0;k<4;k++)o[c*4+r]+=a[k*4+r]*b[c*4+k];return o};
function inverse(a){const m=Array.from({length:4},(_,r)=>Array.from({length:8},(_,c)=>c<4?a[c*4+r]:Number(c-4===r)));for(let k=0;k<4;k++){let p=k;for(let r=k+1;r<4;r++)if(Math.abs(m[r][k])>Math.abs(m[p][k]))p=r;if(Math.abs(m[p][k])<1e-9)throw Error('Singular B3D bind matrix');[m[p],m[k]]=[m[k],m[p]];const d=m[k][k];for(let c=0;c<8;c++)m[k][c]/=d;for(let r=0;r<4;r++)if(r!==k){const f=m[r][k];for(let c=0;c<8;c++)m[r][c]-=f*m[k][c]}}return Array.from({length:16},(_,i)=>m[i%4][4+Math.floor(i/4)])}
function matrix(p,s,q){const [w,x,y,z]=q,xx=x*x,yy=y*y,zz=z*z,xy=x*y,xz=x*z,yz=y*z,wx=w*x,wy=w*y,wz=w*z;return [(1-2*(yy+zz))*s[0],(2*(xy+wz))*s[0],(2*(xz-wy))*s[0],0,(2*(xy-wz))*s[1],(1-2*(xx+zz))*s[1],(2*(yz+wx))*s[1],0,(2*(xz+wy))*s[2],(2*(yz-wx))*s[2],(1-2*(xx+yy))*s[2],0,p[0],p[1],p[2],1]}
function point(m,v){const x=v[0],y=v[1],z=v[2];return [m[0]*x+m[4]*y+m[8]*z+m[12],m[1]*x+m[5]*y+m[9]*z+m[13],m[2]*x+m[6]*y+m[10]*z+m[14]]}
const lerp=(a,b,t)=>a.map((x,i)=>x+(b[i]-x)*t);
function slerp(a,b,t){let d=a.reduce((s,v,i)=>s+v*b[i],0);let bb=b;if(d<0){bb=b.map(v=>-v);d=-d}if(d>.9995){const q=lerp(a,bb,t),n=Math.hypot(...q)||1;return q.map(v=>v/n)}const theta=Math.acos(Math.min(1,d)),s=Math.sin(theta);return a.map((v,i)=>(Math.sin((1-t)*theta)*v+Math.sin(t*theta)*bb[i])/s)}
function sampleKeys(node,frame){const keys=node.keys;if(!keys.length)return {p:node.pos,s:node.scale,q:node.rot};let lo=keys[0],hi=keys[keys.length-1];for(let i=0;i<keys.length-1;i++)if(frame>=keys[i].frame&&frame<=keys[i+1].frame){lo=keys[i];hi=keys[i+1];break}if(frame<lo.frame)hi=lo;if(frame>hi.frame)lo=hi;const t=lo===hi?0:Math.max(0,Math.min(1,(frame-lo.frame)/(hi.frame-lo.frame)));return {p:lerp(lo.pos||node.pos,hi.pos||node.pos,t),s:lerp(lo.scale||node.scale,hi.scale||node.scale,t),q:slerp(lo.rot||node.rot,hi.rot||node.rot,t)}}
function parse(buffer){
 const v=new DataView(buffer),len=v.byteLength;let cur=0,frameMax=0,fps=60;const meshes=[],nodes=[],allVertices=[],uvs=[],indices=[],groups=[],bindings=[];
 const take=(n,end)=>{if(cur+n>end||cur+n>len)throw Error('Truncated B3D');const p=cur;cur+=n;return p};
 const tag=end=>{const p=take(4,end);return String.fromCharCode(...new Uint8Array(buffer,p,4))};
 const i32=end=>v.getInt32(take(4,end),true),u32=end=>v.getUint32(take(4,end),true),f32=end=>v.getFloat32(take(4,end),true);
 const str=end=>{let s='';while(cur<end){const c=v.getUint8(cur++);if(!c)break;s+=String.fromCharCode(c)}return s};
 function chunks(end,parent,activeMesh){
  while(cur+8<=end){const t=tag(end),sz=u32(end),stop=cur+sz;if(stop>end||stop>len)throw Error('Invalid B3D chunk size');const begin=cur;
   if(t==='NODE'){const name=str(stop),p=[f32(stop),f32(stop),f32(stop)],s=[f32(stop),f32(stop),f32(stop)],q=[f32(stop),f32(stop),f32(stop),f32(stop)];const n={name,parent,children:[],pos:p,scale:s,rot:q,keys:[],weights:[],mesh:activeMesh,bind:null,inverse:null};if(parent!==null)nodes[parent].children.push(nodes.length);const ix=nodes.push(n)-1;chunks(stop,ix,activeMesh)}
   else if(t==='MESH'){i32(stop);const mesh={owner:parent,vertices:[],uv:[],sets:[],faces:[],weights:[]};meshes.push(mesh);activeMesh=mesh;chunks(stop,parent,mesh)}
   else if(t==='VRTS'&&activeMesh){const flags=i32(stop),sets=i32(stop),dim=i32(stop),stride=12+((flags&1)?12:0)+((flags&2)?16:0)+sets*dim*4;if(stride<=0)throw Error('Bad vertex stride');while(cur+stride<=stop){const p=[f32(stop),f32(stop),f32(stop)];if(flags&1)for(let k=0;k<3;k++)f32(stop);if(flags&2)for(let k=0;k<4;k++)f32(stop);let uv=[0,0];for(let set=0;set<sets;set++)for(let k=0;k<dim;k++){const value=f32(stop);if(!set&&k<2)uv[k]=value}activeMesh.vertices.push(p);activeMesh.uv.push(uv)}activeMesh.weights=activeMesh.vertices.map(()=>[])}
   else if(t==='TRIS'&&activeMesh){const brush=i32(stop),start=indices.length,base=allVertices.length;for(let i=0;i<activeMesh.vertices.length;i++){allVertices.push({mesh:activeMesh,vi:i});uvs.push(...activeMesh.uv[i]);bindings.push(null)}while(cur+12<=stop){for(let k=0;k<3;k++){const vi=i32(stop);if(vi<0||vi>=activeMesh.vertices.length)throw Error('B3D triangle out of bounds');indices.push(base+vi)}}groups.push({brush,start,count:indices.length-start})}
   else if(t==='BONE'&&parent!==null&&activeMesh){while(cur+8<=stop){const vi=i32(stop),weight=f32(stop);if(vi>=0&&vi<activeMesh.weights.length&&weight>0)activeMesh.weights[vi].push([parent,weight])}}
   else if(t==='KEYS'&&parent!==null){const flags=i32(stop),stride=4+4*((flags&1?3:0)+(flags&2?3:0)+(flags&4?4:0));if(stride<4)throw Error('Invalid key format');while(cur+stride<=stop){const key={frame:i32(stop)};if(flags&1)key.pos=[f32(stop),f32(stop),f32(stop)];if(flags&2)key.scale=[f32(stop),f32(stop),f32(stop)];if(flags&4)key.rot=[f32(stop),f32(stop),f32(stop),f32(stop)];nodes[parent].keys.push(key);frameMax=Math.max(frameMax,key.frame)}}
   else if(t==='ANIM'&&cur+12<=stop){i32(stop);frameMax=Math.max(frameMax,i32(stop));fps=f32(stop)||fps}
   cur=stop;if(cur<=begin)throw Error('B3D parser did not advance');
  }
 }
 if(tag(len)!=='BB3D')throw Error('B3D header missing');const rootSize=u32(len),rootEnd=cur+rootSize;if(rootEnd>len)throw Error('Invalid B3D root');i32(rootEnd);chunks(rootEnd,null,null);
 if(!allVertices.length||!indices.length)throw Error('B3D geometry missing');
 for(const n of nodes)n.keys.sort((a,b)=>a.frame-b.frame);
 function bindNode(i){const n=nodes[i],parent=n.parent===null?ident():nodes[n.parent].bind;n.bind=mul(parent,matrix(n.pos,n.scale,n.rot));n.inverse=inverse(n.bind);for(const j of n.children)bindNode(j)}
 nodes.forEach((n,i)=>{if(n.parent===null)bindNode(i)});
 let lo=[Infinity,Infinity,Infinity],hi=[-Infinity,-Infinity,-Infinity];
 const bindWorld=allVertices.map(vtx=>{const world=point(nodes[vtx.mesh.owner].bind,vtx.mesh.vertices[vtx.vi]);for(let k=0;k<3;k++){lo[k]=Math.min(lo[k],world[k]);hi[k]=Math.max(hi[k],world[k])}return world});
 const mid=lo.map((v,i)=>(v+hi[i])/2),span=Math.max(...hi.map((v,i)=>v-lo[i]))||1,norm=1.55/span;
 const base=new Float32Array(bindWorld.flatMap(v=>v.map((x,i)=>(x-mid[i])*norm)));
 const positions=new Float32Array(base.length);
 // Skin indices attached to original mesh-vertex records, not flattened duplicate indices.
 function pose(frame){const worlds=new Array(nodes.length);function walk(i){const n=nodes[i],k=sampleKeys(n,frame);worlds[i]=mul(n.parent===null?ident():worlds[n.parent],matrix(k.p,k.s,k.q));for(const j of n.children)walk(j)}nodes.forEach((n,i)=>{if(n.parent===null)walk(i)});
 const delta=nodes.map((n,i)=>mul(worlds[i],n.inverse));
 for(let i=0;i<allVertices.length;i++){const vx=allVertices[i],p=bindWorld[i],inf=vx.mesh.weights[vx.vi],sum=inf.reduce((s,w)=>s+w[1],0),keep=Math.max(0,1-sum);const dest=[p[0]*keep,p[1]*keep,p[2]*keep];let total=keep;for(const [node,weight] of inf){const q=point(delta[node],p);for(let k=0;k<3;k++)dest[k]+=q[k]*weight;total+=weight}for(let k=0;k<3;k++)positions[i*3+k]=((dest[k]/(total||1))-mid[k])*norm}return positions}
 return {mesh:{p:Array.from(base),uv:uvs,idx:indices,groups},frames:frameMax,fps,animated:nodes.some(n=>n.keys.length&&n.weights.length)||nodes.some(n=>n.keys.length),bones:nodes.filter(n=>n.weights.length).length,nodes:nodes.length,sample:pose,bindPositions:base};
}
window.MTSB3DAnimation={parse};
})();