(()=>{
 function img(canvas){return canvas.getContext('2d',{willReadFrequently:true}).getImageData(0,0,canvas.width,canvas.height)}
 function median(a){if(!a.length)return 0;const s=[...a].sort((x,y)=>x-y),m=s.length>>1;return s.length%2?s[m]:(s[m-1]+s[m])/2}
 function dist(d,i,c){const dr=d[i]-c[0],dg=d[i+1]-c[1],db=d[i+2]-c[2];return Math.sqrt(dr*dr+dg*dg+db*db)}
 function estimateBackground(im,w,h){
  const d=im.data,alphas=[];for(let i=3;i<d.length;i+=4)alphas.push(d[i]);
  const transparent=alphas.filter(a=>a<16).length/alphas.length;
  if(transparent>.002)return {mode:'alpha',color:[0,0,0],threshold:0};
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
 function foregroundMask(canvas){
  const im=img(canvas),w=canvas.width,h=canvas.height,d=im.data,bg=estimateBackground(im,w,h),mask=new Uint8Array(w*h);
  if(bg.mode==='alpha'){for(let p=0,i=3;p<mask.length;p++,i+=4)mask[p]=d[i]>=16?1:0;return {im,w,h,mask,bg}}
  const background=new Uint8Array(w*h),q=new Int32Array(w*h);let head=0,tail=0;
  const ok=p=>{const i=p*4;return d[i+3]<16||dist(d,i,bg.color)<=bg.threshold};
  const push=p=>{if(p<0||p>=mask.length||background[p]||!ok(p))return;background[p]=1;q[tail++]=p};
  for(let x=0;x<w;x++){push(x);push((h-1)*w+x)}for(let y=0;y<h;y++){push(y*w);push(y*w+w-1)}
  while(head<tail){const p=q[head++],x=p%w,y=(p/w)|0;if(x)push(p-1);if(x<w-1)push(p+1);if(y)push(p-w);if(y<h-1)push(p+w)}
  for(let p=0;p<mask.length;p++)mask[p]=background[p]?0:1;
  return {im,w,h,mask,bg}
 }
 function components(a){
  const {mask,w,h}=a,seen=new Uint8Array(mask.length),out=[],q=new Int32Array(mask.length),minArea=Math.max(2,Math.floor(w*h*0.00001));
  for(let s=0;s<mask.length;s++){if(!mask[s]||seen[s])continue;let head=0,tail=0;q[tail++]=s;seen[s]=1;let minX=w,minY=h,maxX=0,maxY=0,area=0,sumX=0,sumY=0,pix=[];
   while(head<tail){const p=q[head++],x=p%w,y=(p/w)|0;pix.push(p);area++;sumX+=x;sumY+=y;if(x<minX)minX=x;if(x>maxX)maxX=x;if(y<minY)minY=y;if(y>maxY)maxY=y;
    const ns=[p-1,p+1,p-w,p+w];for(const n of ns){if(n<0||n>=mask.length||seen[n]||!mask[n])continue;const nx=n%w,ny=(n/w)|0;if(Math.abs(nx-x)+Math.abs(ny-y)!==1)continue;seen[n]=1;q[tail++]=n}
   }
   if(area<minArea)continue;
   const rowL=new Int32Array(maxY-minY+1);rowL.fill(2147483647);const rowR=new Int32Array(maxY-minY+1);rowR.fill(-1);const boundary=[];
   for(const p of pix){const x=p%w,y=(p/w)|0,ry=y-minY;if(x<rowL[ry])rowL[ry]=x;if(x>rowR[ry])rowR[ry]=x;
    if(x===0||x===w-1||y===0||y===h-1||!mask[p-1]||!mask[p+1]||!mask[p-w]||!mask[p+w])boundary.push({x,y})
   }
   const step=Math.max(1,Math.ceil(boundary.length/700));
   out.push({id:out.length,bbox:{x:minX,y:minY,w:maxX-minX+1,h:maxY-minY+1},area,cx:sumX/area,cy:sumY/area,rowL,rowR,boundary:boundary.filter((_,i)=>i%step===0)})
  }
  return out.sort((x,y)=>y.area-x.area)
 }
 function analyze(canvas){const a=foregroundMask(canvas);a.components=components(a);return a}
 function score(a,b,aw,ah,bw,bh){
  const ax=a.cx/aw,ay=a.cy/ah,bx=b.cx/bw,by=b.cy/bh,pos=Math.hypot(ax-bx,ay-by);
  const arA=a.bbox.w/a.bbox.h,arB=b.bbox.w/b.bbox.h,asp=Math.abs(Math.log((arA||1)/(arB||1)));
  const sw=a.bbox.w/aw,sh=a.bbox.h/ah,tw=b.bbox.w/bw,th=b.bbox.h/bh,size=Math.abs(Math.log((sw+1e-6)/(tw+1e-6)))+Math.abs(Math.log((sh+1e-6)/(th+1e-6)));
  const area=Math.abs(Math.log((a.area/(aw*ah)+1e-6)/(b.area/(bw*bh)+1e-6)));
  return pos*5+asp*1.3+size*1.7+area*.8
 }
 function match(target,source){
  const used=new Set(),pairs=[];
  for(const t of target.components){let best=null,bestS=Infinity;for(const s of source.components){if(used.has(s.id))continue;const sc=score(t,s,target.w,target.h,source.w,source.h);if(sc<bestS){bestS=sc;best=s}}
   if(best&&bestS<6){used.add(best.id);pairs.push({target:t,source:best,score:bestS})}
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
 function draw(canvas,target,source,pairs,{showTarget=true,showSource=true}={}){
  const ctx=canvas.getContext('2d');ctx.clearRect(0,0,canvas.width,canvas.height);ctx.lineWidth=1;
  const drawComp=(a,c,stroke)=>{ctx.strokeStyle=stroke;ctx.beginPath();for(let i=0;i<c.boundary.length;i++){const p=c.boundary[i],x=p.x/a.w*canvas.width,y=p.y/a.h*canvas.height;if(i===0)ctx.moveTo(x,y);else ctx.lineTo(x,y)}ctx.stroke()};
  if(showTarget)for(const c of target.components)drawComp(target,c,'rgba(80,220,120,.9)');
  if(showSource)for(const c of source.components)drawComp(source,c,'rgba(255,170,70,.9)');
  ctx.strokeStyle='rgba(110,170,255,.8)';for(const p of pairs||[]){ctx.beginPath();ctx.moveTo(p.target.cx/target.w*canvas.width,p.target.cy/target.h*canvas.height);ctx.lineTo(p.source.cx/source.w*canvas.width,p.source.cy/source.h*canvas.height);ctx.stroke()}
 }
 window.MTSUvWarp={analyze,match,warp,draw};
})();