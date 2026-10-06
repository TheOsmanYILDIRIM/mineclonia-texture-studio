(()=>{
 function img(canvas){return canvas.getContext('2d',{willReadFrequently:true}).getImageData(0,0,canvas.width,canvas.height)}
 function median(a){if(!a.length)return 0;const s=[...a].sort((x,y)=>x-y),m=s.length>>1;return s.length%2?s[m]:(s[m-1]+s[m])/2}
 function dist(d,i,c){const dr=d[i]-c[0],dg=d[i+1]-c[1],db=d[i+2]-c[2];return Math.sqrt(dr*dr+dg*dg+db*db)}
 function luminance(r,g,b){return .2126*r+.7152*g+.0722*b}
 function isBackgroundDark(r,g,b,lumThr=34,spreadThr=28){const lum=luminance(r,g,b),spread=Math.max(r,g,b)-Math.min(r,g,b);return lum<=lumThr&&spread<=spreadThr}
 function estimateBackground(im,w,h,opts={}){
  const mode=opts.bgMode||'auto',role=opts.role||'source',d=im.data,alphas=[];for(let i=3;i<d.length;i+=4)alphas.push(d[i]);
  const transparent=alphas.filter(a=>a<16).length/alphas.length,opaque=alphas.filter(a=>a>245).length/alphas.length;
  const alphaUseful=transparent>.002&&transparent<.985;
  if(role==='target'&&alphaUseful&&mode!=='black')return {mode:'alpha',color:[0,0,0],threshold:0};
  if(mode==='alpha'&&alphaUseful)return {mode:'alpha',color:[0,0,0],threshold:0};
  if(mode==='black')return {mode:'forced-black',color:[0,0,0],threshold:52};

  let darkHits=0,total=0;const borderR=[],borderG=[],borderB=[],borderDist=[];
  const probe=(x,y)=>{const i=(y*w+x)*4;total++;borderR.push(d[i]);borderG.push(d[i+1]);borderB.push(d[i+2]);if(isBackgroundDark(d[i],d[i+1],d[i+2],52,42))darkHits++};
  for(let x=0;x<w;x++){probe(x,0);probe(x,h-1)}for(let y=1;y<h-1;y++){probe(0,y);probe(w-1,y)}
  if(total&&darkHits/total>.38)return {mode:'forced-black',color:[0,0,0],threshold:58};
  const borderColor=[median(borderR),median(borderG),median(borderB)];
  for(let x=0;x<w;x++){borderDist.push(dist(d,x*4,borderColor));borderDist.push(dist(d,((h-1)*w+x)*4,borderColor))}
  for(let y=1;y<h-1;y++){borderDist.push(dist(d,(y*w)*4,borderColor));borderDist.push(dist(d,(y*w+w-1)*4,borderColor))}
  const sorted=[...borderDist].sort((a,b)=>a-b),q75=sorted[Math.floor(sorted.length*.75)]||0;
  if(role==='source'&&opaque>.98)return {mode:'edge-fill',color:borderColor,threshold:Math.max(28,Math.min(96,q75+22))};
  const rs=[],gs=[],bs=[],edge=[];
  const sample=(x,y)=>{const i=(y*w+x)*4;rs.push(d[i]);gs.push(d[i+1]);bs.push(d[i+2])};
  const k=Math.max(2,Math.min(8,Math.floor(Math.min(w,h)/8)));
  for(let y=0;y<k;y++)for(let x=0;x<k;x++){sample(x,y);sample(w-1-x,y);sample(x,h-1-y);sample(w-1-x,h-1-y)}
  const color=[median(rs),median(gs),median(bs)];
  for(let x=0;x<w;x++){edge.push(dist(d,x*4,color));edge.push(dist(d,((h-1)*w+x)*4,color))}
  for(let y=0;y<h;y++){edge.push(dist(d,(y*w)*4,color));edge.push(dist(d,(y*w+w-1)*4,color))}
  const threshold=Math.max(18,Math.min(72,median(edge)+20));
  return {mode:'edge-fill',color,threshold}
 }
 function foregroundMask(canvas,opts={}){
  const im=img(canvas),w=canvas.width,h=canvas.height,d=im.data,bg=estimateBackground(im,w,h,opts),mask=new Uint8Array(w*h);
  if(bg.mode==='alpha'){for(let p=0,i=3;p<mask.length;p++,i+=4)mask[p]=d[i]>=16?1:0;return {im,w,h,mask,bg}}
  const background=new Uint8Array(w*h),q=new Int32Array(w*h);let head=0,tail=0;
  const ok=p=>{const i=p*4;if(d[i+3]<16)return true;if(bg.mode==='forced-black')return isBackgroundDark(d[i],d[i+1],d[i+2],bg.threshold,30);return dist(d,i,bg.color)<=bg.threshold};
  const push=p=>{if(p<0||p>=mask.length||background[p]||!ok(p))return;background[p]=1;q[tail++]=p};
  for(let x=0;x<w;x++){push(x);push((h-1)*w+x)}for(let y=0;y<h;y++){push(y*w);push(y*w+w-1)}
  while(head<tail){const p=q[head++],x=p%w,y=(p/w)|0;if(x)push(p-1);if(x<w-1)push(p+1);if(y)push(p-w);if(y<h-1)push(p+w)}
  for(let p=0;p<mask.length;p++)mask[p]=background[p]?0:1;
  return {im,w,h,mask,bg}
 }
 function components(a){
  const {mask,w,h}=a,seen=new Uint8Array(mask.length),out=[],q=new Int32Array(mask.length),minArea=Math.max(4,Math.floor(w*h*0.00002));
  for(let s=0;s<mask.length;s++){if(!mask[s]||seen[s])continue;let head=0,tail=0;q[tail++]=s;seen[s]=1;let minX=w,minY=h,maxX=0,maxY=0,area=0,sumX=0,sumY=0,pix=[];
   while(head<tail){const p=q[head++],x=p%w,y=(p/w)|0;pix.push(p);area++;sumX+=x;sumY+=y;if(x<minX)minX=x;if(x>maxX)maxX=x;if(y<minY)minY=y;if(y>maxY)maxY=y;
    const ns=[p-1,p+1,p-w,p+w];for(const n of ns){if(n<0||n>=mask.length||seen[n]||!mask[n])continue;const nx=n%w,ny=(n/w)|0;if(Math.abs(nx-x)+Math.abs(ny-y)!==1)continue;seen[n]=1;q[tail++]=n}
   }
   if(area<minArea)continue;
   const bw=maxX-minX+1,bh=maxY-minY+1,touches=(minX===0)+(minY===0)+(maxX===w-1)+(maxY===h-1);
   if(area>w*h*.94&&touches>=3)continue;
   const rowL=new Int32Array(maxY-minY+1);rowL.fill(2147483647);const rowR=new Int32Array(maxY-minY+1);rowR.fill(-1);const boundary=[];
   for(const p of pix){const x=p%w,y=(p/w)|0,ry=y-minY;if(x<rowL[ry])rowL[ry]=x;if(x>rowR[ry])rowR[ry]=x;
    if(x===0||!mask[p-1])boundary.push({x:x,y:y+.5});
    if(x===w-1||!mask[p+1])boundary.push({x:x+1,y:y+.5});
    if(y===0||!mask[p-w])boundary.push({x:x+.5,y:y});
    if(y===h-1||!mask[p+w])boundary.push({x:x+.5,y:y+1})
   }
   const step=Math.max(1,Math.ceil(boundary.length/700));
   out.push({id:out.length,bbox:{x:minX,y:minY,w:maxX-minX+1,h:maxY-minY+1},area,cx:sumX/area,cy:sumY/area,rowL,rowR,boundary:boundary.filter((_,i)=>i%step===0)})
  }
  return out.sort((x,y)=>y.area-x.area)
 }
 function analyze(canvas,opts={}){
  if(opts.strictAlpha){
    const im=img(canvas),w=canvas.width,h=canvas.height,d=im.data,mask=new Uint8Array(w*h);
    let transparent=0,opaque=0,partial=0;
    for(let p=0,i=3;p<mask.length;p++,i+=4){const a=d[i];mask[p]=a>0?1:0;if(a===0)transparent++;else if(a===255)opaque++;else partial++}
    const out={im,w,h,mask,bg:{mode:'strict-alpha',transparent,opaque,partial}};out.components=components(out);out.segments=contourSegments(out);return out
  }
  let a=foregroundMask(canvas,opts);a.components=components(a);
  const bad=!a.components.length||a.components.some(c=>c.area>a.w*a.h*.9&&c.bbox.w>=a.w*.98&&c.bbox.h>=a.h*.98);
  if(bad&&opts.role==='source'&&opts.bgMode==='alpha'){
    a=foregroundMask(canvas,{...opts,bgMode:'auto'});a.components=components(a);a.bg.fallbackFrom='alpha';
  }
  return a
 }
 function analyzeWithMask(canvas,maskCanvas){
  const source=img(canvas),m=img(maskCanvas),w=canvas.width,h=canvas.height,mask=new Uint8Array(w*h);
  for(let y=0;y<h;y++)for(let x=0;x<w;x++){
    const mx=Math.min(maskCanvas.width-1,Math.floor(x*maskCanvas.width/w)),my=Math.min(maskCanvas.height-1,Math.floor(y*maskCanvas.height/h));
    mask[y*w+x]=m.data[(my*maskCanvas.width+mx)*4+3]>=16?1:0;
  }
  const a={im:source,w,h,mask,bg:{mode:'reference-alpha'}};a.components=components(a);return a
 }
 function analyzeSourceWithinReference(canvas,maskCanvas,opts={}){
  const src=img(canvas),ref=img(maskCanvas),w=canvas.width,h=canvas.height,mask=new Uint8Array(w*h);
  // Restrict detection to legal UV footprint, but infer the generated content edge independently.
  // Estimate "empty" from pixels outside the reference footprint; if unavailable, use border samples.
  const bgSamples=[];
  for(let y=0;y<h;y++)for(let x=0;x<w;x++){
    const mx=Math.min(maskCanvas.width-1,Math.floor(x*maskCanvas.width/w)),my=Math.min(maskCanvas.height-1,Math.floor(y*maskCanvas.height/h));
    if(ref.data[(my*maskCanvas.width+mx)*4+3]<16){const i=(y*w+x)*4;bgSamples.push([src.data[i],src.data[i+1],src.data[i+2],src.data[i+3]])}
  }
  let br=0,bg=0,bb=0;
  if(bgSamples.length){const rs=bgSamples.map(p=>p[0]),gs=bgSamples.map(p=>p[1]),bs=bgSamples.map(p=>p[2]);br=median(rs);bg=median(gs);bb=median(bs)}
  const bgc=[br,bg,bb],thr=opts.bgMode==='black'?62:Math.max(26,Math.min(78,opts.threshold||42));
  for(let y=0;y<h;y++)for(let x=0;x<w;x++){
    const mx=Math.min(maskCanvas.width-1,Math.floor(x*maskCanvas.width/w)),my=Math.min(maskCanvas.height-1,Math.floor(y*maskCanvas.height/h)),ri=(my*maskCanvas.width+mx)*4;
    if(ref.data[ri+3]<16){mask[y*w+x]=0;continue}
    const i=(y*w+x)*4;
    if(src.data[i+3]<16){mask[y*w+x]=0;continue}
    // Within the legal UV region, pixels sufficiently different from the learned empty background are generated content.
    const delta=dist(src.data,i,bgc);
    mask[y*w+x]=delta>thr?1:0;
  }
  // If contrast segmentation becomes too sparse, use alpha inside the legal footprint, never the whole rectangle.
  let count=0;for(const v of mask)count+=v;
  if(count<Math.max(4,w*h*.002)){
    for(let y=0;y<h;y++)for(let x=0;x<w;x++){
      const mx=Math.min(maskCanvas.width-1,Math.floor(x*maskCanvas.width/w)),my=Math.min(maskCanvas.height-1,Math.floor(y*maskCanvas.height/h)),ri=(my*maskCanvas.width+mx)*4,i=(y*w+x)*4;
      mask[y*w+x]=(ref.data[ri+3]>=16&&src.data[i+3]>=16)?1:0;
    }
  }
  const a={im:src,w,h,mask,bg:{mode:'reference-constrained-content',color:bgc,threshold:thr}};a.components=components(a);return a
 }
 function contourSegments(analysis){
  const out=[];let id=0;
  for(const comp of analysis.components){
    // Alpha boundary points are edge midpoints. Group them into short spatial edge segments.
    const pts=[...comp.boundary],used=new Uint8Array(pts.length);
    for(let i=0;i<pts.length;i++){
      if(used[i])continue;const group=[],q=[i];used[i]=1;
      while(q.length){const k=q.pop(),p=pts[k];group.push(p);
        for(let j=0;j<pts.length;j++){if(used[j])continue;const z=pts[j],dx=Math.abs(z.x-p.x),dy=Math.abs(z.y-p.y);
          if(dx<=1.01&&dy<=1.01&&(dx+dy)<=1.51){used[j]=1;q.push(j)}
        }
      }
      if(group.length<2)continue;
      let minX=Infinity,minY=Infinity,maxX=-Infinity,maxY=-Infinity,sx=0,sy=0;
      for(const p of group){minX=Math.min(minX,p.x);minY=Math.min(minY,p.y);maxX=Math.max(maxX,p.x);maxY=Math.max(maxY,p.y);sx+=p.x;sy+=p.y}
      out.push({id:id++,componentId:comp.id,points:group,cx:sx/group.length,cy:sy/group.length,bbox:{x:minX,y:minY,w:maxX-minX,h:maxY-minY}});
    }
  }
  return out
 }
 function nearestSegment(analysis,x,y,excluded=null,maxDistance=Infinity){
  const segs=analysis.segments||(analysis.segments=contourSegments(analysis));let best=null,bd=maxDistance*maxDistance;
  for(const s of segs){if(excluded?.has?.(s.id))continue;for(const p of s.points){const dx=p.x-x,dy=p.y-y,d=dx*dx+dy*dy;if(d<bd){bd=d;best=s}}}
  return best
 }
 function score(a,b,aw,ah,bw,bh){
  const ax=a.cx/aw,ay=a.cy/ah,bx=b.cx/bw,by=b.cy/bh,pos=Math.hypot(ax-bx,ay-by);
  const arA=a.bbox.w/a.bbox.h,arB=b.bbox.w/b.bbox.h,asp=Math.abs(Math.log((arA||1)/(arB||1)));
  const sw=a.bbox.w/aw,sh=a.bbox.h/ah,tw=b.bbox.w/bw,th=b.bbox.h/bh,size=Math.abs(Math.log((sw+1e-6)/(tw+1e-6)))+Math.abs(Math.log((sh+1e-6)/(th+1e-6)));
  const area=Math.abs(Math.log((a.area/(aw*ah)+1e-6)/(b.area/(bw*bh)+1e-6)));
  return pos*5+asp*1.3+size*1.7+area*.8
 }
 function match(target,source,opts={}){
  const used=new Set(opts.usedSource||[]),blockedT=opts.excludedTarget||new Set(),blockedS=opts.excludedSource||new Set(),pairs=[];
  for(const t of target.components){if(blockedT.has(t.id))continue;let best=null,bestS=Infinity,second=Infinity;
   for(const s of source.components){if(used.has(s.id)||blockedS.has(s.id))continue;const sc=score(t,s,target.w,target.h,source.w,source.h);if(sc<bestS){second=bestS;bestS=sc;best=s}else if(sc<second)second=sc}
   const confident=best&&bestS<2.6&&(second===Infinity||second-bestS>.45);
   if(confident){used.add(best.id);pairs.push({target:t,source:best,score:bestS,auto:true})}
  }
  return pairs
 }
 function bgFillColor(a){return a.bg.mode==='edge-fill'?[...a.bg.color,255]:[0,0,0,0]}
 function clearSourceComponents(ctx,analysis,pairs){
  const im=ctx.getImageData(0,0,analysis.w,analysis.h),d=im.data,fill=bgFillColor(analysis),ids=new Set(pairs.map(p=>p.source.id));
  for(let p=0;p<analysis.mask.length;p++){if(!analysis.mask[p])continue;const x=p%analysis.w,y=(p/analysis.w)|0;let belongs=false;for(const c of analysis.components){if(!ids.has(c.id))continue;if(x<c.bbox.x||x>=c.bbox.x+c.bbox.w||y<c.bbox.y||y>=c.bbox.y+c.bbox.h)continue;const ry=y-c.bbox.y;if(c.rowL[ry]<=x&&x<=c.rowR[ry]){belongs=true;break}}if(!belongs)continue;const i=p*4;d[i]=fill[0];d[i+1]=fill[1];d[i+2]=fill[2];d[i+3]=fill[3]}
  ctx.putImageData(im,0,0)
 }
 function sampleBilinear(im,x,y){
  const w=im.width,h=im.height,d=im.data;x=Math.max(0,Math.min(w-1,x));y=Math.max(0,Math.min(h-1,y));const x0=Math.floor(x),y0=Math.floor(y),x1=Math.min(w-1,x0+1),y1=Math.min(h-1,y0+1),tx=x-x0,ty=y-y0,o=[0,0,0,0];
  for(let c=0;c<4;c++){const a=d[(y0*w+x0)*4+c]*(1-tx)+d[(y0*w+x1)*4+c]*tx,b=d[(y1*w+x0)*4+c]*(1-tx)+d[(y1*w+x1)*4+c]*tx;o[c]=Math.round(a*(1-ty)+b*ty)}return o
 }
 function rowBounds(c,y){const ry=Math.max(0,Math.min(c.rowL.length-1,Math.round(y-c.bbox.y)));let l=c.rowL[ry],r=c.rowR[ry];if(r<0||l===2147483647){l=c.bbox.x;r=c.bbox.x+c.bbox.w-1}return [l,r]}
 function warp(sourceCanvas,targetAnalysis,sourceAnalysis,pairs){
  const out=document.createElement('canvas');out.width=sourceCanvas.width;out.height=sourceCanvas.height;const ctx=out.getContext('2d',{willReadFrequently:true});ctx.drawImage(sourceCanvas,0,0);clearSourceComponents(ctx,sourceAnalysis,pairs);
  const src=img(sourceCanvas),dst=ctx.getImageData(0,0,out.width,out.height),od=dst.data;
  for(const pair of pairs){const t=pair.target,s=pair.source,dy0=Math.max(0,Math.floor(t.bbox.y/targetAnalysis.h*out.height)),dy1=Math.min(out.height-1,Math.ceil((t.bbox.y+t.bbox.h)/targetAnalysis.h*out.height)-1);
   for(let oy=dy0;oy<=dy1;oy++){const ty=oy/out.height*targetAnalysis.h,[tl0,tr0]=rowBounds(t,ty),dl=tl0/targetAnalysis.w*out.width,dr=(tr0+1)/targetAnalysis.w*out.width-1;if(dr<dl)continue;
    const v=(ty-t.bbox.y)/Math.max(1,t.bbox.h-1),sy=s.bbox.y+v*Math.max(0,s.bbox.h-1),[sl,sr]=rowBounds(s,sy),x0=Math.max(0,Math.floor(dl)),x1=Math.min(out.width-1,Math.ceil(dr));
    for(let ox=x0;ox<=x1;ox++){const origX=ox/out.width*targetAnalysis.w,tx=Math.max(0,Math.min(1,(origX-tl0)/Math.max(1,tr0-tl0))),sx=sl+tx*Math.max(0,sr-sl),rgba=sampleBilinear(src,sx,sy),i=(oy*out.width+ox)*4;od[i]=rgba[0];od[i+1]=rgba[1];od[i+2]=rgba[2];od[i+3]=rgba[3]}
   }
  }
  ctx.putImageData(dst,0,0);return out
 }

 function nearestBoundaryPoint(points,x,y){let best=null,bd=Infinity;for(const p of points||[]){const dx=p.x-x,dy=p.y-y,d=dx*dx+dy*dy;if(d<bd){bd=d;best=p}}return best}
 function orderedSegmentPoints(seg){
  const pts=[...(seg?.points||[])],b=seg?.bbox||{w:0,h:0},horizontal=b.w>=b.h;
  pts.sort(horizontal?(a,b)=>a.x-b.x||a.y-b.y:(a,b)=>a.y-b.y||a.x-b.x);
  return pts
 }
 function sampleOrdered(arr,t){if(!arr.length)return null;const f=t*(arr.length-1),i=Math.floor(f),j=Math.min(arr.length-1,i+1),u=f-i;return{x:arr[i].x*(1-u)+arr[j].x*u,y:arr[i].y*(1-u)+arr[j].y*u}}
 function minimalControls(target,source,pairs,segmentPairs=[]){
  const out=[];
  const add=(s,t,kind='edge',localScale=1)=>{if(!s||!t)return;
    // In inverse mapping, an output point at target t must sample from source s.
    let dx=s.x-t.x,dy=s.y-t.y,mag=Math.hypot(dx,dy);if(mag<.02)return;
    const maxMove=6;if(mag>maxMove){const k=maxMove/mag;dx*=k;dy*=k;mag=maxMove}
    const radius=kind==='manual'?Math.max(8,Math.min(14,8+mag*1.5)):Math.max(3,Math.min(7,(mag+2)*localScale));
    out.push({src:{x:s.x,y:s.y},dst:{x:t.x,y:t.y},dx,dy,mag,radius,kind})};
  // Auto island pairs are deliberately weak; they must never dominate precise manual edge pairs.
  for(const pair of pairs||[]){if(segmentPairs?.length)break;const tb=pair.target.boundary||[],sb=pair.source.boundary||[];if(!tb.length||!sb.length)continue;const stride=Math.max(1,Math.ceil(tb.length/120));for(let i=0;i<tb.length;i+=stride){const t=tb[i],s=nearestBoundaryPoint(sb,t.x,t.y);if(s&&Math.hypot(s.x-t.x,s.y-t.y)<=3)add(s,t,'auto',.8)}}
  for(const pair of segmentPairs||[]){
    const ta=orderedSegmentPoints(pair.targetSegment),sa=orderedSegmentPoints(pair.sourceSegment);if(!ta.length||!sa.length)continue;
    const n=Math.max(3,Math.min(20,Math.round(Math.max(ta.length,sa.length)/2)));
    for(let i=0;i<n;i++){const t=i/Math.max(1,n-1);add(sampleOrdered(sa,t),sampleOrdered(ta,t),'manual',1)}
  }
  return out
 }
 function smoothWarp(sourceCanvas,targetAnalysis,sourceAnalysis,pairs,segmentPairs=[]){
  const out=document.createElement('canvas');out.width=sourceCanvas.width;out.height=sourceCanvas.height;
  const src=img(sourceCanvas),dst=new ImageData(out.width,out.height),od=dst.data,controls=minimalControls(targetAnalysis,sourceAnalysis,pairs,segmentPairs);
  const sxScale=sourceAnalysis.w/out.width,syScale=sourceAnalysis.h/out.height,txScale=targetAnalysis.w/out.width,tyScale=targetAnalysis.h/out.height;
  if(!controls.length){out.getContext('2d').putImageData(src,0,0);return out}
  for(let oy=0;oy<out.height;oy++){const ty=oy*tyScale;for(let ox=0;ox<out.width;ox++){const tx=ox*txScale;let wx=0,wy=0,ws=0,maxInf=0;
    for(const c of controls){const ddx=tx-c.dst.x,ddy=ty-c.dst.y,d=Math.hypot(ddx,ddy),r=c.radius;if(d>=r)continue;const u=1-d/r,inf=u*u*(3-2*u),w=inf/(.2+c.mag*.15);wx+=c.dx*w;wy+=c.dy*w;ws+=w;maxInf=Math.max(maxInf,inf)}
    let dx=ws?wx/ws:0,dy=ws?wy/ws:0;if(maxInf<.001){dx=0;dy=0}else{dx*=maxInf;dy*=maxInf}
    const limit=6;dx=Math.max(-limit,Math.min(limit,dx));dy=Math.max(-limit,Math.min(limit,dy));
    const rgba=sampleBilinear(src,(tx+dx)/sxScale,(ty+dy)/syScale),i=(oy*out.width+ox)*4;od[i]=rgba[0];od[i+1]=rgba[1];od[i+2]=rgba[2];od[i+3]=rgba[3]
  }}
  out.getContext('2d').putImageData(dst,0,0);return out
 }

 function draw(canvas,target,source,pairs,{showTarget=true,showSource=true,excludedTarget=new Set(),excludedSource=new Set(),segmentPairs=[],selectedTargetSegment=null,selectedSourceSegment=null}={}){
  const ctx=canvas.getContext('2d');ctx.clearRect(0,0,canvas.width,canvas.height);
  const edge=(a,c,fill)=>{const sx=canvas.width/a.w,sy=canvas.height/a.h;ctx.fillStyle=fill;const sz=Math.max(3,Math.min(6,Math.min(sx,sy)*1.35));for(const p of c.boundary)ctx.fillRect(p.x*sx-sz/2,p.y*sy-sz/2,sz,sz)};
  if(showTarget)for(const c of target.components)edge(target,c,'rgba(65,255,100,.98)');
  if(showSource)for(const c of source.components)edge(source,c,'rgba(255,145,30,.98)');
  const seg=(a,s,fill,width=6)=>{if(!s)return;const sx=canvas.width/a.w,sy=canvas.height/a.h;ctx.fillStyle=fill;const sz=width;for(const p of s.points)ctx.fillRect(p.x*sx-sz/2,p.y*sy-sz/2,sz,sz)};
  let n=1;for(const p of segmentPairs||[]){seg(target,p.targetSegment,'rgba(70,160,255,1)',5);seg(source,p.sourceSegment,'rgba(70,160,255,1)',5);ctx.strokeStyle='rgba(70,160,255,.9)';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(p.targetSegment.cx/target.w*canvas.width,p.targetSegment.cy/target.h*canvas.height);ctx.lineTo(p.sourceSegment.cx/source.w*canvas.width,p.sourceSegment.cy/source.h*canvas.height);ctx.stroke();ctx.fillStyle='#fff';ctx.font='bold 11px system-ui';ctx.fillText('K'+n++,p.targetSegment.cx/target.w*canvas.width+3,p.targetSegment.cy/target.h*canvas.height-3)}
  seg(target,selectedTargetSegment,'rgba(255,255,255,1)',8);seg(source,selectedSourceSegment,'rgba(255,255,255,1)',8);
 }
 function nearest(analysis,x,y,excluded=null,maxDistance=Infinity){
  let best=null,bd=maxDistance*maxDistance;
  for(const c of analysis.components){if(excluded?.has?.(c.id))continue;for(const p of c.boundary){const dx=p.x-x,dy=p.y-y,d=dx*dx+dy*dy;if(d<bd){bd=d;best=c}}}
  return best
 }
 window.MTSUvWarp={analyze,analyzeWithMask,analyzeSourceWithinReference,match,warp,smoothWarp,draw,nearest,contourSegments,nearestSegment};
})();