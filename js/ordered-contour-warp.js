(()=>{
'use strict';

function validRows(c){
  const rows=[];
  if(!c?.rowL||!c?.rowR)return rows;
  for(let ry=0;ry<c.rowL.length;ry++){
    const l=c.rowL[ry],r=c.rowR[ry];
    if(l===2147483647||r<0)continue;
    rows.push({ry,l,r});
  }
  return rows;
}

function contourWalk(c,{local=false,scaleX=1,scaleY=1}={}){
  const rows=validRows(c);
  if(!rows.length)return [];
  const out=[];
  const ox=local?c.bbox.x:0,oy=local?c.bbox.y:0;

  // Top edge: left -> right.
  const first=rows[0],topY=c.bbox.y+first.ry;
  for(let x=first.l;x<=first.r+1;x++)out.push({x:(x-ox)*scaleX,y:(topY-oy)*scaleY});

  // Right side: top -> bottom, including steps.
  let prevR=first.r+1,prevY=topY;
  for(const row of rows){
    const y=c.bbox.y+row.ry+.5,r=row.r+1;
    if(Math.abs(r-prevR)>1e-6){
      out.push({x:prevR*scaleX-ox*scaleX,y:y*scaleY-oy*scaleY});
      out.push({x:(r-ox)*scaleX,y:(y-(0))*scaleY-oy*scaleY});
    }
    out.push({x:(r-ox)*scaleX,y:(y-oy)*scaleY});
    prevR=r;prevY=y;
  }

  // Bottom edge: right -> left.
  const last=rows[rows.length-1],botY=c.bbox.y+last.ry+1;
  for(let x=last.r+1;x>=last.l;x--)out.push({x:(x-ox)*scaleX,y:(botY-oy)*scaleY});

  // Left side: bottom -> top, including steps.
  let prevL=last.l;
  for(let i=rows.length-1;i>=0;i--){
    const row=rows[i],y=c.bbox.y+row.ry+.5,l=row.l;
    if(Math.abs(l-prevL)>1e-6){
      out.push({x:(prevL-ox)*scaleX,y:(y-oy)*scaleY});
      out.push({x:(l-ox)*scaleX,y:(y-oy)*scaleY});
    }
    out.push({x:(l-ox)*scaleX,y:(y-oy)*scaleY});
    prevL=l;
  }
  return out;
}

function closedLength(points){
  let total=0;
  for(let i=0;i<points.length;i++){
    const a=points[i],b=points[(i+1)%points.length];
    total+=Math.hypot(b.x-a.x,b.y-a.y);
  }
  return total;
}

function rotateCanonical(points){
  if(!points.length)return points;
  let best=0;
  for(let i=1;i<points.length;i++){
    const p=points[i],b=points[best];
    if(p.y<b.y-1e-6||(Math.abs(p.y-b.y)<1e-6&&p.x<b.x))best=i;
  }
  return points.slice(best).concat(points.slice(0,best));
}

function resampleClosed(points,count){
  if(!points.length||count<=0)return [];
  const p=rotateCanonical(points);
  const seg=[],cum=[0];
  let total=0;
  for(let i=0;i<p.length;i++){
    const a=p[i],b=p[(i+1)%p.length],len=Math.hypot(b.x-a.x,b.y-a.y);
    seg.push(len);total+=len;cum.push(total);
  }
  if(total<1e-6)return Array.from({length:count},()=>({...p[0]}));
  const out=[];let si=0;
  for(let k=0;k<count;k++){
    const d=total*k/count;
    while(si<seg.length-1&&cum[si+1]<d)si++;
    const a=p[si],b=p[(si+1)%p.length],span=Math.max(1e-6,seg[si]),t=(d-cum[si])/span;
    out.push({x:a.x+(b.x-a.x)*t,y:a.y+(b.y-a.y)*t});
  }
  return out;
}

function perimeterRefs(mesh){
  const refs=[],rows=mesh.rows,cols=mesh.cols;
  for(let c=0;c<=cols;c++)refs.push(mesh.points[0][c]);
  for(let r=1;r<=rows;r++)refs.push(mesh.points[r][cols]);
  for(let c=cols-1;c>=0;c--)refs.push(mesh.points[rows][c]);
  for(let r=rows-1;r>=1;r--)refs.push(mesh.points[r][0]);
  return refs;
}

function relaxInterior(mesh){
  const rows=mesh.rows,cols=mesh.cols,tl=mesh.points[0][0],tr=mesh.points[0][cols],bl=mesh.points[rows][0],br=mesh.points[rows][cols];
  for(let r=1;r<rows;r++)for(let c=1;c<cols;c++){
    const u=c/cols,v=r/rows,p=mesh.points[r][c],top=mesh.points[0][c],bot=mesh.points[rows][c],left=mesh.points[r][0],right=mesh.points[r][cols];
    const cornerX=(1-u)*(1-v)*tl.x+u*(1-v)*tr.x+(1-u)*v*bl.x+u*v*br.x;
    const cornerY=(1-u)*(1-v)*tl.y+u*(1-v)*tr.y+(1-u)*v*bl.y+u*v*br.y;
    p.x=(1-v)*top.x+v*bot.x+(1-u)*left.x+u*right.x-cornerX;
    p.y=(1-v)*top.y+v*bot.y+(1-u)*left.y+u*right.y-cornerY;
    const cornerU=(1-u)*(1-v)*tl.u+u*(1-v)*tr.u+(1-u)*v*bl.u+u*v*br.u;
    const cornerV=(1-u)*(1-v)*tl.v+u*(1-v)*tr.v+(1-u)*v*bl.v+u*v*br.v;
    p.u=(1-v)*top.u+v*bot.u+(1-u)*left.u+u*right.u-cornerU;
    p.v=(1-v)*top.v+v*bot.v+(1-u)*left.v+u*right.v-cornerV;
  }
}

function fitMesh({mesh,sourceComp,sourceAnalysis,targetComp,targetAnalysis,sourceCrop,workWidth,workHeight}={}){
  if(!mesh||!sourceComp||!targetComp||!sourceAnalysis||!targetAnalysis||!sourceCrop)return false;
  const refs=perimeterRefs(mesh);
  if(refs.length<4)return false;

  let source=contourWalk(sourceComp,{local:true});
  let target=contourWalk(targetComp,{local:false,scaleX:workWidth/targetAnalysis.w,scaleY:workHeight/targetAnalysis.h});
  if(source.length<4||target.length<4)return false;

  source=resampleClosed(source,refs.length);
  target=resampleClosed(target,refs.length);

  // Pick target orientation that minimizes endpoint/perimeter mismatch.
  const targetRev=[target[0]].concat(target.slice(1).reverse());
  const score=arr=>arr.reduce((s,p,i)=>s+Math.hypot(p.x-target[i].x,p.y-target[i].y),0);
  if(score(targetRev)<score(target))target=targetRev;

  for(let i=0;i<refs.length;i++){
    const p=refs[i],s=source[i],t=target[i];
    p.u=Math.max(0,Math.min(sourceCrop.width,s.x));
    p.v=Math.max(0,Math.min(sourceCrop.height,s.y));
    p.x=t.x;p.y=t.y;
  }

  relaxInterior(mesh);
  for(const row of mesh.points)for(const p of row){p.ox=p.x;p.oy=p.y}
  return true;
}

window.MTSOrderedContourWarp={fitMesh,contourWalk,resampleClosed};
})();