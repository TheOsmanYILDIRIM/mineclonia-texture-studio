// Geometry-only UV triangle selection. No rig, bind-pose, or texture writes.
export function triangleUV(mesh,triangle){
 const {uv,idx}=mesh||{};
 if(!uv||!idx||!Number.isInteger(triangle)||triangle<0||triangle*3+2>=idx.length)throw Error('Invalid UV triangle');
 return Array.from({length:3},(_,j)=>{const i=idx[triangle*3+j];return {u:uv[2*i],v:uv[2*i+1]}})
}
export function uvBounds(points,width,height){
 if(!points?.length||!(width>0&&height>0))throw Error('Invalid UV selection');
 const xs=points.map(p=>p.u*width),ys=points.map(p=>p.v*height);
 if([...xs,...ys].some(x=>!Number.isFinite(x)))throw Error('Invalid UV coordinate');
 const x=Math.max(0,Math.floor(Math.min(...xs))),y=Math.max(0,Math.floor(Math.min(...ys)));
 const right=Math.min(width,Math.ceil(Math.max(...xs))),bottom=Math.min(height,Math.ceil(Math.max(...ys)));
 if(right<=x||bottom<=y)throw Error('UV triangle outside atlas');
 return {x,y,w:right-x,h:bottom-y};
}
export function findUVTriangle(mesh,u,v){
 const {uv,idx}=mesh||{};if(!uv||!idx)return -1;
 for(let t=0;t<Math.floor(idx.length/3);t++){
  const pts=triangleUV(mesh,t);
  const [a,b,c]=pts,den=(b.v-c.v)*(a.u-c.u)+(c.u-b.u)*(a.v-c.v);
  if(Math.abs(den)<1e-12)continue;
  const x=((b.v-c.v)*(u-c.u)+(c.u-b.u)*(v-c.v))/den;
  const y=((c.v-a.v)*(u-c.u)+(a.u-c.u)*(v-c.v))/den;
  if(x>=-1e-6&&y>=-1e-6&&x+y<=1+1e-6)return t;
 }
 return -1;
}
