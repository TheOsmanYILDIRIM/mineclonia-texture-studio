(()=>{
'use strict';
const api=()=>window.MTSIslandBridge||{};
const $=id=>document.getElementById(id);
const toast=msg=>api().toast?.(msg);
const decodeBlobToCanvas=blob=>api().decodeBlobToCanvas(blob);
const canvasPngBlob=canvas=>api().canvasPngBlob(canvas);
const originalBlob=path=>api().originalBlob(path);
const assetTypeOf=x=>api().assetTypeOf(x);
const saveRestored=(path,blob)=>api().saveRestored?.(path,blob);
const closeDetailSheet=()=>api().closeDetailSheet?.();
let active=null;
const CATALOG=new Proxy([], {get(_t,p){const a=api().catalog?.()||[];const v=a[p];return typeof v==='function'?v.bind(a):v}});
const islandStudio={meta:null,orig:null,islands:[],index:-1,tab:'edit',template:null,map:null,imported:null,restored:null,sel:null,drawing:false,start:null,handle:'move',wizardStep:1};
function islandStudioKey(){return 'mts_uv_islands_v1:'+(islandStudio.meta?.path||islandStudio.meta?.id||'unknown')}
function islandStudioLoadMap(){
 try{const x=JSON.parse(localStorage.getItem(islandStudioKey())||'null');islandStudio.islands=Array.isArray(x?.islands)?x.islands:[]}catch(_){islandStudio.islands=[]}
 islandStudio.index=islandStudio.islands.length?0:-1;
 try{const m=JSON.parse(localStorage.getItem(islandStudioKey()+':template')||'null');islandStudio.map=m?.v===3&&m?.layout==='group-slots-v3'?m:null}catch(_){islandStudio.map=null}
 islandStudioStatus()
}
function islandStudioSave(){try{localStorage.setItem(islandStudioKey(),JSON.stringify({v:1,islands:islandStudio.islands,updatedAt:Date.now()}))}catch(_){}islandStudioStatus()}
const ISLAND_WIZARD=[['Adaları belirle','UV üzerinde bir parçayı seç. + Ada ile yeni ada aç, “Seçimi Adaya Ekle” ile alanı kaydet.'],['Kontrol et','Kaydettiğin adaları ileri/geri ile kontrol et. Gerekirse düzelt.'],['Ayrılmış halini gör','Export edilecek ayrılmış PNG’yi kontrol et.'],['Export et','Hazır. İleri dediğinde PNG export edilir ve ada düzeni cihazda kayıtlı kalır.']];
function islandWizardSet(n){islandStudio.wizardStep=Math.max(1,Math.min(4,n));const d=ISLAND_WIZARD[islandStudio.wizardStep-1],root=$('islandStudio');if(root)root.dataset.wizardStep=String(islandStudio.wizardStep);$('islandWizardBadge').textContent='Adım '+islandStudio.wizardStep+' / 4';$('islandWizardTitle').textContent=d[0];$('islandWizardHelp').textContent=d[1];$('islandWizardBack').disabled=islandStudio.wizardStep===1;$('islandWizardNext').textContent=islandStudio.wizardStep===4?'Export PNG':'İleri →';if(islandStudio.wizardStep<=2)islandStudioSetTab('edit');else islandStudioSetTab('template')}
async function islandWizardNext(){if(islandStudio.wizardStep===1&&!islandStudio.islands.some(a=>a.rects?.length))return toast('Önce en az bir ada kaydet');if(islandStudio.wizardStep===4){await islandStudioBuildTemplate(true);return toast('Export hazır · ada düzeni kaydedildi')}islandWizardSet(islandStudio.wizardStep+1)}
function islandWizardBack(){if(islandStudio.wizardStep>1)islandWizardSet(islandStudio.wizardStep-1)}
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
 if($('islandStudioApprove')){$('islandStudioApprove').disabled=false;$('islandStudioApprove').textContent='✓ Onayla / Aktif Yap'}
 if($('islandStudioRestoredExport'))$('islandStudioRestoredExport').disabled=false;
 islandStudioLoadMap();islandStudioSetHandle('move');islandWizardSet(islandStudio.islands.some(a=>a.rects?.length)?2:1)
}
function islandStudioNew(){islandStudio.islands.push({id:'island_'+Date.now().toString(36),rects:[]});islandStudio.index=islandStudio.islands.length-1;islandStudioSave()}
async function islandStudioAdd(){if(islandStudio.index<0)islandStudioNew();if(!islandStudio.sel)return;islandStudio.islands[islandStudio.index].rects.push({...islandStudio.sel});islandStudioSave();await islandStudioBuildTemplate(false);islandStudioSetTab('template')}
function islandStudioCycle(d){if(!islandStudio.islands.length)return;islandStudio.index=(islandStudio.index+d+islandStudio.islands.length)%islandStudio.islands.length;islandStudioStatus()}
async function islandStudioDelete(){if(islandStudio.index<0)return;islandStudio.islands.splice(islandStudio.index,1);islandStudio.index=Math.min(islandStudio.islands.length-1,islandStudio.index);islandStudioSave();await islandStudioBuildTemplate(false);if(islandStudio.template)islandStudioSetTab('template')}
async function islandStudioBuildTemplate(download=false){
 if(!islandStudio.orig||!islandStudio.islands.length){islandStudioStatus('Önce ada tanımla.');return null}
 const src=islandStudio.orig,parts=[];
 for(let ai=0;ai<islandStudio.islands.length;ai++){
   const rs=(islandStudio.islands[ai]?.rects||[]).filter(r=>r&&r.w>0&&r.h>0);if(!rs.length)continue;
   const x0=Math.min(...rs.map(r=>r.x)),y0=Math.min(...rs.map(r=>r.y)),x1=Math.max(...rs.map(r=>r.x+r.w)),y1=Math.max(...rs.map(r=>r.y+r.h));
   parts.push({ai,rects:rs.map(r=>({...r})),src:{x:x0,y:y0,w:x1-x0,h:y1-y0}})
 }
 if(!parts.length){islandStudioStatus('Adalarda kayıtlı seçim yok.');return null}

 // V3: every MANUAL island group gets a dedicated fixed slot.
 // Identity is carried by slot index; restore never guesses which island is which.
 const maxW=Math.max(...parts.map(p=>p.src.w)),maxH=Math.max(...parts.map(p=>p.src.h));
 const pad=Math.max(6,Math.ceil(Math.max(maxW,maxH)*.6));
 const cellW=maxW+pad*2,cellH=maxH+pad*2;
 const cols=Math.max(1,Math.ceil(Math.sqrt(parts.length))),rows=Math.ceil(parts.length/cols);
 const out=document.createElement('canvas');out.width=cols*cellW;out.height=rows*cellH;
 const g=out.getContext('2d');g.clearRect(0,0,out.width,out.height);
 const slots=[];
 for(let i=0;i<parts.length;i++){
   const p=parts[i],col=i%cols,row=Math.floor(i/cols),cell={x:col*cellW,y:row*cellH,w:cellW,h:cellH};
   const content={x:cell.x+Math.floor((cellW-p.src.w)/2),y:cell.y+Math.floor((cellH-p.src.h)/2),w:p.src.w,h:p.src.h};
   for(const rr of p.rects)g.drawImage(src,rr.x,rr.y,rr.w,rr.h,content.x+(rr.x-p.src.x),content.y+(rr.y-p.src.y),rr.w,rr.h);
   slots.push({slotId:i,ai:p.ai,src:p.src,rects:p.rects,cell,content})
 }
 islandStudio.template=out;
 islandStudio.map={v:3,layout:'group-slots-v3',sourceW:src.width,sourceH:src.height,sheetW:out.width,sheetH:out.height,cols,rows,cellW,cellH,pad,slots};
 try{localStorage.setItem(islandStudioKey()+':template',JSON.stringify(islandStudio.map))}catch(_){}
 if(download){
   const blob=await canvasPngBlob(out),url=URL.createObjectURL(blob),a=document.createElement('a');
   a.href=url;a.download=(islandStudio.meta.id||'texture')+'_ISLAND_SLOTS_V3.png';a.style.display='none';document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1500);
   islandStudioStatus('V3 slot export · '+parts.length+' ada · '+cols+'×'+rows+' slot · '+out.width+'×'+out.height)
 }
 if(islandStudio.tab==='template')islandStudioDraw(out);
 return out
}
async function islandStudioImport(file){
 if(!file)return;
 try{
   if(!islandStudio.map?.slots?.length||islandStudio.map.v!==3){
     islandStudioStatus('Yeni V3 düzeni için önce Export PNG yap, sonra o dosyanın AI sürümünü import et.');
     toast('Önce yeni V3 Export PNG yap');return
   }
   const c=await decodeBlobToCanvas(file),m=islandStudio.map;
   islandStudio.imported=c; // IMPORTANT: keep islandStudio.template as the original exported reference.
   const sx=c.width/Math.max(1,m.sheetW),sy=c.height/Math.max(1,m.sheetH);
   islandStudioStatus('AI Import · '+c.width+'×'+c.height+' · V3 slot ölçeği X '+sx.toFixed(2)+' / Y '+sy.toFixed(2));
   islandStudioSetTab('imported')
 }catch(e){console.error(e);islandStudioStatus('Import başarısız: '+(e?.message||e));toast('AI PNG import edilemedi')}
}
function islandForegroundMask(canvas){
 const ctx=canvas.getContext('2d',{willReadFrequently:true}),im=ctx.getImageData(0,0,canvas.width,canvas.height),d=im.data,w=canvas.width,h=canvas.height,n=w*h,mask=new Uint8Array(n);
 let amin=255,amax=0;for(let i=3;i<d.length;i+=4){amin=Math.min(amin,d[i]);amax=Math.max(amax,d[i])}
 if(amax-amin>80&&amin<40){for(let i=0;i<n;i++)mask[i]=d[i*4+3]>32?1:0;return mask}
 const rs=[],gs=[],bs=[],stepX=Math.max(1,Math.floor(w/96)),stepY=Math.max(1,Math.floor(h/96));
 const take=(x,y)=>{const k=(y*w+x)*4;rs.push(d[k]);gs.push(d[k+1]);bs.push(d[k+2])};
 for(let x=0;x<w;x+=stepX){take(x,0);take(x,h-1)}
 for(let y=0;y<h;y+=stepY){take(0,y);take(w-1,y)}
 const med=a=>{a.sort((x,y)=>x-y);return a[Math.floor(a.length/2)]||0},br=med(rs),bg=med(gs),bb=med(bs);
 for(let i=0;i<n;i++){const k=i*4,dr=d[k]-br,dg=d[k+1]-bg,db=d[k+2]-bb;mask[i]=(dr*dr+dg*dg+db*db)>26*26?1:0}
 return mask
}
function islandMaskBounds(mask,w,h,expected=null){
 let minx=w,miny=h,maxx=-1,maxy=-1,count=0;
 const ex=expected?Math.max(0,Math.floor(expected.x)):0,ey=expected?Math.max(0,Math.floor(expected.y)):0;
 const ex1=expected?Math.min(w,Math.ceil(expected.x+expected.w)):w,ey1=expected?Math.min(h,Math.ceil(expected.y+expected.h)):h;
 // First pass near the expected exported content, with generous padding.
 const mx=expected?Math.max(expected.w*.65,8):0,my=expected?Math.max(expected.h*.65,8):0;
 const sx0=expected?Math.max(0,Math.floor(ex-mx)):0,sy0=expected?Math.max(0,Math.floor(ey-my)):0;
 const sx1=expected?Math.min(w,Math.ceil(ex1+mx)):w,sy1=expected?Math.min(h,Math.ceil(ey1+my)):h;
 for(let y=sy0;y<sy1;y++)for(let x=sx0;x<sx1;x++)if(mask[y*w+x]){minx=Math.min(minx,x);miny=Math.min(miny,y);maxx=Math.max(maxx,x);maxy=Math.max(maxy,y);count++}
 if(!count)return null;
 return {x:minx,y:miny,w:maxx-minx+1,h:maxy-miny+1,count}
}
function islandGroupTargetMask(slot,density){
 const w=Math.max(1,Math.round(slot.src.w*density)),h=Math.max(1,Math.round(slot.src.h*density));
 const native=document.createElement('canvas');native.width=slot.src.w;native.height=slot.src.h;
 const ng=native.getContext('2d',{willReadFrequently:true});
 ng.drawImage(islandStudio.orig,slot.src.x,slot.src.y,slot.src.w,slot.src.h,0,0,slot.src.w,slot.src.h);
 const ni=ng.getImageData(0,0,slot.src.w,slot.src.h),d=ni.data,keep=new Uint8Array(slot.src.w*slot.src.h);
 for(const rr of slot.rects){
   const x0=Math.max(0,rr.x-slot.src.x),y0=Math.max(0,rr.y-slot.src.y),x1=Math.min(slot.src.w,x0+rr.w),y1=Math.min(slot.src.h,y0+rr.h);
   for(let y=y0;y<y1;y++)for(let x=x0;x<x1;x++)keep[y*slot.src.w+x]=1
 }
 let hasTransparent=false;for(let i=3;i<d.length;i+=4)if(d[i]<16){hasTransparent=true;break}
 for(let i=0;i<keep.length;i++){
   const k=i*4,solid=hasTransparent?d[k+3]>=16:(d[k+3]>=16&&(d[k]>8||d[k+1]>8||d[k+2]>8));
   const on=keep[i]&&solid;d[k+3]=on?255:0;if(!on)d[k]=d[k+1]=d[k+2]=0
 }
 ng.putImageData(ni,0,0);
 const out=document.createElement('canvas');out.width=w;out.height=h;const g=out.getContext('2d');g.imageSmoothingEnabled=false;g.drawImage(native,0,0,w,h);return out
}
function islandCropMask(mask,w,bb){
 const out=new Uint8Array(bb.w*bb.h);
 for(let y=0;y<bb.h;y++)for(let x=0;x<bb.w;x++)out[y*bb.w+x]=mask[(bb.y+y)*w+(bb.x+x)];
 return out
}
function islandFillBackgroundNearest(canvas,maskOverride=null){
 const w=canvas.width,h=canvas.height,n=w*h,ctx=canvas.getContext('2d',{willReadFrequently:true}),im=ctx.getImageData(0,0,w,h),d=im.data,mask=maskOverride||islandForegroundMask(canvas);
 const nearest=new Int32Array(n);nearest.fill(-1);const q=new Int32Array(n);let head=0,tail=0;
 for(let i=0;i<n;i++)if(mask[i]){nearest[i]=i;q[tail++]=i}
 if(!tail)return canvas;
 while(head<tail){
   const p=q[head++],x=p%w,y=(p/w)|0;
   if(x>0&&nearest[p-1]<0){nearest[p-1]=nearest[p];q[tail++]=p-1}
   if(x<w-1&&nearest[p+1]<0){nearest[p+1]=nearest[p];q[tail++]=p+1}
   if(y>0&&nearest[p-w]<0){nearest[p-w]=nearest[p];q[tail++]=p-w}
   if(y<h-1&&nearest[p+w]<0){nearest[p+w]=nearest[p];q[tail++]=p+w}
 }
 for(let i=0;i<n;i++)if(!mask[i]&&nearest[i]>=0){const s=nearest[i]*4,k=i*4;d[k]=d[s];d[k+1]=d[s+1];d[k+2]=d[s+2];d[k+3]=255}
 ctx.putImageData(im,0,0);return canvas
}
function islandFitFilledToMask(source,targetMask){
 const out=document.createElement('canvas');out.width=targetMask.width;out.height=targetMask.height;
 const g=out.getContext('2d',{willReadFrequently:true});g.imageSmoothingEnabled=true;g.imageSmoothingQuality='high';g.drawImage(source,0,0,out.width,out.height);
 const im=g.getImageData(0,0,out.width,out.height),d=im.data,m=targetMask.getContext('2d',{willReadFrequently:true}).getImageData(0,0,targetMask.width,targetMask.height).data;
 for(let i=0;i<d.length;i+=4)d[i+3]=m[i+3]>=16?255:0;
 g.putImageData(im,0,0);return out
}
async function islandStudioRestore(){
 const src=islandStudio.imported;if(!src)return islandStudioStatus('Önce AI PNG Import yap.');
 const m=islandStudio.map;if(!m?.slots?.length||m.v!==3)return islandStudioStatus('Bu import için V3 slot mapping yok. Yeni Export PNG ile tekrar başla.');
 const scaleX=src.width/Math.max(1,m.sheetW),scaleY=src.height/Math.max(1,m.sheetH),density=Math.min(scaleX,scaleY);
 const outW=Math.max(1,Math.round(m.sourceW*density)),outH=Math.max(1,Math.round(m.sourceH*density)),out=document.createElement('canvas');out.width=outW;out.height=outH;
 const g=out.getContext('2d');g.imageSmoothingEnabled=true;g.imageSmoothingQuality='high';
 let ok=0;const failed=[];
 for(const slot of m.slots){
   const cx=slot.cell.x*scaleX,cy=slot.cell.y*scaleY,cw=Math.max(1,slot.cell.w*scaleX),ch=Math.max(1,slot.cell.h*scaleY);
   const cell=document.createElement('canvas');cell.width=Math.max(1,Math.round(cw));cell.height=Math.max(1,Math.round(ch));
   cell.getContext('2d').drawImage(src,cx,cy,cw,ch,0,0,cell.width,cell.height);
   const expected={x:(slot.content.x-slot.cell.x)*scaleX,y:(slot.content.y-slot.cell.y)*scaleY,w:slot.content.w*scaleX,h:slot.content.h*scaleY};
   const mask=islandForegroundMask(cell),bb=islandMaskBounds(mask,cell.width,cell.height,expected);
   if(!bb){failed.push(slot.ai+1);continue}
   const detected=document.createElement('canvas');detected.width=bb.w;detected.height=bb.h;
   detected.getContext('2d').drawImage(cell,bb.x,bb.y,bb.w,bb.h,0,0,bb.w,bb.h);
   const detectedMask=islandCropMask(mask,cell.width,bb);
   islandFillBackgroundNearest(detected,detectedMask);
   const targetMask=islandGroupTargetMask(slot,density),fitted=islandFitFilledToMask(detected,targetMask);
   g.drawImage(fitted,Math.round(slot.src.x*density),Math.round(slot.src.y*density));ok++
 }
 if(!ok){islandStudio.restored=null;islandStudioStatus('Slotlarda AI adası bulunamadı.');return}
 islandStudio.restored=out;
 if($('islandStudioApprove')){$('islandStudioApprove').disabled=false;$('islandStudioApprove').textContent='✓ Onayla / Aktif Yap'}
 if($('islandStudioRestoredExport'))$('islandStudioRestoredExport').disabled=false;
 islandStudioStatus('V3 slot restore · '+ok+'/'+m.slots.length+' ada · '+outW+'×'+outH+(failed.length?' · bulunamadı: '+failed.join(', '):'')+' · onay bekliyor');
 islandStudioSetTab('restored')
}

async function islandStudioExportRestored(){
 if(!islandStudio.restored||!islandStudio.meta){islandStudioStatus('Önce UV’ye Geri Topla.');toast('Önce UV’ye Geri Topla');return}
 const blob=await canvasPngBlob(islandStudio.restored),url=URL.createObjectURL(blob),a=document.createElement('a');
 a.href=url;a.download=(islandStudio.meta.id||islandStudio.meta.name||'texture').replace(/\.png$/i,'')+'_RESTORED.png';
 a.style.display='none';document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1500);
 islandStudioStatus('Geri toplanmış PNG export edildi · onay verilmedi');toast('Geri toplanmış PNG indirildi')
}
async function islandStudioApproveRestored(){
 if(!islandStudio.restored||!islandStudio.meta){islandStudioStatus('Önce UV’ye Geri Topla.');toast('Önce UV’ye Geri Topla');return}
 const btn=$('islandStudioApprove');if(btn){btn.disabled=true;btn.textContent='Kaydediliyor…'}
 try{
   const blob=await canvasPngBlob(islandStudio.restored);
   const ok=await saveRestored(islandStudio.meta.path,blob);
   if(!ok)throw new Error('Kayıt bridge yanıt vermedi');
   islandStudioStatus('Onaylandı · aktif edit olarak kaydedildi · '+islandStudio.restored.width+'×'+islandStudio.restored.height);
   toast('Geri toplanmış UV aktif texture olarak kaydedildi');
   if(btn){btn.disabled=false;btn.textContent='✓ Onaylandı'}
 }catch(e){
   console.error(e);islandStudioStatus('Onay/kayıt başarısız: '+(e?.message||e));toast('UV kaydedilemedi');
   if(btn){btn.disabled=false;btn.textContent='✓ Onayla / Aktif Yap'}
 }
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
   if(t.id==='islandStudioClose'){root.classList.remove('open');return}if(t.id==='islandWizardBack'){islandWizardBack();return}if(t.id==='islandWizardNext'){await islandWizardNext();return}
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
   if(t.id==='islandStudioRestoredExport'){await islandStudioExportRestored();return}
   if(t.id==='islandStudioApprove'){await islandStudioApproveRestored();return}
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
