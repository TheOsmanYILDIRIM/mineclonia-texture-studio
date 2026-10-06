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
 const sel=$('islandStudioTexture');sel.innerHTML='';
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
async function islandStudioRestore(){
 const src=islandStudio.imported;if(!src)return islandStudioStatus('Önce AI PNG Import yap.');
 const m=islandStudio.map;if(!m?.parts?.length)return islandStudioStatus('Bu model için export mapping bulunamadı.');
 const out=document.createElement('canvas');out.width=islandStudio.orig.width;out.height=islandStudio.orig.height;const g=out.getContext('2d');g.imageSmoothingEnabled=true;g.imageSmoothingQuality='high';
 for(const p of m.parts){const isl=islandStudio.islands[p.ai];if(!isl)continue;const tmp=document.createElement('canvas');tmp.width=p.src.w;tmp.height=p.src.h;tmp.getContext('2d').drawImage(src,p.dst.x,p.dst.y,p.dst.w,p.dst.h,0,0,p.src.w,p.src.h);for(const r of isl.rects||[])g.drawImage(tmp,r.x-p.src.x,r.y-p.src.y,r.w,r.h,r.x,r.y,r.w,r.h)}
 islandStudio.restored=out;islandStudioStatus('Geri toplandı · '+m.parts.length+' ada · '+out.width+'×'+out.height);islandStudioSetTab('restored')
}

window.MTSIslandStudio={open:async(path)=>{active=api().active?.()||null;return islandStudioOpen(path)},choose:islandStudioChoose};
try{bindIslandStudioUi()}catch(e){console.error('Island Studio bind',e)}
})();
