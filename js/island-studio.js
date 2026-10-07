(()=>{
'use strict';
const api=()=>window.MTSIslandBridge||{};
const $=id=>document.getElementById(id);
const toast=msg=>api().toast?.(msg);
const decodeBlobToCanvas=blob=>api().decodeBlobToCanvas(blob);
const canvasPngBlob=canvas=>api().canvasPngBlob(canvas);
const originalBlob=path=>api().originalBlob(path);
const assetTypeOf=x=>api().assetTypeOf(x);
const closeDetailSheet=()=>api().closeDetailSheet?.();
let active=null;
const CATALOG=new Proxy([], {get(_t,p){const a=api().catalog?.()||[];const v=a[p];return typeof v==='function'?v.bind(a):v}});
const islandStudio={meta:null,orig:null,islands:[],index:-1,tab:'edit',template:null,map:null,imported:null,restored:null,sel:null,drawing:false,start:null,handle:'move'};
function islandStudioKey(){return 'mts_uv_islands_v1:'+(islandStudio.meta?.path||islandStudio.meta?.id||'unknown')}
function islandStudioLoadMap(){
 try{const x=JSON.parse(localStorage.getItem(islandStudioKey())||'null');islandStudio.islands=Array.isArray(x?.islands)?x.islands:[]}catch(_){islandStudio.islands=[]}
 islandStudio.index=islandStudio.islands.length?0:-1;
 try{islandStudio.map=JSON.parse(localStorage.getItem(islandStudioKey()+':template')||'null')}catch(_){islandStudio.map=null}
 islandStudioStatus()
}
function islandStudioSave(){try{localStorage.setItem(islandStudioKey(),JSON.stringify({v:1,islands:islandStudio.islands,updatedAt:Date.now()}))}catch(_){}islandStudioStatus()}
function islandStudioStatus(extra=''){
 const n=islandStudio.islands.length,a=islandStudio.index>=0?islandStudio.islands[islandStudio.index]:null;
 $('islandStudioMeta').textContent=n?'Ada '+(islandStudio.index+1)+'/'+n+' · '+(a?.rects?.length||0)+' alan':'Ada yok';
 $('islandStudioStatus').textContent=extra||(islandStudio.meta?(islandStudio.meta.name+' · '+(islandStudio.orig?.width||0)+'×'+(islandStudio.orig?.height||0)+' · '+n+' ada'):'Model seç.')
}
function islandStudioDraw(canvas){
 const dst=$('islandStudioCanvas'),stage=$('islandStudioStage');if(!dst||!canvas)return;
 dst.width=canvas.width;dst.height=canvas.height;dst.getContext('2d').clearRect(0,0,dst.width,dst.height);dst.getContext('2d').drawImage(canvas,0,0);
 requestAnimationFrame(()=>islandStudioDrawSel())
}

function islandStudioSetHandle(h){
 islandStudio.handle=h||'move';document.querySelectorAll('[data-ih]').forEach(x=>x.classList.toggle('active',x.dataset.ih===islandStudio.handle));
 const el=$('islandJoystickTarget');if(el)el.textContent='Joystick: Seçim · '+(islandStudio.handle==='move'?'Taşı':islandStudio.handle.toUpperCase())
}
function islandStudioMove(dx,dy){
 const s=islandStudio.sel,cv=$('islandStudioCanvas');if(!s||!cv)return;
 const right=s.x+s.w-1,bottom=s.y+s.h-1,h=islandStudio.handle;
 if(h==='move'){s.x+=dx;s.y+=dy}
 else if(h==='tl'){const nx=Math.max(0,Math.min(right,s.x+dx)),ny=Math.max(0,Math.min(bottom,s.y+dy));s.w=right-nx+1;s.h=bottom-ny+1;s.x=nx;s.y=ny}
 else if(h==='tr'){const nr=Math.max(s.x,Math.min(cv.width-1,right+dx)),ny=Math.max(0,Math.min(bottom,s.y+dy));s.w=nr-s.x+1;s.h=bottom-ny+1;s.y=ny}
 else if(h==='bl'){const nx=Math.max(0,Math.min(right,s.x+dx)),nb=Math.max(s.y,Math.min(cv.height-1,bottom+dy));s.w=right-nx+1;s.h=nb-s.y+1;s.x=nx}
 else if(h==='br'){const nr=Math.max(s.x,Math.min(cv.width-1,right+dx)),nb=Math.max(s.y,Math.min(cv.height-1,bottom+dy));s.w=nr-s.x+1;s.h=nb-s.y+1}
 s.x=Math.max(0,Math.min(cv.width-1,s.x));s.y=Math.max(0,Math.min(cv.height-1,s.y));s.w=Math.max(1,Math.min(cv.width-s.x,s.w));s.h=Math.max(1,Math.min(cv.height-s.y,s.h));islandStudioDrawSel()
}
function islandStudioDrawSel(){
 const s=islandStudio.sel,el=$('islandStudioSelection'),cv=$('islandStudioCanvas'),stage=$('islandStudioStage');
 if(!s||islandStudio.tab!=='edit'||!cv?.width){el.style.display='none';return}
 const rx=stage.clientWidth/cv.width,ry=cv.getBoundingClientRect().height/cv.height;
 el.style.display='block';el.style.left=(s.x*rx)+'px';el.style.top=(s.y*ry)+'px';el.style.width=Math.max(2,s.w*rx)+'px';el.style.height=Math.max(2,s.h*ry)+'px'
}
function islandStudioPoint(e){
 const cv=$('islandStudioCanvas'),r=cv.getBoundingClientRect();
 return{x:Math.max(0,Math.min(cv.width-1,Math.floor((e.clientX-r.left)*cv.width/r.width))),y:Math.max(0,Math.min(cv.height-1,Math.floor((e.clientY-r.top)*cv.height/r.height)))}
}
function islandStudioSetTab(tab){
 islandStudio.tab=tab;document.querySelectorAll('[data-islandtab]').forEach(b=>b.classList.toggle('primary',b.dataset.islandtab===tab));
 if(tab==='edit')islandStudioDraw(islandStudio.orig);
 else if(tab==='template'){if(islandStudio.template)islandStudioDraw(islandStudio.template);else islandStudioBuildTemplate(false).then(x=>x&&islandStudioDraw(x))}
 else if(tab==='imported'){if(islandStudio.imported)islandStudioDraw(islandStudio.imported);else islandStudioStatus('Henüz AI PNG import edilmedi.')}
 else if(tab==='restored'){if(islandStudio.restored)islandStudioDraw(islandStudio.restored);else islandStudioStatus('Henüz geri toplanmış UV yok.')}
 islandStudioDrawSel()
}
async function islandStudioOpen(preselect=null){
 bindIslandStudioUi();const sel=$('islandStudioTexture');sel.innerHTML='';
 const entities=CATALOG.filter(x=>assetTypeOf(x)==='Entity');
 for(const x of entities){const o=document.createElement('option');o.value=x.path;o.textContent=x.name||x.id||x.path.split('/').pop();sel.appendChild(o)}
 if(preselect&&entities.some(x=>x.path===preselect))sel.value=preselect;$('islandStudio').classList.add('open');if(sel.value)await islandStudioChoose(sel.value)
}
async function islandStudioChoose(path){
 const x=CATALOG.find(a=>a.path===path);if(!x)return;
 islandStudio.meta=x;islandStudio.orig=await decodeBlobToCanvas(await originalBlob(x.path));islandStudio.template=null;islandStudio.imported=null;islandStudio.restored=null;islandStudio.sel={x:0,y:0,w:Math.max(2,Math.round(islandStudio.orig.width*.25)),h:Math.max(2,Math.round(islandStudio.orig.height*.25))};
 islandStudioLoadMap();islandStudioSetHandle('move');islandStudioSetTab('edit')
}
function islandStudioNew(){islandStudio.islands.push({id:'island_'+Date.now().toString(36),rects:[]});islandStudio.index=islandStudio.islands.length-1;islandStudioSave()}
async function islandStudioAdd(){if(islandStudio.index<0)islandStudioNew();if(!islandStudio.sel)return;islandStudio.islands[islandStudio.index].rects.push({...islandStudio.sel});islandStudioSave();await islandStudioBuildTemplate(false);islandStudioSetTab('template')}
function islandStudioCycle(d){if(!islandStudio.islands.length)return;islandStudio.index=(islandStudio.index+d+islandStudio.islands.length)%islandStudio.islands.length;islandStudioStatus()}
async function islandStudioDelete(){if(islandStudio.index<0)return;islandStudio.islands.splice(islandStudio.index,1);islandStudio.index=Math.min(islandStudio.islands.length-1,islandStudio.index);islandStudioSave();await islandStudioBuildTemplate(false);if(islandStudio.template)islandStudioSetTab('template')}
async function islandStudioBuildTemplate(download=false){
 if(!islandStudio.orig||!islandStudio.islands.length){islandStudioStatus('Önce ada tanımla.');return null}
 const src=islandStudio.orig,w=src.width,h=src.height,parts=[];
 for(let ai=0;ai<islandStudio.islands.length;ai++){
   const a=islandStudio.islands[ai],rs=a.rects||[];if(!rs.length)continue;
   const x0=Math.min(...rs.map(r=>r.x)),y0=Math.min(...rs.map(r=>r.y)),x1=Math.max(...rs.map(r=>r.x+r.w)),y1=Math.max(...rs.map(r=>r.y+r.h));
   parts.push({ai,x0,y0,w:x1-x0,h:y1-y0,rects:rs,cx:(x0+x1)/2,cy:(y0+y1)/2})
 }
 if(!parts.length){islandStudioStatus('Adalarda kayıtlı seçim yok.');return null}

 // Preserve the original UV composition. Enlarge the canvas around its center and push
 // every island radially away from the atlas center. Gap is proportional, never fixed pixels.
 const atlasCx=w/2,atlasCy=h/2;
 const gapRatio=.18; // 18% breathing room relative to each island + atlas scale
 const marginRatio=.16;
 const placed=parts.map(p=>{
   let vx=p.cx-atlasCx,vy=p.cy-atlasCy;
   // An island exactly at center still needs deterministic separation.
   if(Math.abs(vx)<.001&&Math.abs(vy)<.001){vx=1;vy=0}
   const ax=Math.abs(vx)/(w/2||1),ay=Math.abs(vy)/(h/2||1);
   // Push independently on both axes so separation grows horizontally AND vertically.
   const pushX=Math.sign(vx)*(w*gapRatio*(.55+.45*ax) + p.w*gapRatio*.5);
   const pushY=Math.sign(vy)*(h*gapRatio*(.55+.45*ay) + p.h*gapRatio*.5);
   return {...p,rawX:p.x0+pushX,rawY:p.y0+pushY}
 });
 const minX=Math.min(0,...placed.map(p=>p.rawX)),minY=Math.min(0,...placed.map(p=>p.rawY));
 const maxX=Math.max(w,...placed.map(p=>p.rawX+p.w)),maxY=Math.max(h,...placed.map(p=>p.rawY+p.h));
 const margin=Math.max(4,Math.round(Math.max(w,h)*marginRatio));
 const sheetW=Math.ceil(maxX-minX+margin*2),sheetH=Math.ceil(maxY-minY+margin*2);
 const shiftX=-minX+margin,shiftY=-minY+margin;
 const out=document.createElement('canvas');out.width=sheetW;out.height=sheetH;const g=out.getContext('2d');
 for(const p of placed){
   p.tx=Math.round(p.rawX+shiftX);p.ty=Math.round(p.rawY+shiftY);
   for(const rr of p.rects)g.drawImage(src,rr.x,rr.y,rr.w,rr.h,p.tx+rr.x-p.x0,p.ty+rr.y-p.y0,rr.w,rr.h)
 }
 islandStudio.template=out;
 islandStudio.map={v:2,layout:'radial-original',gapRatio,marginRatio,sheetW:out.width,sheetH:out.height,sourceW:w,sourceH:h,parts:placed.map(p=>({ai:p.ai,src:{x:p.x0,y:p.y0,w:p.w,h:p.h},dst:{x:p.tx,y:p.ty,w:p.w,h:p.h},rects:p.rects}))};
 try{localStorage.setItem(islandStudioKey()+':template',JSON.stringify(islandStudio.map))}catch(_){}
 if(download){
   const blob=await canvasPngBlob(out),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=(islandStudio.meta.id||'texture')+'_ISLAND_TEMPLATE.png';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
   islandStudioStatus('Export tamamlandı · orijinal düzen korunuyor · '+out.width+'×'+out.height+' · '+parts.length+' ada · boşluk %'+Math.round(gapRatio*100))
 }
 if(islandStudio.tab==='template')islandStudioDraw(out);return out
}
async function islandStudioImport(file){
 if(!file)return;try{
  const c=await decodeBlobToCanvas(file),m=islandStudio.map||JSON.parse(localStorage.getItem(islandStudioKey()+':template')||'null');
  islandStudio.imported=c;islandStudio.template=c;islandStudio.map=m;
  const expected=m?(m.sheetW+'×'+m.sheetH):'mapping yok',actual=c.width+'×'+c.height,ok=!!m&&c.width===m.sheetW&&c.height===m.sheetH;
  islandStudioStatus('Import: '+file.name+' · '+actual+' · beklenen '+expected+' · '+(ok?'UYUMLU':'BOYUT FARKLI'));
  islandStudioSetTab('imported')
 }catch(e){console.error(e);islandStudioStatus('Import başarısız: '+(e?.message||e));toast('AI PNG import edilemedi')}
}

function islandForegroundMask(canvas){
 const ctx=canvas.getContext('2d'),im=ctx.getImageData(0,0,canvas.width,canvas.height),d=im.data,w=canvas.width,h=canvas.height,n=w*h,mask=new Uint8Array(n);
 let amin=255,amax=0;for(let i=3;i<d.length;i+=4){amin=Math.min(amin,d[i]);amax=Math.max(amax,d[i])}
 if(amax-amin>80&&amin<40){for(let i=0;i<n;i++)mask[i]=d[i*4+3]>40?1:0;return mask}
 // Opaque AI output: estimate background from border pixels, robust median RGB.
 const rs=[],gs=[],bs=[];const take=(x,y)=>{const k=(y*w+x)*4;rs.push(d[k]);gs.push(d[k+1]);bs.push(d[k+2])};
 for(let x=0;x<w;x+=Math.max(1,Math.floor(w/128))){take(x,0);take(x,h-1)}
 for(let y=0;y<h;y+=Math.max(1,Math.floor(h/128))){take(0,y);take(w-1,y)}
 const med=a=>{a.sort((x,y)=>x-y);return a[Math.floor(a.length/2)]||0},br=med(rs),bg=med(gs),bb=med(bs);
 for(let i=0;i<n;i++){const k=i*4,dr=d[k]-br,dg=d[k+1]-bg,db=d[k+2]-bb;mask[i]=(dr*dr+dg*dg+db*db)>28*28?1:0}
 return mask
}
function islandComponents(mask,w,h,roi){
 const x0=Math.max(0,Math.floor(roi.x)),y0=Math.max(0,Math.floor(roi.y)),x1=Math.min(w,Math.ceil(roi.x+roi.w)),y1=Math.min(h,Math.ceil(roi.y+roi.h)),seen=new Uint8Array(w*h),out=[],q=[];
 for(let y=y0;y<y1;y++)for(let x=x0;x<x1;x++){const idx=y*w+x;if(!mask[idx]||seen[idx])continue;seen[idx]=1;q.length=0;q.push(idx);let qi=0,minx=x,maxx=x,miny=y,maxy=y,count=0;
  while(qi<q.length){const z=q[qi++],cy=Math.floor(z/w),cx=z-cy*w;count++;if(cx<minx)minx=cx;if(cx>maxx)maxx=cx;if(cy<miny)miny=cy;if(cy>maxy)maxy=cy;
   for(const [nx,ny] of [[cx-1,cy],[cx+1,cy],[cx,cy-1],[cx,cy+1],[cx-1,cy-1],[cx+1,cy-1],[cx-1,cy+1],[cx+1,cy+1]]){if(nx<x0||nx>=x1||ny<y0||ny>=y1)continue;const ni=ny*w+nx;if(mask[ni]&&!seen[ni]){seen[ni]=1;q.push(ni)}}}
  if(count>=Math.max(4,Math.round(w*h*.00001)))out.push({x:minx,y:miny,w:maxx-minx+1,h:maxy-miny+1,count,cx:(minx+maxx+1)/2,cy:(miny+maxy+1)/2})
 }
 return out
}
function islandDetectObject(src,p,map){
 const sx=src.width/(map.sheetW||src.width),sy=src.height/(map.sheetH||src.height),ex=(p.dst.x+p.dst.w/2)*sx,ey=(p.dst.y+p.dst.h/2)*sy,ew=Math.max(2,p.dst.w*sx),eh=Math.max(2,p.dst.h*sy);
 const roi={x:ex-ew*1.6,y:ey-eh*1.6,w:ew*3.2,h:eh*3.2},mask=islandForegroundMask(src),comps=islandComponents(mask,src.width,src.height,roi);
 let best=null,bestScore=1e9;const targetAR=p.src.w/Math.max(1,p.src.h),targetArea=ew*eh;
 // Detached AI specks can be several output pixels even when they represent only a 1–2 px
 // source artifact. Reject components that are tiny relative to THIS expected UV island.
 const minObjectArea=Math.max(4,targetArea*.035);
 for(const o of comps){if(o.count<minObjectArea)continue;const ar=o.w/Math.max(1,o.h),dist=Math.hypot((o.cx-ex)/Math.max(ew,1),(o.cy-ey)/Math.max(eh,1)),arErr=Math.abs(Math.log(Math.max(.05,ar)/Math.max(.05,targetAR))),areaErr=Math.abs(Math.log(Math.max(1,o.w*o.h)/Math.max(1,targetArea)));const score=dist*.9+arErr*1.8+areaErr*.55;if(score<bestScore){bestScore=score;best=o}}
 return best&&bestScore<4.2?{...best,score:bestScore}:null
}

function islandTargetMask(p,isl,density){
 const w=Math.max(1,Math.round(p.src.w*density)),h=Math.max(1,Math.round(p.src.h*density)),m=document.createElement('canvas');m.width=w;m.height=h;
 // Selection rectangles define membership only. The actual target contour comes from the
 // original UV pixels inside those selections, not from rectangular selection geometry.
 const native=document.createElement('canvas');native.width=p.src.w;native.height=p.src.h;const ng=native.getContext('2d');
 ng.drawImage(islandStudio.orig,p.src.x,p.src.y,p.src.w,p.src.h,0,0,p.src.w,p.src.h);
 const ni=ng.getImageData(0,0,p.src.w,p.src.h),d=ni.data,keep=new Uint8Array(p.src.w*p.src.h);
 for(const rr of isl.rects||[]){const x0=Math.max(0,rr.x-p.src.x),y0=Math.max(0,rr.y-p.src.y),x1=Math.min(p.src.w,rr.x-p.src.x+rr.w),y1=Math.min(p.src.h,rr.y-p.src.y+rr.h);for(let y=y0;y<y1;y++)for(let x=x0;x<x1;x++)keep[y*p.src.w+x]=1}
 // Prefer true alpha. If original atlas is opaque/black-backed, treat near-black as empty.
 let hasTransparent=false;for(let i=3;i<d.length;i+=4)if(d[i]<16){hasTransparent=true;break}
 for(let i=0;i<keep.length;i++){const k=i*4,solid=hasTransparent?d[k+3]>=16:(d[k+3]>=16&&(d[k]>10||d[k+1]>10||d[k+2]>10));d[k+3]=(keep[i]&&solid)?255:0;if(!d[k+3])d[k]=d[k+1]=d[k+2]=0}
 ng.putImageData(ni,0,0);m.getContext('2d').imageSmoothingEnabled=false;m.getContext('2d').drawImage(native,0,0,w,h);return m
}


function islandMaskInfo(canvas){
 const w=canvas.width,h=canvas.height,mask=islandForegroundMask(canvas);
 return {w,h,mask}
}
function islandDominantComponent(mask,w,h){
 const comps=islandComponents(mask,w,h,{x:0,y:0,w,h});
 if(!comps.length)return null;
 comps.sort((a,b)=>b.count-a.count);
 return comps[0]
}
function islandBoundaryEdges(mask,w,h,comp){
 const out=[],inside=(x,y)=>x>=0&&x<w&&y>=0&&y<h&&mask[y*w+x];
 for(let y=comp.y;y<comp.y+comp.h;y++)for(let x=comp.x;x<comp.x+comp.w;x++){
   if(!inside(x,y))continue;
   if(!inside(x,y-1))out.push([[x,y],[x+1,y]]);
   if(!inside(x+1,y))out.push([[x+1,y],[x+1,y+1]]);
   if(!inside(x,y+1))out.push([[x+1,y+1],[x,y+1]]);
   if(!inside(x-1,y))out.push([[x,y+1],[x,y]]);
 }
 return out
}
function islandTracePolygon(mask,w,h){
 const comp=islandDominantComponent(mask,w,h);if(!comp)return null;
 const edges=islandBoundaryEdges(mask,w,h,comp);if(!edges.length)return null;
 const key=p=>p[0]+','+p[1],next=new Map();
 for(const [a,b] of edges){const k=key(a);if(!next.has(k))next.set(k,[]);next.get(k).push(b)}
 let start=edges[0][0];
 for(const [a] of edges)if(a[1]<start[1]||(a[1]===start[1]&&a[0]<start[0]))start=a;
 const pts=[{x:start[0],y:start[1]}];let cur=start,guard=0;
 while(guard++<200000){
   const arr=next.get(key(cur));if(!arr?.length)break;
   const n=arr.pop();cur=n;
   if(cur[0]===start[0]&&cur[1]===start[1])break;
   pts.push({x:cur[0],y:cur[1]})
 }
 if(pts.length<4)return null;
 return islandSimplifyPolygon(pts)
}
function islandSimplifyPolygon(poly){
 const same=(a,b)=>a.x===b.x&&a.y===b.y;
 let pts=poly.filter((p,i)=>i===0||!same(p,poly[i-1]));
 const col=(a,b,c)=>Math.abs((b.x-a.x)*(c.y-b.y)-(b.y-a.y)*(c.x-b.x))<1e-6;
 let changed=true;
 while(changed&&pts.length>=4){
   changed=false;const out=[];
   for(let i=0;i<pts.length;i++){
     const a=pts[(i-1+pts.length)%pts.length],b=pts[i],c=pts[(i+1)%pts.length];
     if(col(a,b,c)){changed=true;continue}
     out.push(b)
   }
   pts=out
 }
 // Remove only true micro-jogs: two consecutive edges both <= 2 px.
 changed=true;
 while(changed&&pts.length>=6){
   changed=false;const out=[];
   for(let i=0;i<pts.length;i++){
     const a=pts[(i-1+pts.length)%pts.length],b=pts[i],c=pts[(i+1)%pts.length];
     const l1=Math.hypot(b.x-a.x,b.y-a.y),l2=Math.hypot(c.x-b.x,c.y-b.y);
     if(l1<=2&&l2<=2){changed=true;continue}
     out.push(b)
   }
   pts=out
 }
 return pts
}
function islandTurn(poly,i){
 const a=poly[(i-1+poly.length)%poly.length],b=poly[i],c=poly[(i+1)%poly.length];
 const z=(b.x-a.x)*(c.y-b.y)-(b.y-a.y)*(c.x-b.x);
 return z>=0?1:-1
}
function islandResampleCorners(poly,n){
 if(poly.length===n)return poly.slice();
 // Arc-length resampling fallback when AI introduced/dropped tiny corners.
 const seg=[],cum=[0];let total=0;
 for(let i=0;i<poly.length;i++){const a=poly[i],b=poly[(i+1)%poly.length],l=Math.hypot(b.x-a.x,b.y-a.y);seg.push(l);total+=l;cum.push(total)}
 const out=[];
 for(let k=0;k<n;k++){
   const d=total*k/n;let i=0;while(i<seg.length-1&&cum[i+1]<d)i++;
   const a=poly[i],b=poly[(i+1)%poly.length],u=seg[i]?((d-cum[i])/seg[i]):0;
   out.push({x:a.x+(b.x-a.x)*u,y:a.y+(b.y-a.y)*u})
 }
 return out
}
function islandMatchCornerCycles(target,source){
 if(!target?.length||!source?.length)return null;
 const n=Math.max(4,Math.min(128,target.length));
 const t=islandResampleCorners(target,n),s0=islandResampleCorners(source,n);
 let best=null,bestScore=Infinity;
 for(const rev of [false,true]){
   const s=rev?s0.slice().reverse():s0;
   for(let shift=0;shift<n;shift++){
     let score=0;
     for(let i=0;i<n;i++){
       const a=t[i],b=s[(i+shift)%n];
       const ta=islandTurn(t,i),sa=islandTurn(s,(i+shift)%n);
       if(ta!==sa)score+=8;
       const ap=t[(i+1)%n],bp=s[(i+shift+1)%n];
       const al=Math.hypot(ap.x-a.x,ap.y-a.y),bl=Math.hypot(bp.x-b.x,bp.y-b.y);
       score+=Math.abs(Math.log((al+1e-3)/(bl+1e-3)));
     }
     if(score<bestScore){bestScore=score;best={t,s,shift,score}}
   }
 }
 if(!best)return null;
 return best.t.map((t,i)=>({target:t,source:best.s[(i+best.shift)%n]}))
}
function islandDenseControls(matched){
 const out=[];
 for(let i=0;i<matched.length;i++){
   const a=matched[i],b=matched[(i+1)%matched.length];
   const span=Math.max(Math.hypot(b.target.x-a.target.x,b.target.y-a.target.y),Math.hypot(b.source.x-a.source.x,b.source.y-a.source.y));
   const n=Math.max(2,Math.min(48,Math.ceil(span/3)+1));
   for(let k=0;k<n;k++){
     const u=k/(n-1);
     out.push({
       tx:a.target.x+(b.target.x-a.target.x)*u,
       ty:a.target.y+(b.target.y-a.target.y)*u,
       sx:a.source.x+(b.source.x-a.source.x)*u,
       sy:a.source.y+(b.source.y-a.source.y)*u
     })
   }
 }
 return out
}
function islandContourFit(source,targetMask){
 const fallback=()=>{
   const sw=source.width,sh=source.height,tw=targetMask.width,th=targetMask.height;
   const sg=source.getContext('2d',{willReadFrequently:true}),si=sg.getImageData(0,0,sw,sh),sd=si.data;
   const mg=targetMask.getContext('2d',{willReadFrequently:true}),mi=mg.getImageData(0,0,tw,th),md=mi.data;
   const out=document.createElement('canvas');out.width=tw;out.height=th;const og=out.getContext('2d'),oi=og.createImageData(tw,th),od=oi.data;
   const sample=(x,y)=>{x=Math.max(0,Math.min(sw-1,x));y=Math.max(0,Math.min(sh-1,y));const x0=Math.floor(x),y0=Math.floor(y),x1=Math.min(sw-1,x0+1),y1=Math.min(sh-1,y0+1),fx=x-x0,fy=y-y0,r=[0,0,0,0];for(let k=0;k<4;k++){const a=sd[(y0*sw+x0)*4+k]*(1-fx)+sd[(y0*sw+x1)*4+k]*fx,b=sd[(y1*sw+x0)*4+k]*(1-fx)+sd[(y1*sw+x1)*4+k]*fx;r[k]=Math.round(a*(1-fy)+b*fy)}return r};
   for(let y=0;y<th;y++)for(let x=0;x<tw;x++){const k=(y*tw+x)*4;if(md[k+3]<16){od[k]=od[k+1]=od[k+2]=od[k+3]=0;continue}const p=sample((x+.5)*sw/tw-.5,(y+.5)*sh/th-.5);od[k]=p[0];od[k+1]=p[1];od[k+2]=p[2];od[k+3]=255}
   og.putImageData(oi,0,0);return out
 };
 try{
   const sm=islandMaskInfo(source),tm=islandMaskInfo(targetMask);
   const sp=islandTracePolygon(sm.mask,sm.w,sm.h),tp=islandTracePolygon(tm.mask,tm.w,tm.h);
   if(!sp?.length||!tp?.length)return fallback();
   const matched=islandMatchCornerCycles(tp,sp);if(!matched?.length)return fallback();
   const controls=islandDenseControls(matched);if(controls.length<8)return fallback();

   const sw=source.width,sh=source.height,tw=targetMask.width,th=targetMask.height;
   const sg=source.getContext('2d',{willReadFrequently:true}),si=sg.getImageData(0,0,sw,sh),sd=si.data;
   const mg=targetMask.getContext('2d',{willReadFrequently:true}),mi=mg.getImageData(0,0,tw,th),md=mi.data;
   const out=document.createElement('canvas');out.width=tw;out.height=th;const og=out.getContext('2d'),oi=og.createImageData(tw,th),od=oi.data;
   const sample=(x,y)=>{x=Math.max(0,Math.min(sw-1,x));y=Math.max(0,Math.min(sh-1,y));const x0=Math.floor(x),y0=Math.floor(y),x1=Math.min(sw-1,x0+1),y1=Math.min(sh-1,y0+1),fx=x-x0,fy=y-y0,r=[0,0,0,0];for(let k=0;k<4;k++){const a=sd[(y0*sw+x0)*4+k]*(1-fx)+sd[(y0*sw+x1)*4+k]*fx,b=sd[(y1*sw+x0)*4+k]*(1-fx)+sd[(y1*sw+x1)*4+k]*fx;r[k]=Math.round(a*(1-fy)+b*fy)}return r};

   const radius=Math.max(8,Math.min(tw,th)*.32),r2=radius*radius;
   for(let y=0;y<th;y++)for(let x=0;x<tw;x++){
     const k=(y*tw+x)*4;if(md[k+3]<16){od[k]=od[k+1]=od[k+2]=od[k+3]=0;continue}
     let dx=0,dy=0,ws=0,nearest=Infinity,hard=null;
     for(const q of controls){
       const ax=(x+.5)-q.tx,ay=(y+.5)-q.ty,d2=ax*ax+ay*ay;
       if(d2<nearest){nearest=d2;hard=q}
       if(d2>r2)continue;
       const wt=1/Math.pow(d2+.05,1.25);dx+=(q.sx-q.tx)*wt;dy+=(q.sy-q.ty)*wt;ws+=wt
     }
     if(nearest<.08&&hard){dx=hard.sx-hard.tx;dy=hard.sy-hard.ty}else if(ws){dx/=ws;dy/=ws}else{dx=dy=0}
     const p=sample(x+.5+dx-.5,y+.5+dy-.5);od[k]=p[0];od[k+1]=p[1];od[k+2]=p[2];od[k+3]=255
   }
   og.putImageData(oi,0,0);return out
 }catch(e){console.warn('corner matched UV fit fallback',e);return fallback()}
}

async function islandStudioRestore(){
 const src=islandStudio.imported;if(!src)return islandStudioStatus('Önce AI PNG Import yap.');
 const m=islandStudio.map;if(!m?.parts?.length)return islandStudioStatus('Bu model için export mapping bulunamadı.');
 const densityX=src.width/Math.max(1,m.sheetW),densityY=src.height/Math.max(1,m.sheetH),density=Math.max(densityX,densityY);
 const outW=Math.max(1,Math.round(islandStudio.orig.width*density)),outH=Math.max(1,Math.round(islandStudio.orig.height*density)),out=document.createElement('canvas');out.width=outW;out.height=outH;const g=out.getContext('2d');g.imageSmoothingEnabled=true;g.imageSmoothingQuality='high';
 let found=0,warpedCount=0;const missed=[];
 for(const p of m.parts){const isl=islandStudio.islands[p.ai];if(!isl)continue;const obj=islandDetectObject(src,p,m);if(!obj){missed.push(p.ai+1);continue}
   const targetW=Math.max(1,Math.round(p.src.w*density)),targetH=Math.max(1,Math.round(p.src.h*density)),rough=document.createElement('canvas');rough.width=targetW;rough.height=targetH;rough.getContext('2d').drawImage(src,obj.x,obj.y,obj.w,obj.h,0,0,targetW,targetH);
   const mask=islandTargetMask(p,isl,density),fitted=islandContourFit(rough,mask);if(fitted!==rough)warpedCount++;
   g.drawImage(fitted,Math.round(p.src.x*density),Math.round(p.src.y*density));found++
 }
 if(!found){islandStudio.restored=null;islandStudioStatus('Hiçbir AI adası tespit edilemedi. Ayrılmış AI görünümünü kontrol et.');return}
 islandStudio.restored=out;islandStudioStatus('Köşe/kenar eşlemeli UV geri toplama · '+found+'/'+m.parts.length+' ada · '+outW+'×'+outH+(missed.length?' · bulunamadı: '+missed.join(', '):''));islandStudioSetTab('restored')
}

let islandPreview3dPromise=null;
async function islandEnsurePreview3d(){
 if(window.MTSPreview3D?.openVariant)return window.MTSPreview3D;
 if(!islandPreview3dPromise)islandPreview3dPromise=new Promise((resolve,reject)=>{
   const ready=()=>window.MTSPreview3D?.openVariant?resolve(window.MTSPreview3D):reject(Error('3D renderer dosyası yüklendi fakat başlatılamadı'));
   const existing=[...document.scripts].find(s=>/\/preview3d\.js(?:\?|$)/.test(s.src));
   if(existing){
     if(window.MTSPreview3D?.openVariant)return resolve(window.MTSPreview3D);
     existing.addEventListener('load',ready,{once:true});existing.addEventListener('error',()=>reject(Error('3D renderer dosyası yüklenemedi')),{once:true});
     setTimeout(()=>{if(window.MTSPreview3D?.openVariant)resolve(window.MTSPreview3D)},50);return
   }
   const s=document.createElement('script');s.src='js/preview3d.js?v=20261007-island3d1';s.async=true;s.onload=ready;s.onerror=()=>reject(Error('3D renderer dosyası yüklenemedi'));document.body.appendChild(s)
 });
 try{return await islandPreview3dPromise}catch(e){islandPreview3dPromise=null;throw e}
}
async function islandStudioPreview3d(){
 if(!islandStudio.restored)return islandStudioStatus('Önce UV’ye Geri Topla.');
 if(!islandStudio.meta)return islandStudioStatus('Entity seçili değil.');
 try{
   islandStudioStatus('3D önizleme hazırlanıyor…');
   const preview=await islandEnsurePreview3d();
   const restoredBlob=await canvasPngBlob(islandStudio.restored),origBlob=await originalBlob(islandStudio.meta.path);
   const variants=[{blob:origBlob,name:'Orijinal',system:true},{blob:restoredBlob,name:'Geri Toplanmış',system:true}];
   await preview.openVariant(islandStudio.meta,restoredBlob,'Geri Toplanmış UV',variants,1);
   islandStudioStatus('3D · Geri Toplanmış UV · '+islandStudio.restored.width+'×'+islandStudio.restored.height)
 }catch(e){console.error(e);islandStudioStatus('3D önizleme açılamadı: '+(e?.message||e));toast(e?.message||'3D önizleme açılamadı')}
}

function bindIslandStudioUi(){
 const root=$('islandStudio');if(!root||root.dataset.delegateBound==='1')return;root.dataset.delegateBound='1';
 root.addEventListener('click',async e=>{
   const t=e.target.closest('button,[data-islandtab],[data-ih]');if(!t)return;
   if(t.id==='islandStudioClose'){root.classList.remove('open');return}
   if(t.dataset.islandtab){islandStudioSetTab(t.dataset.islandtab);return}
   if(t.dataset.ih){islandStudioSetHandle(t.dataset.ih);e.stopPropagation();return}
   if(t.id==='islandStudioNew'){islandStudioNew();return}
   if(t.id==='islandStudioAdd'){await islandStudioAdd();return}
   if(t.id==='islandStudioPrev'){islandStudioCycle(-1);return}
   if(t.id==='islandStudioNext'){islandStudioCycle(1);return}
   if(t.id==='islandStudioDelete'){await islandStudioDelete();return}
   if(t.id==='islandStudioExport'){await islandStudioBuildTemplate(true);return}
   if(t.id==='islandStudioImport'){$('islandStudioFile')?.click();return}
   if(t.id==='islandStudioRestore'){await islandStudioRestore();return}
   if(t.id==='islandStudio3d'){await islandStudioPreview3d();return}
 });
 const tex=$('islandStudioTexture');if(tex)tex.addEventListener('change',e=>islandStudioChoose(e.target.value));
 const file=$('islandStudioFile');if(file)file.addEventListener('change',e=>islandStudioImport(e.target.files?.[0]));
 const joy=$('islandJoystick'),stick=$('islandStick');if(joy&&stick){let pid=null;joy.addEventListener('pointerdown',e=>{pid=e.pointerId;joy.setPointerCapture?.(pid);e.preventDefault()});joy.addEventListener('pointermove',e=>{if(e.pointerId!==pid)return;const r=joy.getBoundingClientRect(),cx=r.left+r.width/2,cy=r.top+r.height/2,dx=e.clientX-cx,dy=e.clientY-cy,rad=Math.max(1,r.width*.34),m=Math.hypot(dx,dy),k=Math.min(1,rad/(m||1));stick.style.transform='translate('+(dx*k)+'px,'+(dy*k)+'px)';const sx=Math.abs(dx)>r.width*.16?Math.sign(dx):0,sy=Math.abs(dy)>r.height*.16?Math.sign(dy):0;if((sx||sy)&&performance.now()-(joy._lastMove||0)>55){islandStudioMove(sx,sy);joy._lastMove=performance.now()}e.preventDefault()});const end=e=>{if(e.pointerId===pid){pid=null;stick.style.transform='translate(0,0)'}};joy.addEventListener('pointerup',end);joy.addEventListener('pointercancel',end)}
 const st=$('islandStudioStage');if(st){let pid=null,start=null;st.addEventListener('pointerdown',e=>{if(islandStudio.tab!=='edit'||e.target.closest('[data-ih]'))return;pid=e.pointerId;st.setPointerCapture?.(pid);start=islandStudioPoint(e);islandStudio.sel={x:start.x,y:start.y,w:1,h:1};islandStudioDrawSel();e.preventDefault()});st.addEventListener('pointermove',e=>{if(e.pointerId!==pid||!start)return;const p=islandStudioPoint(e),x=Math.min(start.x,p.x),y=Math.min(start.y,p.y);islandStudio.sel={x,y,w:Math.abs(p.x-start.x)+1,h:Math.abs(p.y-start.y)+1};islandStudioDrawSel();e.preventDefault()});const end=e=>{if(e.pointerId===pid){pid=null;start=null}};st.addEventListener('pointerup',end);st.addEventListener('pointercancel',end)}
}
window.MTSIslandStudio={open:async(path)=>islandStudioOpen(path),choose:islandStudioChoose};
const __bindIsland=()=>{try{bindIslandStudioUi()}catch(e){console.error('Island Studio bind',e)}};if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',__bindIsland,{once:true});else __bindIsland();
})();
