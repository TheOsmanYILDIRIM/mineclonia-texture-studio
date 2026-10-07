(()=>{
'use strict';
const $=id=>document.getElementById(id);
const S={open:false,meta:null,rec:null,orig:null,sourceAtlas:null,work:null,sourceAnalysis:null,targetAnalysis:null,sourceComp:null,targetComp:null,mesh:null,meshBasePoints:null,sourceCrop:null,meshBase:null,targetMaskWork:null,preview:null,selectedNode:null,mode:'vertex',pick:'source',grid:3,step:.25,ghost:.42,zoom:1,panX:0,panY:0,pointers:new Map(),pinch:0,drag:null,meshHistory:[],meshRedo:[],workHistory:[],workRedo:[],pairs:[],usedSource:new Set(),usedTarget:new Set(),manualSourceSeq:0,manualTargetSeq:0,addIslandMode:null,rectStart:null,rectPreview:null,wizardStep:1,alignDrag:null,alignPinch:null,alignScale:1,partTransform:{x:0,y:0,scale:1}};
async function decodeBlob(blob){if('createImageBitmap'in window){const b=await createImageBitmap(blob),c=document.createElement('canvas');c.width=b.width;c.height=b.height;c.getContext('2d').drawImage(b,0,0);b.close?.();return c}return await new Promise((res,rej)=>{const u=URL.createObjectURL(blob),im=new Image();im.onload=()=>{const c=document.createElement('canvas');c.width=im.naturalWidth;c.height=im.naturalHeight;c.getContext('2d').drawImage(im,0,0);URL.revokeObjectURL(u);res(c)};im.onerror=()=>{URL.revokeObjectURL(u);rej(Error('PNG okunamadı'))};im.src=u})}
const canvasBlob=c=>new Promise((res,rej)=>c.toBlob(b=>b?res(b):rej(Error('PNG oluşturulamadı')),'image/png'));
function cloneCanvas(c){const o=document.createElement('canvas');o.width=c.width;o.height=c.height;o.getContext('2d').drawImage(c,0,0);return o}
function toast(t){window.MTSVariantBridge?.toast?.(t)}
function status(t){const e=$('vuvStatus');if(e)e.textContent=t||''}
function islandLabel(c,prefix){return c?.label||prefix+((Number(c?.id)||0)+1)}
function analyze(){const W=window.MTSUvWarp;if(!W?.analyze)throw Error('UV analiz motoru yüklenmedi');S.targetAnalysis=W.analyze(S.orig,{bgMode:'auto',role:'target'});S.sourceAnalysis=W.analyze(S.sourceAtlas||S.work,{bgMode:'auto',role:'source'});for(const c of S.targetAnalysis.components)c.label='O'+(c.id+1);for(const c of S.sourceAnalysis.components)c.label='Ü'+(c.id+1);status(`Orijinal ${S.targetAnalysis.components.length} ada · Üretilen ${S.sourceAnalysis.components.length} ada`)}
function targetWorkRect(c=S.targetComp){if(!c)return null;const sx=S.work.width/S.orig.width,sy=S.work.height/S.orig.height;return{x:c.bbox.x*sx,y:c.bbox.y*sy,w:c.bbox.w*sx,h:c.bbox.h*sy,sx,sy}}
function nearestTargetForSource(src){
 if(!src||!S.targetAnalysis)return null;
 const sx=S.work.width/Math.max(1,S.orig.width),sy=S.work.height/Math.max(1,S.orig.height);
 let best=null,bestScore=Infinity;
 for(const t of S.targetAnalysis.components||[]){
   if(t.disabled||S.usedTarget.has(t.id))continue;
   const tx=t.cx*sx,ty=t.cy*sy,dx=src.cx-tx,dy=src.cy-ty;
   const dist=Math.hypot(dx,dy);
   // Position is authoritative. Size is only a weak tie-breaker because AI may
   // alter object scale/aspect while keeping it nearest to its original.
   const sw=Math.max(1,src.bbox.w),sh=Math.max(1,src.bbox.h);
   const tw=Math.max(1,t.bbox.w*sx),th=Math.max(1,t.bbox.h*sy);
   const sizePenalty=(Math.abs(Math.log(sw/tw))+Math.abs(Math.log(sh/th)))*Math.max(1,Math.min(S.work.width,S.work.height))*.015;
   const score=dist+sizePenalty;
   if(score<bestScore){bestScore=score;best=t}
 }
 return best;
}
function compContains(c,a,x,y){if(!c||!a||x<c.bbox.x||x>=c.bbox.x+c.bbox.w||y<c.bbox.y||y>=c.bbox.y+c.bbox.h)return false;const p=y*a.w+x;if(!a.mask[p])return false;const ry=y-c.bbox.y;if(ry<0||ry>=c.rowL.length)return false;const l=c.rowL[ry],r=c.rowR[ry];return l!==2147483647&&r>=0&&x>=l&&x<=r}
function compAt(a,x,y,used=new Set()){const hits=(a?.components||[]).filter(c=>!c.disabled&&!used.has(c.id)&&x>=c.bbox.x&&x<c.bbox.x+c.bbox.w&&y>=c.bbox.y&&y<c.bbox.y+c.bbox.h&&compContains(c,a,Math.floor(x),Math.floor(y))).sort((a,b)=>a.area-b.area);if(hits.length)return hits[0];let best=null,bd=Infinity;for(const c of a?.components||[]){if(c.disabled||used.has(c.id))continue;const dx=x-c.cx,dy=y-c.cy,d=dx*dx+dy*dy;if(d<bd){bd=d;best=c}}return Math.sqrt(bd)<Math.max(8,Math.min(a.w,a.h)*.08)?best:null}
function componentFromRect(a,rect,prefix,seq){let x0=Math.max(0,Math.floor(rect.x)),y0=Math.max(0,Math.floor(rect.y)),x1=Math.min(a.w,Math.ceil(rect.x+rect.w)),y1=Math.min(a.h,Math.ceil(rect.y+rect.h));let minX=a.w,minY=a.h,maxX=-1,maxY=-1,area=0,sx=0,sy=0;for(let y=y0;y<y1;y++)for(let x=x0;x<x1;x++)if(a.mask[y*a.w+x]){area++;sx+=x;sy+=y;minX=Math.min(minX,x);minY=Math.min(minY,y);maxX=Math.max(maxX,x);maxY=Math.max(maxY,y)}if(area<2)return null;const h=maxY-minY+1,rowL=new Int32Array(h),rowR=new Int32Array(h);rowL.fill(2147483647);rowR.fill(-1);for(let y=minY;y<=maxY;y++)for(let x=minX;x<=maxX;x++)if(a.mask[y*a.w+x]&&x>=x0&&x<x1&&y>=y0&&y<y1){const ry=y-minY;if(x<rowL[ry])rowL[ry]=x;if(x>rowR[ry])rowR[ry]=x}const id=Math.max(-1,...a.components.map(c=>Number(c.id)||0))+1;const c={id,bbox:{x:minX,y:minY,w:maxX-minX+1,h:maxY-minY+1},area,cx:sx/area,cy:sy/area,rowL,rowR,boundary:[],manual:true,label:prefix+'M'+seq};for(const p of a.components){if(p.manual||p.disabled)continue;const ix=Math.max(0,Math.min(p.bbox.x+p.bbox.w,x1)-Math.max(p.bbox.x,x0)),iy=Math.max(0,Math.min(p.bbox.y+p.bbox.h,y1)-Math.max(p.bbox.y,y0));if(ix*iy>0)p.disabled=true}a.components.push(c);return c}
function slotComponent(a,rect,label,slotId){
 const x0=Math.max(0,Math.floor(rect.x)),y0=Math.max(0,Math.floor(rect.y)),x1=Math.min(a.w,Math.ceil(rect.x+rect.w)),y1=Math.min(a.h,Math.ceil(rect.y+rect.h));
 let minX=a.w,minY=a.h,maxX=-1,maxY=-1,area=0,sx=0,sy=0;
 for(let y=y0;y<y1;y++)for(let x=x0;x<x1;x++)if(a.mask[y*a.w+x]){area++;sx+=x;sy+=y;minX=Math.min(minX,x);minY=Math.min(minY,y);maxX=Math.max(maxX,x);maxY=Math.max(maxY,y)}
 if(area<2)return null;
 const h=maxY-minY+1,rowL=new Int32Array(h),rowR=new Int32Array(h);rowL.fill(2147483647);rowR.fill(-1);const boundary=[];
 for(let y=minY;y<=maxY;y++)for(let x=minX;x<=maxX;x++){
   if(x<x0||x>=x1||y<y0||y>=y1||!a.mask[y*a.w+x])continue;
   const ry=y-minY;if(x<rowL[ry])rowL[ry]=x;if(x>rowR[ry])rowR[ry]=x;
   const edge=x===x0||x===x1-1||y===y0||y===y1-1||!a.mask[y*a.w+x-1]||!a.mask[y*a.w+x+1]||!a.mask[(y-1)*a.w+x]||!a.mask[(y+1)*a.w+x];
   if(edge)boundary.push({x,y});
 }
 return{id:slotId,bbox:{x:minX,y:minY,w:maxX-minX+1,h:maxY-minY+1},area,cx:sx/area,cy:sy/area,rowL,rowR,boundary,manual:false,slotScoped:true,label,slotId};
}
function applyIslandSlotComponents(){
 if(!S.islandSheetMode||!S.islandMap?.slots?.length||!S.sourceAnalysis||!S.targetAnalysis)return;
 const map=S.islandMap,srcSX=S.sourceAnalysis.w/Math.max(1,map.sheetW),srcSY=S.sourceAnalysis.h/Math.max(1,map.sheetH),tarSX=S.targetAnalysis.w/Math.max(1,map.sheetW),tarSY=S.targetAnalysis.h/Math.max(1,map.sheetH);
 const src=[],tar=[];
 for(const slot of map.slots){
   const sr={x:slot.cell.x*srcSX,y:slot.cell.y*srcSY,w:slot.cell.w*srcSX,h:slot.cell.h*srcSY};
   const tr={x:slot.cell.x*tarSX,y:slot.cell.y*tarSY,w:slot.cell.w*tarSX,h:slot.cell.h*tarSY};
   const sc=slotComponent(S.sourceAnalysis,sr,'Ü'+(slot.slotId+1),slot.slotId);
   const tc=slotComponent(S.targetAnalysis,tr,'O'+(slot.slotId+1),slot.slotId);
   if(sc)src.push(sc);if(tc)tar.push(tc);
 }
 S.sourceAnalysis.components=src;S.targetAnalysis.components=tar;
 status(`Slot tabanlı: Orijinal ${tar.length} ada · Üretilen ${src.length} ada`);
}
function cropSource(){const c=S.sourceComp;if(!c)return null;const src=S.sourceAtlas||S.work,out=document.createElement('canvas');out.width=c.bbox.w;out.height=c.bbox.h;const g=out.getContext('2d',{willReadFrequently:true});g.drawImage(src,c.bbox.x,c.bbox.y,c.bbox.w,c.bbox.h,0,0,c.bbox.w,c.bbox.h);const im=g.getImageData(0,0,out.width,out.height),d=im.data;for(let y=0;y<out.height;y++)for(let x=0;x<out.width;x++){const gx=c.bbox.x+x,gy=c.bbox.y+y;if(!compContains(c,S.sourceAnalysis,gx,gy))d[(y*out.width+x)*4+3]=0}g.putImageData(im,0,0);return out}
function clearComponent(canvas,c,a,target=false){if(!canvas||!c||!a)return;const g=canvas.getContext('2d',{willReadFrequently:true}),sx=target?canvas.width/a.w:1,sy=target?canvas.height/a.h:1,x0=Math.max(0,Math.floor(c.bbox.x*sx)),y0=Math.max(0,Math.floor(c.bbox.y*sy)),x1=Math.min(canvas.width,Math.ceil((c.bbox.x+c.bbox.w)*sx)),y1=Math.min(canvas.height,Math.ceil((c.bbox.y+c.bbox.h)*sy)),im=g.getImageData(x0,y0,x1-x0,y1-y0),d=im.data;for(let y=0;y<im.height;y++)for(let x=0;x<im.width;x++){const wx=x0+x,wy=y0+y,ax=target?Math.min(a.w-1,Math.floor(wx/sx)):wx,ay=target?Math.min(a.h-1,Math.floor(wy/sy)):wy;if(compContains(c,a,ax,ay))d[(y*im.width+x)*4+3]=0}g.putImageData(im,x0,y0)}
function buildTargetMaskWork(){if(!S.targetComp)return null;const out=document.createElement('canvas');out.width=S.work.width;out.height=S.work.height;const tr=targetWorkRect(),x0=Math.max(0,Math.floor(tr.x)),y0=Math.max(0,Math.floor(tr.y)),x1=Math.min(out.width,Math.ceil(tr.x+tr.w)),y1=Math.min(out.height,Math.ceil(tr.y+tr.h)),g=out.getContext('2d',{willReadFrequently:true}),im=g.createImageData(x1-x0,y1-y0),d=im.data;for(let y=0;y<im.height;y++)for(let x=0;x<im.width;x++){const wx=x0+x,wy=y0+y,ox=Math.max(0,Math.min(S.orig.width-1,Math.floor(wx/S.work.width*S.orig.width))),oy=Math.max(0,Math.min(S.orig.height-1,Math.floor(wy/S.work.height*S.orig.height)));if(compContains(S.targetComp,S.targetAnalysis,ox,oy))d[(y*im.width+x)*4+3]=255}g.putImageData(im,x0,y0);return out}
function compBoundaryPoints(a,c,scaleX=1,scaleY=1,offsetX=0,offsetY=0){
 const pts=(c?.boundary||[]).map(p=>({x:(p.x-offsetX)*scaleX,y:(p.y-offsetY)*scaleY}));
 if(pts.length)return pts;
 const out=[];const b=c?.bbox;if(!b)return out;
 for(let y=b.y;y<b.y+b.h;y++)for(let x=b.x;x<b.x+b.w;x++){
   if(!compContains(c,a,x,y))continue;
   const edge=x===0||y===0||x===a.w-1||y===a.h-1||!compContains(c,a,x-1,y)||!compContains(c,a,x+1,y)||!compContains(c,a,x,y-1)||!compContains(c,a,x,y+1);
   if(edge)out.push({x:(x-offsetX)*scaleX,y:(y-offsetY)*scaleY})
 }
 return out
}
function nearestBoundaryPoint(points,x,y){
 let best=null,bd=Infinity;
 for(const p of points){const dx=p.x-x,dy=p.y-y,d=dx*dx+dy*dy;if(d<bd){bd=d;best=p}}
 return best?{x:best.x,y:best.y}:null
}
function relaxMeshInteriorToBoundaries(){
 if(!S.mesh)return;const rows=S.mesh.rows,cols=S.mesh.cols;
 const tl=S.mesh.points[0][0],tr=S.mesh.points[0][cols],bl=S.mesh.points[rows][0],br=S.mesh.points[rows][cols];
 for(let r=1;r<rows;r++)for(let c=1;c<cols;c++){
   const u=c/cols,v=r/rows,p=S.mesh.points[r][c],top=S.mesh.points[0][c],bot=S.mesh.points[rows][c],left=S.mesh.points[r][0],right=S.mesh.points[r][cols];
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
function snapMeshBoundaryToRealIslands(){
 if(!S.mesh||!S.sourceComp||!S.targetComp||!S.sourceCrop)return;
 const srcB=S.sourceComp.bbox,tr=targetWorkRect(),dstScaleX=S.work.width/S.orig.width,dstScaleY=S.work.height/S.orig.height;
 const srcPts=compBoundaryPoints(S.sourceAnalysis,S.sourceComp,1,1,srcB.x,srcB.y);
 const dstPts=compBoundaryPoints(S.targetAnalysis,S.targetComp,dstScaleX,dstScaleY,0,0);
 const rows=S.mesh.rows,cols=S.mesh.cols;
 const sidePoint=(pts,side,t,b)=>{let cand=pts;if(side==='top'||side==='bottom'){const want=side==='top'?b.y:b.y+b.h-1;cand=pts.filter(p=>Math.abs(p.y-want)<=Math.max(1,b.h*.12));cand.sort((a,z)=>a.x-z.x)}else{const want=side==='left'?b.x:b.x+b.w-1;cand=pts.filter(p=>Math.abs(p.x-want)<=Math.max(1,b.w*.12));cand.sort((a,z)=>a.y-z.y)}if(!cand.length)cand=pts;return cand[Math.max(0,Math.min(cand.length-1,Math.round(t*(cand.length-1))))]||null};
 const sb={x:0,y:0,w:S.sourceCrop.width,h:S.sourceCrop.height},db={x:tr.x,y:tr.y,w:tr.w,h:tr.h};
 const snapSide=(r,c,side,t)=>{const p=S.mesh.points[r][c],sp=sidePoint(srcPts,side,t,sb),dp=sidePoint(dstPts,side,t,db);if(sp){p.u=sp.x;p.v=sp.y}if(dp){p.x=dp.x;p.y=dp.y}};
 for(let c=0;c<=cols;c++){snapSide(0,c,'top',c/cols);snapSide(rows,c,'bottom',c/cols)}
 for(let r=1;r<rows;r++){snapSide(r,0,'left',r/rows);snapSide(r,cols,'right',r/rows)}
 relaxMeshInteriorToBoundaries();
 for(const row of S.mesh.points)for(const p of row){p.ox=p.x;p.oy=p.y}
}
function applyPartTransform(){
 if(!S.mesh||!S.meshBasePoints)return;
 const tr=S.partTransform||{x:0,y:0,scale:1},base=S.meshBasePoints;
 let minX=Infinity,minY=Infinity,maxX=-Infinity,maxY=-Infinity;
 for(const row of base)for(const p of row){minX=Math.min(minX,p.x);minY=Math.min(minY,p.y);maxX=Math.max(maxX,p.x);maxY=Math.max(maxY,p.y)}
 const cx=(minX+maxX)/2,cy=(minY+maxY)/2;
 for(let r=0;r<S.mesh.points.length;r++)for(let c=0;c<S.mesh.points[r].length;c++){
   const b=base[r][c],p=S.mesh.points[r][c];
   p.x=cx+(b.x-cx)*tr.scale+tr.x;p.y=cy+(b.y-cy)*tr.scale+tr.y;
 }
 render();
}
function translateWholeObject(dx,dy){
 if(!S.mesh)return;
 S.partTransform.x+=dx;S.partTransform.y+=dy;applyPartTransform();
}
function scaleWholeObject(factor){
 if(!S.mesh)return;
 S.partTransform.scale=Math.max(.1,Math.min(10,S.partTransform.scale*factor));S.alignScale=S.partTransform.scale;applyPartTransform();
}
function setAlignVisibility(on){
 const gc=$('vuvGhostCanvas'),wc=$('vuvWorkCanvas'),mc=$('vuvMeshCanvas');
 if(gc){gc.style.zIndex=on?'6':'';gc.style.opacity=on?'1':''}
 if(wc){wc.style.zIndex=on?'4':''}
 if(mc){mc.style.zIndex=on?'8':''}
 const ghost=$('vuvGhost');if(ghost&&on){ghost.value='78';S.ghost=.78}
}
function meshCenter(){
 if(!S.mesh)return null;let minX=Infinity,minY=Infinity,maxX=-Infinity,maxY=-Infinity;
 for(const row of S.mesh.points)for(const p of row){minX=Math.min(minX,p.x);minY=Math.min(minY,p.y);maxX=Math.max(maxX,p.x);maxY=Math.max(maxY,p.y)}
 return Number.isFinite(minX)?{x:(minX+maxX)/2,y:(minY+maxY)/2}:null
}
function scaleMesh(factor){
 if(!S.mesh)return toast('Önce ada çiftini seç');
 if(S.wizardStep===3){scaleWholeObject(factor);status('Komple ada scale ×'+S.alignScale.toFixed(3));return}
 const c=meshCenter();if(!c)return;
 pushMesh();
 for(const row of S.mesh.points)for(const p of row){p.x=c.x+(p.x-c.x)*factor;p.y=c.y+(p.y-c.y)*factor}
 render();status('Merkezden scale ×'+factor.toFixed(3))
}
function focusMesh(){
 if(!S.mesh||!S.work)return;
 const stage=$('vuvStage'),stack=$('vuvStack');if(!stage||!stack)return;
 fitStack();let minX=Infinity,minY=Infinity,maxX=-Infinity,maxY=-Infinity;
 for(const row of S.mesh.points)for(const p of row){minX=Math.min(minX,p.x);minY=Math.min(minY,p.y);maxX=Math.max(maxX,p.x);maxY=Math.max(maxY,p.y)}
 const bw=Math.max(1,maxX-minX),bh=Math.max(1,maxY-minY),baseW=Math.max(1,stack.offsetWidth),baseH=Math.max(1,stack.offsetHeight);
 const boxPxW=bw/S.work.width*baseW,boxPxH=bh/S.work.height*baseH;
 const wanted=Math.min(stage.clientWidth*.68/Math.max(1,boxPxW),stage.clientHeight*.58/Math.max(1,boxPxH));
 S.zoom=Math.max(1,Math.min(12,wanted));
 const cx=(minX+maxX)/2/S.work.width*baseW,cy=(minY+maxY)/2/S.work.height*baseH;
 S.panX=stage.clientWidth/2-stack.offsetLeft-cx*S.zoom;
 S.panY=stage.clientHeight/2-stack.offsetTop-cy*S.zoom;
 applyView();
}
function makeMesh(snap=false){if(!S.sourceComp||!S.targetComp)return;S.sourceCrop=cropSource();const src=S.sourceComp.bbox,t=targetWorkRect(),cols=S.grid,rows=S.grid,pts=[];for(let r=0;r<=rows;r++){const row=[];for(let c=0;c<=cols;c++){const u=c/cols,v=r/rows;row.push({x:src.x+u*src.w,y:src.y+v*src.h,u:u*S.sourceCrop.width,v:v*S.sourceCrop.height,ox:src.x+u*src.w,oy:src.y+v*src.h})}pts.push(row)}S.mesh={cols,rows,points:pts};S.meshBasePoints=JSON.parse(JSON.stringify(pts));const srcCx=src.x+src.w/2,srcCy=src.y+src.h/2,tarCx=t.x+t.w/2,tarCy=t.y+t.h/2;S.partTransform={x:snap?tarCx-srcCx:0,y:snap?tarCy-srcCy:0,scale:1};S.alignScale=1;if(snap)applyPartTransform();S.selectedNode=null;S.meshHistory=[];S.meshRedo=[];S.meshBase=cloneCanvas(S.work);clearComponent(S.meshBase,S.sourceComp,S.sourceAnalysis,false);clearComponent(S.meshBase,S.targetComp,S.targetAnalysis,true);S.targetMaskWork=buildTargetMaskWork();if(snap){S.mode='move';setAlignVisibility(true)}render();if(snap)focusMesh();status(snap?'Komple ada hizalama · sürükle / pinch ile scale · orijinal önde':'Ada çifti hazır')}
function meshSnapshot(){return S.mesh?JSON.stringify(S.mesh.points):null}
function pushMesh(){const x=meshSnapshot();if(!x)return;S.meshHistory.push(x);if(S.meshHistory.length>50)S.meshHistory.shift();S.meshRedo=[]}
function captureWorkState(){return {canvas:cloneCanvas(S.work),pairs:S.pairs.map(x=>({...x})),usedSource:[...S.usedSource],usedTarget:[...S.usedTarget]}}
function restoreWorkState(st){S.work=cloneCanvas(st.canvas);S.pairs=st.pairs.map(x=>({...x}));S.usedSource=new Set(st.usedSource);S.usedTarget=new Set(st.usedTarget);S.mesh=null;S.meshBasePoints=null;S.sourceCrop=null;S.meshBase=null;S.targetMaskWork=null;S.sourceComp=null;S.targetComp=null;S.selectedNode=null;S.pick='source'}
function undo(){if(S.mesh&&S.meshHistory.length){S.meshRedo.push(meshSnapshot());S.mesh.points=JSON.parse(S.meshHistory.pop());render();return}if(S.workHistory.length){S.workRedo.push(captureWorkState());restoreWorkState(S.workHistory.pop());render();status('Son ada eşlemesi geri alındı')}}
function redo(){if(S.mesh&&S.meshRedo.length){S.meshHistory.push(meshSnapshot());S.mesh.points=JSON.parse(S.meshRedo.pop());render();return}if(S.workRedo.length){S.workHistory.push(captureWorkState());restoreWorkState(S.workRedo.pop());render();status('Ada eşlemesi yeniden uygulandı')}}
function resetMesh(){if(!S.mesh)return;if(S.wizardStep===3&&S.meshBasePoints){S.partTransform={x:0,y:0,scale:1};S.alignScale=1;applyPartTransform();return}pushMesh();for(const row of S.mesh.points)for(const p of row){p.x=p.ox;p.y=p.oy}render()}
function drawTri(ctx,img,a,b,c){ctx.save();ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);ctx.lineTo(c.x,c.y);ctx.closePath();ctx.clip();const u0=a.u,v0=a.v,u1=b.u,v1=b.v,u2=c.u,v2=c.v,det=(u0-u2)*(v1-v2)-(u1-u2)*(v0-v2);if(Math.abs(det)<1e-5){ctx.restore();return}const A=(a.x*(v1-v2)+b.x*(v2-v0)+c.x*(v0-v1))/det,B=(a.y*(v1-v2)+b.y*(v2-v0)+c.y*(v0-v1))/det,C=(a.x*(u2-u1)+b.x*(u0-u2)+c.x*(u1-u0))/det,D=(a.y*(u2-u1)+b.y*(u0-u2)+c.y*(u1-u0))/det,E=(a.x*(u1*v2-u2*v1)+b.x*(u2*v0-u0*v2)+c.x*(u0*v1-u1*v0))/det,F=(a.y*(u1*v2-u2*v1)+b.y*(u2*v0-u0*v2)+c.y*(u0*v1-u1*v0))/det;ctx.transform(A,B,C,D,E,F);ctx.drawImage(img,0,0);ctx.restore()}
function buildPreview(){if(!S.mesh||!S.sourceCrop||!S.meshBase)return S.work;const c=cloneCanvas(S.meshBase),layer=document.createElement('canvas');layer.width=c.width;layer.height=c.height;const lg=layer.getContext('2d');for(let r=0;r<S.mesh.rows;r++)for(let k=0;k<S.mesh.cols;k++){const p00=S.mesh.points[r][k],p10=S.mesh.points[r][k+1],p11=S.mesh.points[r+1][k+1],p01=S.mesh.points[r+1][k];drawTri(lg,S.sourceCrop,p00,p10,p11);drawTri(lg,S.sourceCrop,p00,p11,p01)}if(S.targetMaskWork&&S.wizardStep!==3&&!S.islandSheetMode){lg.globalCompositeOperation='destination-in';lg.drawImage(S.targetMaskWork,0,0);lg.globalCompositeOperation='source-over'}c.getContext('2d').drawImage(layer,0,0);return c}
function applyPart(){if(!S.mesh||!S.sourceComp||!S.targetComp)return toast('Önce bir source ada ve target ada eşleştir');S.workHistory.push(captureWorkState());if(S.workHistory.length>30)S.workHistory.shift();S.workRedo=[];const src=S.sourceComp,tar=S.targetComp,c=buildPreview();S.work=c;S.pairs.push({sourceId:src.id,targetId:tar.id,source:islandLabel(src,'Ü'),target:islandLabel(tar,'O')});S.usedSource.add(src.id);S.usedTarget.add(tar.id);S.mesh=null;S.sourceCrop=null;S.meshBase=null;S.targetMaskWork=null;S.sourceComp=null;S.targetComp=null;S.selectedNode=null;S.pick='source';render();status(`Ada birleştirildi · ${S.pairs.length} eşleşme · sıradaki Ü adayı seç`)}
function beginManualIsland(kind){S.addIslandMode=kind;S.pick=null;S.rectStart=null;S.rectPreview=null;S.mesh=null;S.sourceCrop=null;S.meshBase=null;S.targetMaskWork=null;S.selectedNode=null;render();toast(kind==='source'?'Kaynak adanın çevresine dikdörtgen çiz':'Hedef adanın çevresine dikdörtgen çiz')}
function rectNorm(a,b){return{x:Math.min(a.x,b.x),y:Math.min(a.y,b.y),w:Math.abs(a.x-b.x),h:Math.abs(a.y-b.y)}}
function finishManualIsland(){if(!S.addIslandMode||!S.rectPreview)return;const kind=S.addIslandMode,r=S.rectPreview,a=kind==='source'?S.sourceAnalysis:S.targetAnalysis,ar=kind==='source'?r:{x:r.x/S.work.width*S.orig.width,y:r.y/S.work.height*S.orig.height,w:r.w/S.work.width*S.orig.width,h:r.h/S.work.height*S.orig.height};S.addIslandMode=null;S.rectStart=null;S.rectPreview=null;if(ar.w<1||ar.h<1){render();return toast('Ada seçimi çok küçük')}if(kind==='source'){const c=componentFromRect(a,ar,'Ü',++S.manualSourceSeq);if(!c){render();return toast('Bu alanda source foreground bulunamadı')}S.sourceComp=c;S.pick='target';status(`${c.label} manuel ada oluşturuldu · hedefini seç`);toast('Manuel source ada hazır · şimdi orijinal hedefe dokun')}else{const c=componentFromRect(a,ar,'O',++S.manualTargetSeq);if(!c){render();return toast('Bu alanda target foreground bulunamadı')}S.targetComp=c;S.pick=null;if(S.sourceComp)makeMesh(true);status(`${c.label} manuel hedef ada oluşturuldu · otomatik oturtuldu`);toast('Manuel target ada hazır · otomatik üst üste getirildi')}render()}
function resetIslands(){S.work=cloneCanvas(S.sourceAtlas);S.pairs=[];S.usedSource=new Set();S.usedTarget=new Set();S.manualSourceSeq=0;S.manualTargetSeq=0;S.sourceComp=null;S.targetComp=null;S.mesh=null;S.sourceCrop=null;S.meshBase=null;S.targetMaskWork=null;S.selectedNode=null;S.pick='source';S.workHistory=[];S.workRedo=[];analyze();render();status(S.islandSheetMode?'Bağımsız ada tespiti sıfırlandı · eşleme en yakın konuma göre':'Ada tespiti ve eşleşmeler sıfırlandı')}
function fitStack(){const stage=$('vuvStage'),stack=$('vuvStack');if(!stage||!stack||!S.work)return;const sw=stage.clientWidth,sh=stage.clientHeight,ar=S.work.width/S.work.height;let w=sw,h=w/ar;if(h>sh){h=sh;w=h*ar}stack.style.width=w+'px';stack.style.height=h+'px';stack.style.left=((sw-w)/2)+'px';stack.style.top=((sh-h)/2)+'px'}
function screenToWork(e){const stage=$('vuvStage'),stack=$('vuvStack'),r=stage.getBoundingClientRect(),bw=stack.offsetWidth,bh=stack.offsetHeight,lx=(e.clientX-r.left-stack.offsetLeft-S.panX)/S.zoom,ly=(e.clientY-r.top-stack.offsetTop-S.panY)/S.zoom;return{x:lx/bw*S.work.width,y:ly/bh*S.work.height}}
function nearestNode(x,y){if(!S.mesh)return null;let best=null,bd=Infinity;const scale=$('vuvStack').offsetWidth/S.work.width*S.zoom,thr=28/Math.max(scale,.001);for(let r=0;r<=S.mesh.rows;r++)for(let c=0;c<=S.mesh.cols;c++){const p=S.mesh.points[r][c],d=Math.hypot(x-p.x,y-p.y);if(d<bd&&d<thr){bd=d;best={r,c,p}}}return best}
function inMesh(x,y){if(!S.mesh)return false;let minx=Infinity,miny=Infinity,maxx=-Infinity,maxy=-Infinity;for(const row of S.mesh.points)for(const p of row){minx=Math.min(minx,p.x);miny=Math.min(miny,p.y);maxx=Math.max(maxx,p.x);maxy=Math.max(maxy,p.y)}return x>=minx&&x<=maxx&&y>=miny&&y<=maxy}
function moveMesh(dx,dy){if(!S.mesh)return;for(const row of S.mesh.points)for(const p of row){p.x+=dx;p.y+=dy}render()}
function nudge(dx,dy){if(!S.mesh)return toast('Önce mesh oluştur');pushMesh();if(S.mode==='move'||!S.selectedNode)moveMesh(dx*S.step,dy*S.step);else{const p=S.mesh.points[S.selectedNode.r][S.selectedNode.c];p.x+=dx*S.step;p.y+=dy*S.step;render()}}
function pointerDown(e){if(!S.open)return;const p=screenToWork(e);if(S.wizardStep===3&&S.mesh){S.pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});$('vuvStage')?.setPointerCapture?.(e.pointerId);if(S.pointers.size===1){S.alignDrag={id:e.pointerId,x:p.x,y:p.y};S.alignPinch=null}else if(S.pointers.size===2){const pts=[...S.pointers.values()];S.alignPinch={d:Math.hypot(pts[1].x-pts[0].x,pts[1].y-pts[0].y)};S.alignDrag=null}return}if(S.addIslandMode){S.rectStart=p;S.rectPreview={x:p.x,y:p.y,w:0,h:0};S.drag={kind:'island-rect',id:e.pointerId};$('vuvStage')?.setPointerCapture?.(e.pointerId);render();return}if(S.pointers.size>=2)return;S.pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});if(S.pointers.size===2){const pts=[...S.pointers.values()];S.pinch=Math.hypot(pts[1].x-pts[0].x,pts[1].y-pts[0].y);S.drag=null;return}if(S.pick){const source=S.pick==='source',a=source?S.sourceAnalysis:S.targetAnalysis,ax=source?p.x:p.x/S.work.width*S.orig.width,ay=source?p.y:p.y/S.work.height*S.orig.height,c=compAt(a,ax,ay,source?S.usedSource:S.usedTarget);if(!c){toast('Kullanılmamış bir adanın içine dokun');return}if(source){S.sourceComp=c;if(S.islandSheetMode){const tc=nearestTargetForSource(c);if(tc){S.targetComp=tc;S.pick=null;makeMesh(true);setWizardStep(3);toast(`${islandLabel(c,'Ü')} → ${islandLabel(tc,'O')} · en yakın konum eşleştirildi`)}else{S.pick='target';setWizardStep(2);toast(`${islandLabel(c,'Ü')} seçildi · uygun hedef bulunamadı, elle seç`)}}else{S.pick='target';setWizardStep(2);toast(`${islandLabel(c,'Ü')} seçildi · şimdi orijinal hedef adaya dokun`)}}else{S.targetComp=c;S.pick=null;makeMesh(true);setWizardStep(3);toast(`${islandLabel(c,'O')} hedef seçildi · otomatik üst üste getirildi`)}render();return}if(S.mode==='pan'){S.drag={kind:'pan',x:e.clientX,y:e.clientY,px:S.panX,py:S.panY};return}if(S.mode==='move'&&inMesh(p.x,p.y)){pushMesh();S.drag={kind:'move',x:p.x,y:p.y};return}const n=nearestNode(p.x,p.y);if(n){pushMesh();S.selectedNode={r:n.r,c:n.c};S.drag={kind:'node',r:n.r,c:n.c};render()}else S.drag={kind:'pan',x:e.clientX,y:e.clientY,px:S.panX,py:S.panY}}
function pointerMove(e){if(S.wizardStep===3&&S.mesh&&S.pointers.has(e.pointerId)){S.pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});if(S.pointers.size===2&&S.alignPinch){const pts=[...S.pointers.values()],d=Math.hypot(pts[1].x-pts[0].x,pts[1].y-pts[0].y);if(S.alignPinch.d>0)scaleWholeObject(d/S.alignPinch.d);S.alignPinch.d=d;return}if(S.pointers.size===1&&S.alignDrag?.id===e.pointerId){const p=screenToWork(e),dx=p.x-S.alignDrag.x,dy=p.y-S.alignDrag.y;S.alignDrag.x=p.x;S.alignDrag.y=p.y;translateWholeObject(dx,dy);return}}if(S.drag?.kind==='island-rect'&&S.drag.id===e.pointerId){S.rectPreview=rectNorm(S.rectStart,screenToWork(e));render();return}if(!S.pointers.has(e.pointerId))return;S.pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});if(S.pointers.size===2){const pts=[...S.pointers.values()],d=Math.hypot(pts[1].x-pts[0].x,pts[1].y-pts[0].y);if(S.pinch){const stage=$('vuvStage').getBoundingClientRect(),cx=(pts[0].x+pts[1].x)/2-stage.left,cy=(pts[0].y+pts[1].y)/2-stage.top,k=d/S.pinch,nz=Math.max(.5,Math.min(12,S.zoom*k));S.panX=cx-(cx-S.panX)*nz/S.zoom;S.panY=cy-(cy-S.panY)*nz/S.zoom;S.zoom=nz;applyView()}S.pinch=d;return}if(!S.drag)return;if(S.drag.kind==='pan'){S.panX=S.drag.px+e.clientX-S.drag.x;S.panY=S.drag.py+e.clientY-S.drag.y;applyView();return}const p=screenToWork(e);if(S.drag.kind==='node'){const q=S.mesh.points[S.drag.r][S.drag.c];q.x=p.x;q.y=p.y;render()}else if(S.drag.kind==='move'){const dx=p.x-S.drag.x,dy=p.y-S.drag.y;S.drag.x=p.x;S.drag.y=p.y;moveMesh(dx,dy)}}
function pointerUp(e){if(S.wizardStep===3&&S.mesh&&S.pointers.has(e.pointerId)){S.pointers.delete(e.pointerId);S.alignDrag=null;if(S.pointers.size<2)S.alignPinch=null;return}if(S.drag?.kind==='island-rect'&&S.drag.id===e.pointerId){S.drag=null;finishManualIsland();return}S.pointers.delete(e.pointerId);if(S.pointers.size<2)S.pinch=0;S.drag=null}
function applyView(){const stack=$('vuvStack');if(!stack)return;fitStack();stack.style.transform=`translate(${S.panX}px,${S.panY}px) scale(${S.zoom})`;const z=$('vuvZoom');if(z)z.textContent=Math.round(S.zoom*100)+'%'}
function drawBoxes(ctx,a,color,prefix,selected,used,target=false){const sx=S.work.width/(target?S.orig.width:a.w),sy=S.work.height/(target?S.orig.height:a.h);ctx.save();ctx.font='bold 11px system-ui';ctx.textBaseline='top';for(const c of a.components||[]){if(c.disabled)continue;const x=c.bbox.x*sx,y=c.bbox.y*sy,w=c.bbox.w*sx,h=c.bbox.h*sy,sel=selected?.id===c.id,isUsed=used?.has(c.id);ctx.save();if(c.manual)ctx.setLineDash([5,3]);ctx.strokeStyle=sel?'#fff':isUsed?'rgba(130,138,148,.48)':color;ctx.lineWidth=sel?3:1;ctx.strokeRect(x+.5,y+.5,w,h);ctx.restore();const label=islandLabel(c,prefix)+(isUsed?' ✓':'');const tw=Math.max(30,ctx.measureText(label).width+7);ctx.fillStyle=isUsed?'rgba(45,49,55,.78)':'rgba(0,0,0,.72)';ctx.fillRect(x,y,tw,15);ctx.fillStyle=isUsed?'#a8b0ba':'#fff';ctx.fillText(label,x+3,y+2)}ctx.restore()}
function render(){if(!S.open||!S.work)return;S.preview=buildPreview();const wc=$('vuvWorkCanvas'),gc=$('vuvGhostCanvas'),mc=$('vuvMeshCanvas');for(const c of [wc,gc,mc]){c.width=S.work.width;c.height=S.work.height}wc.getContext('2d').drawImage(S.preview,0,0);const gg=gc.getContext('2d');gg.clearRect(0,0,gc.width,gc.height);gg.globalAlpha=S.ghost;gg.drawImage(S.orig,0,0,S.work.width,S.work.height);gg.globalAlpha=1;const m=mc.getContext('2d');m.clearRect(0,0,mc.width,mc.height);drawBoxes(m,S.sourceAnalysis,'rgba(255,178,55,.92)','Ü',S.sourceComp,S.usedSource,false);drawBoxes(m,S.targetAnalysis,'rgba(105,220,115,.92)','O',S.targetComp,S.usedTarget,true);if(S.rectPreview){m.save();m.strokeStyle=S.addIslandMode==='source'?'#ffbe50':'#72df7e';m.lineWidth=Math.max(1,2/S.zoom*S.work.width/Math.max(1,$('vuvStack').offsetWidth));m.setLineDash([8,5]);m.strokeRect(S.rectPreview.x,S.rectPreview.y,S.rectPreview.w,S.rectPreview.h);m.restore()}if(S.mesh){m.strokeStyle='rgba(190,100,255,.95)';m.lineWidth=Math.max(1,S.work.width/Math.max(1,$('vuvStack').offsetWidth)/S.zoom);for(let r=0;r<=S.mesh.rows;r++){m.beginPath();for(let c=0;c<=S.mesh.cols;c++){const p=S.mesh.points[r][c];c?m.lineTo(p.x,p.y):m.moveTo(p.x,p.y)}m.stroke()}for(let c=0;c<=S.mesh.cols;c++){m.beginPath();for(let r=0;r<=S.mesh.rows;r++){const p=S.mesh.points[r][c];r?m.lineTo(p.x,p.y):m.moveTo(p.x,p.y)}m.stroke()}for(let r=0;r<=S.mesh.rows;r++)for(let c=0;c<=S.mesh.cols;c++){const p=S.mesh.points[r][c],sel=S.selectedNode?.r===r&&S.selectedNode?.c===c;m.beginPath();m.fillStyle=sel?'#fff':'#b45cff';m.arc(p.x,p.y,Math.max(1.5,5.5/S.zoom*S.work.width/Math.max(1,$('vuvStack').offsetWidth)),0,Math.PI*2);m.fill()}}updateUi()}
const WIZARD=[
 ['Düzelteceğin adayı seç','Üretilen resimde düzeltmek istediğin parçaya dokun.'],
 ['Nereye gidecek?','Orijinal resimde bu parçanın olması gereken yere dokun.'],
 ['Üst üste getir','AI adasını parmağınla tutup komple sürükle. İki parmakla büyüt/küçült; orijinal önde görünür.'],
 ['Şeklini düzelt','Mor noktaları sürükle. Gerekirse taşı, büyüt veya küçült.'],
 ['Kontrol et','Üretilen parça ile orijinal hedefin üst üste gelişini kontrol et.'],
 ['Tamamla','Bu ada doğruysa İleri diyerek birleştir.'],
 ['Kaydet','Başka ada düzeltebilir veya işi kaydedip çıkabilirsin.']
];
function setWizardStep(n){
 S.wizardStep=Math.max(1,Math.min(7,n));const root=$('vertexUvStudio');if(root){root.classList.add('wizard-simple');root.dataset.wizardStep=String(S.wizardStep)}
 const d=WIZARD[S.wizardStep-1],badge=$('vuvStepBadge'),title=$('vuvStepTitle'),help=$('vuvStepHelp'),back=$('vuvBack'),next=$('vuvNext');
 if(badge)badge.textContent='Adım '+S.wizardStep+' / 7';if(title)title.textContent=d[0];if(help)help.textContent=d[1];if(back)back.disabled=S.wizardStep===1;
 if(next)next.textContent=S.wizardStep===7?'✓ Kaydet ve çık':S.wizardStep===6?'Adayı birleştir →':'İleri →';
}
function wizardBack(){
 if(S.wizardStep===2){S.sourceComp=null;S.targetComp=null;S.mesh=null;S.pick='source'}
 else if(S.wizardStep===3){S.targetComp=null;S.mesh=null;S.pick='target'}
 else if(S.wizardStep>3&&S.wizardStep<=6){S.pick=null}
 setWizardStep(S.wizardStep-1);render();
}
async function wizardNext(){
 if(S.wizardStep===1){if(!S.sourceComp)return toast('Önce üretilen adaya dokun');S.pick='target';setWizardStep(2);render();return}
 if(S.wizardStep===2){if(!S.targetComp)return toast('Önce orijinal hedef adaya dokun');if(!S.mesh)makeMesh(true);setWizardStep(3);render();return}
 if(S.wizardStep===3){S.meshBasePoints=null;for(const row of S.mesh.points)for(const p of row){p.ox=p.x;p.oy=p.y}S.mode='vertex';setAlignVisibility(false);setWizardStep(4);render();status('Komple hizalama tamam · şimdi vertexlerle şekli düzelt');return}
 if(S.wizardStep===4&&S.islandSheetMode){if(!S.mesh)return toast('Düzenlenecek ada yok');applyPart();if(openNextMappedIsland())return;setWizardStep(7);render();status('Tüm kayıtlı adalar tamam · kaydet ve UV’ye geri topla');return}
 if(S.wizardStep===4){setWizardStep(5);render();return}
 if(S.wizardStep===5){setWizardStep(6);render();return}
 if(S.wizardStep===6){if(!S.mesh)return toast('Düzenlenecek ada yok');applyPart();setWizardStep(7);render();return}
 if(S.wizardStep===7)return save();
}
function updateUi(){const pick=$('vuvPickState');if(pick)pick.textContent=S.addIslandMode?(S.addIslandMode==='source'?'Manuel source ada çiziliyor':'Manuel target ada çiziliyor'):S.pick==='source'?'1/2 · Üretilen adaya dokun':S.pick==='target'?'2/2 · Orijinal hedef adaya dokun':S.mesh?`${islandLabel(S.sourceComp,'Ü')} → ${islandLabel(S.targetComp,'O')} · mesh düzenleniyor`:'Ada çifti seç';document.querySelectorAll('[data-vuv-mode]').forEach(b=>b.classList.toggle('primary',b.dataset.vuvMode===S.mode));document.querySelectorAll('[data-vuv-step]').forEach(b=>b.classList.toggle('primary',Math.abs(Number(b.dataset.vuvStep)-S.step)<1e-6));const gs=$('vuvGridSelect');if(gs)gs.value=String(S.grid);const n=$('vuvNode');if(n)n.textContent=S.selectedNode?`R${S.selectedNode.r+1} C${S.selectedNode.c+1}`:'Node yok';const pairs=$('vuvPairs');if(pairs)pairs.innerHTML=S.pairs.length?S.pairs.map((p,i)=>`<span class="vuvPair">#${i+1} ${p.source} → ${p.target}</span>`).join(''):'<span class="stat">Henüz eşleşme yok</span>';const count=$('vuvPairCount');if(count)count.textContent=`${S.pairs.length} eşleşme`}

function openNextMappedIsland(){
 if(!S.islandSheetMode)return false;
 const src=(S.sourceAnalysis?.components||[]).find(c=>!S.usedSource.has(c.id));
 if(!src)return false;
 const tar=(S.targetAnalysis?.components||[]).find(c=>c.slotId===src.slotId&&!S.usedTarget.has(c.id));
 if(!tar)return false;
 S.sourceComp=src;S.targetComp=tar;S.pick=null;makeMesh(true);S.meshBasePoints=null;
 for(const row of S.mesh.points)for(const p of row){p.ox=p.x;p.oy=p.y}
 S.mode='vertex';setAlignVisibility(false);setWizardStep(4);focusMesh();render();
 status(`Ada ${src.slotId+1}/${S.sourceAnalysis.components.length} · otomatik eşleşti · normalize/düzelt`);
 return true;
}
async function openIslandSheet(ctx){
 const root=$('vertexUvStudio');if(!root)return toast('Vertex UV ekranı bulunamadı');
 root.classList.add('open');S.open=true;status('Ayrılmış adalar yükleniyor…');
 try{
   const [targetSheet,sourceSheet]=await Promise.all([decodeBlob(ctx.templateBlob),decodeBlob(ctx.importedBlob)]);
   Object.assign(S,{meta:ctx.meta,rec:{name:'AI_IMPORT.png'},orig:targetSheet,sourceAtlas:cloneCanvas(sourceSheet),work:cloneCanvas(sourceSheet),sourceComp:null,targetComp:null,mesh:null,meshBasePoints:null,sourceCrop:null,meshBase:null,targetMaskWork:null,preview:null,selectedNode:null,mode:'vertex',pick:'source',grid:3,step:.25,ghost:.42,zoom:1,panX:0,panY:0,pointers:new Map(),pinch:0,drag:null,meshHistory:[],meshRedo:[],workHistory:[],workRedo:[],pairs:[],usedSource:new Set(),usedTarget:new Set(),manualSourceSeq:0,manualTargetSeq:0,addIslandMode:null,rectStart:null,rectPreview:null,wizardStep:1,partTransform:{x:0,y:0,scale:1},islandSheetMode:true,islandMap:ctx.map});
   $('vuvTitle').textContent=(ctx.meta?.name||'Entity')+' · Ayrılmış Adalar';
   analyze();applyIslandSlotComponents();
   // AI may move/change the exported slots. Keep every detected object
   // independent, project the original reference to AI/work resolution, then
   // pair a selected AI object with the nearest unused original object.
   applyView();if(!openNextMappedIsland()){setWizardStep(1);render();status('Kayıtlı slotlardan otomatik ada bulunamadı');toast('Ada bulunamadı · elle seç')}else toast('Kayıtlı slotlar eşleşti · ilk ada normalize/düzeltmeye hazır');
 }catch(e){console.error(e);status('Açılış hatası: '+e.message);toast('Ada obje editörü açılamadı')}
}
async function open(){const lab=window.MTSVariantLab,meta=lab?.selectedMeta?.(),list=lab?.list?.()||[],idx=Number(lab?.selectedIndex?.()??0),rec=list[idx];if(!meta||!rec?.blob)return toast('Varyant seçilmedi');const root=$('vertexUvStudio');if(!root)return toast('Vertex UV ekranı bulunamadı');root.classList.add('open');S.open=true;status('Yükleniyor…');try{const ob=await window.MTSVariantBridge.originalBlob(meta.path),[orig,work]=await Promise.all([decodeBlob(ob),decodeBlob(rec.blob)]),sourceAtlas=cloneCanvas(work);Object.assign(S,{meta,rec,orig,sourceAtlas,work,sourceComp:null,targetComp:null,mesh:null,meshBasePoints:null,sourceCrop:null,meshBase:null,targetMaskWork:null,preview:null,selectedNode:null,mode:'vertex',pick:'source',grid:3,step:.25,ghost:.42,zoom:1,panX:0,panY:0,pointers:new Map(),pinch:0,drag:null,meshHistory:[],meshRedo:[],workHistory:[],workRedo:[],pairs:[],usedSource:new Set(),usedTarget:new Set(),manualSourceSeq:0,manualTargetSeq:0,addIslandMode:null,rectStart:null,rectPreview:null,wizardStep:1,partTransform:{x:0,y:0,scale:1}});$('vuvTitle').textContent=meta.name;analyze();setWizardStep(1);applyView();render();toast('Üretilen adaya dokun')}catch(e){console.error(e);status('Açılış hatası: '+e.message);toast('Vertex UV açılamadı: '+e.message)}}
function close(){S.open=false;$('vertexUvStudio')?.classList.remove('open')}
async function save(){if(!S.work)return;if(S.mesh)applyPart();const blob=await canvasBlob(S.work);if(S.islandSheetMode){const ok=await window.MTSIslandStudio?.acceptCorrectedSheet?.(blob);if(!ok)return toast('Düzeltilmiş ada sheet geri toplanamadı');close();toast(`Ada sheet düzeltildi · ${S.pairs.length} eşleşme · UV geri toplandı`);return}await window.MTSVariantLab?.saveUvVariant?.(S.meta,S.rec,blob);close();toast(`Vertex UV · ${S.pairs.length} ada eşleşmesi varyanta kaydedildi`)}
function bind(){const root=$('vertexUvStudio');if(!root||root.dataset.bound)return;root.dataset.bound='1';root.addEventListener('click',e=>{const b=e.target.closest('button,[data-vuv-mode],[data-vuv-step]');if(!b)return;if(b.id==='vuvClose')return close();if(b.id==='vuvBack')return wizardBack();if(b.id==='vuvNext')return wizardNext();if(b.id==='vuvPickSource'){S.addIslandMode=null;S.pick='source';render();return}if(b.id==='vuvPickTarget'){S.addIslandMode=null;S.pick='target';render();return}if(b.id==='vuvAddSourceIsland')return beginManualIsland('source');if(b.id==='vuvAddTargetIsland')return beginManualIsland('target');if(b.id==='vuvRedetect')return resetIslands();if(b.id==='vuvSnap')return makeMesh(true);if(b.id==='vuvScaleDownFine')return scaleMesh(.99);if(b.id==='vuvScaleUpFine')return scaleMesh(1.01);if(b.id==='vuvScaleDown')return scaleMesh(.975);if(b.id==='vuvScaleUp')return scaleMesh(1.025);if(b.id==='vuvApply')return applyPart();if(b.id==='vuvUndo')return undo();if(b.id==='vuvRedo')return redo();if(b.id==='vuvReset')return resetMesh();if(b.id==='vuvSave')return save();if(b.id==='vuvRecenter'){S.zoom=1;S.panX=S.panY=0;applyView();return}if(b.dataset.vuvMode){S.mode=b.dataset.vuvMode;S.addIslandMode=null;render();return}if(b.dataset.vuvStep){S.step=Number(b.dataset.vuvStep);render();return}if(b.dataset.dx||b.dataset.dy){nudge(Number(b.dataset.dx||0),Number(b.dataset.dy||0));return}});$('vuvGridSelect')?.addEventListener('change',e=>{S.grid=Math.max(2,Math.min(14,Number(e.target.value)||3));if(S.sourceComp&&S.targetComp)makeMesh(true);render()});$('vuvGhost')?.addEventListener('input',e=>{S.ghost=Number(e.target.value)/100;render()});const stage=$('vuvStage');stage.addEventListener('pointerdown',pointerDown);stage.addEventListener('pointermove',pointerMove);stage.addEventListener('pointerup',pointerUp);stage.addEventListener('pointercancel',pointerUp);stage.addEventListener('wheel',e=>{e.preventDefault();const k=e.deltaY<0?1.12:.89;S.zoom=Math.max(.5,Math.min(12,S.zoom*k));applyView()},{passive:false})}
window.MTSVertexUvStudio={open,openIslandSheet,close};
const go=()=>{bind();window.addEventListener('resize',()=>{if(S.open){fitStack();applyView()}})};document.readyState==='loading'?document.addEventListener('DOMContentLoaded',go,{once:true}):go();
})();