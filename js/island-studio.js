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
   for(const [nx,ny] of [[cx-1,cy],[cx+1,cy],[cx,cy-1],[cx,cy+1]]){if(nx<x0||nx>=x1||ny<y0||ny>=y1)continue;const ni=ny*w+nx;if(mask[ni]&&!seen[ni]){seen[ni]=1;q.push(ni)}}}
  if(count>=Math.max(4,Math.round(w*h*.00001)))out.push({x:minx,y:miny,w:maxx-minx+1,h:maxy-miny+1,count,cx:(minx+maxx+1)/2,cy:(miny+maxy+1)/2})
 }
 return out
}
function islandDetectObject(src,p,map){
 const sx=src.width/(map.sheetW||src.width),sy=src.height/(map.sheetH||src.height),mask=islandForegroundMask(src);
 const ex=(p.dst.x+p.dst.w/2)*sx,ey=(p.dst.y+p.dst.h/2)*sy,ew=Math.max(2,p.dst.w*sx),eh=Math.max(2,p.dst.h*sy);
 // Broad search: generation can shift/scale an island substantially.
 const roi={x:ex-ew*2.2,y:ey-eh*2.2,w:ew*4.4,h:eh*4.4},comps=islandComponents(mask,src.width,src.height,roi);
 if(!comps.length)return null;
 // Each manually selected sub-rect is an expected sub-object/region. Match independently,
 // then union the matches so disconnected nose/eye/etc pieces remain part of one island.
 const chosen=[],used=new Set(),rects=p.rects?.length?p.rects:[{x:p.src.x,y:p.src.y,w:p.src.w,h:p.src.h}];
 for(const rr of rects){
   const relX=(rr.x-p.src.x)/Math.max(1,p.src.w),relY=(rr.y-p.src.y)/Math.max(1,p.src.h),relW=rr.w/Math.max(1,p.src.w),relH=rr.h/Math.max(1,p.src.h);
   const rx=(p.dst.x+relX*p.dst.w)*sx,ry=(p.dst.y+relY*p.dst.h)*sy,rw=Math.max(2,relW*p.dst.w*sx),rh=Math.max(2,relH*p.dst.h*sy),rcx=rx+rw/2,rcy=ry+rh/2,targetAR=rw/rh,targetArea=rw*rh;
   let best=-1,bestScore=1e9;
   for(let i=0;i<comps.length;i++){if(used.has(i))continue;const o=comps[i],dist=Math.hypot((o.cx-rcx)/Math.max(rw,1),(o.cy-rcy)/Math.max(rh,1)),arErr=Math.abs(Math.log(Math.max(.05,o.w/o.h)/Math.max(.05,targetAR))),areaErr=Math.abs(Math.log(Math.max(1,o.w*o.h)/Math.max(1,targetArea)));const score=dist*.75+arErr*1.15+areaErr*.35;if(score<bestScore){bestScore=score;best=i}}
   if(best>=0&&bestScore<6.5){used.add(best);chosen.push(comps[best])}
 }
 // Also absorb small components lying inside/near the union envelope. AI often disconnects thin bridges.
 if(!chosen.length){
   const targetAR=p.src.w/Math.max(1,p.src.h),targetArea=ew*eh;let best=null,score0=1e9;
   for(const o of comps){const dist=Math.hypot((o.cx-ex)/Math.max(ew,1),(o.cy-ey)/Math.max(eh,1)),arErr=Math.abs(Math.log(Math.max(.05,o.w/o.h)/Math.max(.05,targetAR))),areaErr=Math.abs(Math.log(Math.max(1,o.w*o.h)/Math.max(1,targetArea))),score=dist*.75+arErr*1.15+areaErr*.35;if(score<score0){score0=score;best=o}}if(best)chosen.push(best)
 }
 if(!chosen.length)return null;
 let x0=Math.min(...chosen.map(o=>o.x)),y0=Math.min(...chosen.map(o=>o.y)),x1=Math.max(...chosen.map(o=>o.x+o.w)),y1=Math.max(...chosen.map(o=>o.y+o.h));
 for(const o of comps){if(chosen.includes(o))continue;const padX=(x1-x0)*.35,padY=(y1-y0)*.35;if(o.cx>=x0-padX&&o.cx<=x1+padX&&o.cy>=y0-padY&&o.cy<=y1+padY&&o.count<=Math.max(...chosen.map(x=>x.count))*1.2){chosen.push(o);x0=Math.min(x0,o.x);y0=Math.min(y0,o.y);x1=Math.max(x1,o.x+o.w);y1=Math.max(y1,o.y+o.h)}}
 return{x:x0,y:y0,w:x1-x0,h:y1-y0,count:chosen.reduce((s,o)=>s+o.count,0),components:chosen.length}
}

async function islandStudioRestore(){
 const src=islandStudio.imported;if(!src)return islandStudioStatus('Önce AI PNG Import yap.');
 const m=islandStudio.map;if(!m?.parts?.length)return islandStudioStatus('Bu model için export mapping bulunamadı.');
 // "Original UV" means original normalized layout, not original low pixel resolution.
 // Preserve the AI generation density using its scale relative to the separated template.
 const densityX=src.width/Math.max(1,m.sheetW),densityY=src.height/Math.max(1,m.sheetH);
 const density=Math.max(densityX,densityY);
 const outW=Math.max(1,Math.round(islandStudio.orig.width*density)),outH=Math.max(1,Math.round(islandStudio.orig.height*density));
 const out=document.createElement('canvas');out.width=outW;out.height=outH;const g=out.getContext('2d');g.imageSmoothingEnabled=true;g.imageSmoothingQuality='high';
 let found=0;const missed=[];
 for(const p of m.parts){const isl=islandStudio.islands[p.ai];if(!isl)continue;const obj=islandDetectObject(src,p,m);if(!obj){missed.push(p.ai+1);continue}
   // Fit the detected generated object to the original island geometry at high resolution.
   // X/Y are independent so generation aspect-ratio drift is intentionally corrected.
   const targetX=Math.round(p.src.x*density),targetY=Math.round(p.src.y*density),targetW=Math.max(1,Math.round(p.src.w*density)),targetH=Math.max(1,Math.round(p.src.h*density));
   const tmp=document.createElement('canvas');tmp.width=targetW;tmp.height=targetH;tmp.getContext('2d').drawImage(src,obj.x,obj.y,obj.w,obj.h,0,0,targetW,targetH);
   for(const rr of isl.rects||[]){const rx=Math.round((rr.x-p.src.x)*density),ry=Math.round((rr.y-p.src.y)*density),rw=Math.max(1,Math.round(rr.w*density)),rh=Math.max(1,Math.round(rr.h*density)),dx=Math.round(rr.x*density),dy=Math.round(rr.y*density);g.drawImage(tmp,rx,ry,rw,rh,dx,dy,rw,rh)}
   found++
 }
 if(!found){islandStudio.restored=null;islandStudioStatus('Hiçbir AI adası tespit edilemedi. Ayrılmış AI görünümünü kontrol et.');return}
 islandStudio.restored=out;islandStudioStatus('Obje bazlı geri toplama · '+found+'/'+m.parts.length+' ada · '+outW+'×'+outH+' · UV ölçeği '+density.toFixed(2)+'×'+(missed.length?' · bulunamadı: '+missed.join(', '):''));islandStudioSetTab('restored')
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
