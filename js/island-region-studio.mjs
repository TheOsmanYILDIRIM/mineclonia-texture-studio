import {extractRegion,compositeRegion,scaleSavedRects,normalizedRects} from './island-region-core.mjs?v=20261009-regional1';

const $=id=>document.getElementById(id);
const bridge=()=>window.MTSIslandBridge||{};
const core=()=>window.MTSVariantBridge||{};
const state={meta:null,base:null,imported:null,preview:null,rect:null,scope:null,islands:[],index:-1,view:'active',mode:'move',pointer:null,epoch:0,busy:false};
const clone=r=>r&&({...r});
const label=s=>{const e=$('regionUvStatus');if(e)e.textContent=s};
const inform=s=>{label(s);bridge().toast?.(s)};
function canvasFromImage(image){const c=document.createElement('canvas');c.width=image.width;c.height=image.height;c.getContext('2d').putImageData(new ImageData(image.data,image.width,image.height),0,0);return c}
function baseImage(){const c=state.base;return c?.getContext('2d',{willReadFrequently:true}).getImageData(0,0,c.width,c.height)}
function imageOf(c){return c.getContext('2d',{willReadFrequently:true}).getImageData(0,0,c.width,c.height)}
function selected(){return state.scope?.length?state.scope:(state.rect?[state.rect]:[])}
function snapshot(){return normalizedRects(selected(),state.base.width,state.base.height)}
function setPendingClear(){state.preview=null;state.imported=null;if($('regionUvFile'))$('regionUvFile').value='';$('regionUvSave').disabled=true;view('active')}
function draw(){
 const base=state.base;if(!base)return;
 const image=state.view==='preview'&&state.preview?state.preview:state.view==='uploaded'&&state.imported?state.imported:base;
 const cv=$('regionUvCanvas'),outline=$('regionUvOverlay'),ctx=cv.getContext('2d');
 cv.width=image.width;cv.height=image.height;ctx.imageSmoothingEnabled=false;ctx.clearRect(0,0,cv.width,cv.height);ctx.drawImage(image,0,0);
 outline.width=cv.width;outline.height=cv.height;const g=outline.getContext('2d');g.clearRect(0,0,outline.width,outline.height);
 if(state.view!=='uploaded'){
   g.lineWidth=Math.max(1,Math.round(cv.width/256));g.strokeStyle='#87edc1';g.fillStyle='rgba(76,216,170,.09)';
   for(const r of selected()){g.strokeRect(r.x+.5,r.y+.5,Math.max(0,r.w-1),Math.max(0,r.h-1));g.fillRect(r.x,r.y,r.w,r.h)}
 }
 const stats=$('regionUvScope');if(stats)stats.textContent=selected().length+' alan · '+(state.base.width+'×'+state.base.height)+' aktif UV';
 const meta=$('regionUvMeta');if(meta)meta.textContent='Ada '+(state.index>=0?state.index+1:'–')+'/'+state.islands.length+' · '+(state.islands[state.index]?.rects?.length||0)+' kayıtlı alan';
}
function view(v){state.view=v;document.querySelectorAll('[data-region-view]').forEach(b=>b.classList.toggle('primary',b.dataset.regionView===v));draw()}
function scoped(rects){
 const good=normalizedRects(rects,state.base.width,state.base.height);
 if(!good.length)return inform('Önce bir UV bölgesi seç');
 state.scope=good;setPendingClear();draw();label(good.length+' bölge seçildi. İndir veya PNG yükle.');
}
function selection(){if(state.rect)scoped([state.rect])}
function islandSelect(){
 const rects=state.islands[state.index]?.rects||[];
 if(!rects.length)return inform('Bu adada kayıtlı alan yok');
 scoped(rects);
}
function key(){return 'mts_uv_islands_v1:'+(state.meta?.path||'unknown')}
function loadIslands(){
 let saved=null;try{saved=JSON.parse(localStorage.getItem(key())||'null')}catch{}
 const w=state.base.width,h=state.base.height,oldW=Number(saved?.width)||Number(state.meta.w)||w,oldH=Number(saved?.height)||Number(state.meta.h)||h;
 state.islands=(Array.isArray(saved?.islands)?saved.islands:[]).map((a,i)=>({
   id:a.id||'island_'+i,
   rects:oldW===w&&oldH===h?normalizedRects(a.rects||[],w,h):scaleSavedRects(a.rects||[],oldW,oldH,w,h)
 }));
 state.index=state.islands.length?0:-1;
 try{
   const m=JSON.parse(localStorage.getItem('mts_uv_region_export_v1:'+state.meta.path)||'null');
   if(m?.sourceW===w&&m?.sourceH===h&&Array.isArray(m.rects))state.scope=normalizedRects(m.rects,w,h);
 }catch{}
}
function saveIslands(){
 try{localStorage.setItem(key(),JSON.stringify({v:1,width:state.base.width,height:state.base.height,updatedAt:Date.now(),islands:state.islands}))}
 catch(e){label('Ada verisi saklanamadı: '+e.message)}
 draw();
}
function addIsland(){
 state.islands.push({id:'island_'+Date.now().toString(36),rects:[]});state.index=state.islands.length-1;
 state.scope=null;saveIslands();setPendingClear()
}
function addRect(){
 if(!state.rect)return inform('Önce alan çiz');
 if(state.index<0)addIsland();
 const rec=state.islands[state.index];rec.rects=normalizedRects([...rec.rects,state.rect],state.base.width,state.base.height);
 saveIslands();scoped(rec.rects)
}
function cycle(d){
 if(!state.islands.length)return;
 state.index=(state.index+d+state.islands.length)%state.islands.length;
 islandSelect();draw()
}
function deleteIsland(){
 if(state.index<0)return;
 state.islands.splice(state.index,1);state.index=Math.min(state.index,state.islands.length-1);
 state.scope=null;saveIslands();setPendingClear()
}
function editRect(dx,dy,mode){
 const r=state.rect;if(!r)return;
 let x=r.x,y=r.y,right=r.x+r.w,bottom=r.y+r.h;
 if(mode==='move'){x+=dx;right+=dx;y+=dy;bottom+=dy}
 if(mode==='tl'||mode==='bl')x+=dx;
 if(mode==='tr'||mode==='br')right+=dx;
 if(mode==='tl'||mode==='tr')y+=dy;
 if(mode==='bl'||mode==='br')bottom+=dy;
 x=Math.max(0,Math.min(state.base.width-1,x));y=Math.max(0,Math.min(state.base.height-1,y));
 right=Math.max(x+1,Math.min(state.base.width,right));bottom=Math.max(y+1,Math.min(state.base.height,bottom));
 state.rect={x,y,w:right-x,h:bottom-y};state.scope=null;setPendingClear();draw()
}
function point(e){
 const r=$('regionUvCanvas').getBoundingClientRect();
 return {x:Math.max(0,Math.min(state.base.width-1,Math.floor((e.clientX-r.left)*state.base.width/Math.max(1,r.width)))),y:Math.max(0,Math.min(state.base.height-1,Math.floor((e.clientY-r.top)*state.base.height/Math.max(1,r.height))))};
}
function initPointer(){
 const stage=$('regionUvStage');
 stage.addEventListener('pointerdown',e=>{
   if(!state.base||state.view!=='active')return;
   const p=point(e),isGrip=e.target.closest('[data-region-handle]');
   state.pointer={id:e.pointerId,start:p,old:clone(state.rect),mode:isGrip?isGrip.dataset.regionHandle:'draw'};
   if(!isGrip)state.rect={x:p.x,y:p.y,w:1,h:1};
   state.scope=null;setPendingClear();draw();stage.setPointerCapture?.(e.pointerId);e.preventDefault()
 });
 stage.addEventListener('pointermove',e=>{
   const drag=state.pointer;if(!drag||drag.id!==e.pointerId)return;
   const p=point(e),dx=p.x-drag.start.x,dy=p.y-drag.start.y;
   if(drag.mode==='draw')state.rect={x:Math.min(p.x,drag.start.x),y:Math.min(p.y,drag.start.y),w:Math.abs(p.x-drag.start.x)+1,h:Math.abs(p.y-drag.start.y)+1};
   else{state.rect=clone(drag.old);editRect(dx,dy,drag.mode)}
   draw();e.preventDefault()
 });
 const done=e=>{if(state.pointer?.id===e.pointerId){state.pointer=null;draw()}};
 stage.addEventListener('pointerup',done);stage.addEventListener('pointercancel',done);
}
function options(){
 return {mode:$('regionUvInputMode').value,dx:Number($('regionUvX').value),dy:Number($('regionUvY').value),scale:Number($('regionUvScale').value)}
}
async function exportRegion(){
 if(!state.base)return;
 try{
   const region=extractRegion(baseImage(),snapshot());
   const png=canvasFromImage(region.image);
   const blob=await bridge().canvasPngBlob(png);
   download(blob,(state.meta.name||'entity').replace(/\.png$/i,'')+'_region.png');
   localStorage.setItem('mts_uv_region_export_v1:'+state.meta.path,JSON.stringify({version:1,sourceW:state.base.width,sourceH:state.base.height,rects:region.rects}));
   inform('Seçilen '+region.image.width+'×'+region.image.height+' PNG indirildi. Diğer alanlar dışarı aktarılmadı.');
 }catch(e){inform('Bölge export hatası: '+e.message)}
}
function download(blob,name){
 const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=name;a.style.display='none';document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),3000);
}
async function loadPng(file){
 if(!file||!state.base)return;
 if(file.type&&!/png/.test(file.type)&&!file.name.toLowerCase().endsWith('.png'))return inform('PNG dosyası seç');
 const stamp=state.epoch;
 try{
   if(!snapshot().length)return inform('Önce hedef bölgeyi seç');
   const canvas=await bridge().decodeBlobToCanvas(file);
   if(stamp!==state.epoch)return;
   state.scope=snapshot();state.imported=canvas;state.preview=null;
   label('Yüklendi: '+canvas.width+'×'+canvas.height+'. Kaydırma/ölçekle eşleştir, sonra birleşimi önizle.');
   makePreview();
 }catch(e){inform('PNG okunamadı: '+e.message)}
}
function makePreview(){
 if(!state.imported||!state.base)return inform('Önce PNG yükle');
 try{
   const result=compositeRegion(baseImage(),imageOf(state.imported),snapshot(),options());
   state.preview=canvasFromImage(result.image);
   $('regionUvSave').disabled=result.changed===0;
   view('preview');
   label('Bölgesel önizleme · '+result.selected+' seçili piksel · '+result.changed+' RGB değişimi · dış alan ve alfa kilitli. Kaydetmeden önce 3D ile kontrol edebilirsin.');
 }catch(e){state.preview=null;$('regionUvSave').disabled=true;inform('Eşleme hatası: '+e.message)}
}
async function save(){
 if(!state.preview||!state.meta||state.busy)return;
 state.busy=true;const button=$('regionUvSave');button.disabled=true;
 try{
   const blob=await bridge().canvasPngBlob(state.preview);
   const ok=await bridge().saveRestored(state.meta.path,blob);
   if(!ok)throw Error('Edit store confirmation missing');
   state.base=state.preview;state.preview=null;state.imported=null;state.scope=null;
   view('active');label('Aktif texture güncellendi. Seçilmeyen bölgelerde hiçbir piksel değişmedi.');
 }catch(e){button.disabled=false;inform('Kaydedilemedi: '+e.message)}finally{state.busy=false}
}
async function fullExport(){if(!state.preview)return inform('Önce birleşimi önizle');const blob=await bridge().canvasPngBlob(state.preview);download(blob,(state.meta.name||'entity').replace(/\.png$/i,'')+'_region_merged.png')}
async function show3D(){
 if(!state.preview)return inform('Önce birleşimi önizle');
 try{
   const viewer=await bridge().ensurePreview3dLoaded?.();if(!viewer?.openVariant)throw Error('3D önizleme bulunamadı');
   const a=await bridge().canvasPngBlob(state.base),b=await bridge().canvasPngBlob(state.preview);
   await viewer.openVariant(state.meta,b,'Bölgesel değişim',[{blob:a,name:'Aktif texture'},{blob:b,name:'Bölgesel değişim'}],1);
 }catch(e){inform('3D açılamadı: '+e.message)}
}
function create(){
 if($('regionalUvStudio'))return;
 const root=document.createElement('div');root.id='regionalUvStudio';root.className='islandStudio islandRegionRoot';
 root.innerHTML=[
 '<div class="islandStudioTop"><button class="btn" id="regionUvClose">←</button><b>Bölgesel UV</b><select class="select" id="regionUvTexture"></select></div>',
 '<div class="regionUvHint">Aktif UV üzerinde bölge seç. PNG indirip düzenle veya bölgeye başka PNG yerleştir. <strong>Seçim dışı pikseller ve bütün alfa korunur.</strong></div>',
 '<div class="islandStudioTabs"><button class="btn primary" data-region-view="active">Aktif UV</button><button class="btn" data-region-view="uploaded">Yüklenen</button><button class="btn" data-region-view="preview">Birleşim</button><span class="stat" id="regionUvScope"></span></div>',
 '<div class="islandStudioStatus" id="regionUvStatus">Alan seç.</div>',
 '<div class="islandStudioStage" id="regionUvStage"><canvas id="regionUvCanvas"></canvas><canvas class="regionUvOverlay" id="regionUvOverlay"></canvas></div>',
 '<div class="islandStudioTools"><button class="btn primary" id="regionUvDirect">Çizili alanı kullan</button><button class="btn" id="regionUvAddIsland">+ Ada</button><button class="btn" id="regionUvAdd">Adaya ekle</button><button class="btn" id="regionUvPrev">← Ada</button><button class="btn" id="regionUvNext">Ada →</button><button class="btn" id="regionUvUseIsland">Adayı kullan</button><button class="btn danger" id="regionUvDel">Sil</button><span class="stat" id="regionUvMeta"></span></div>',
 '<div class="regionUvHandles">Seçimi ayarla: <button data-region-mode="move" class="btn primary">Taşı</button><button data-region-mode="tl" class="btn">↖</button><button data-region-mode="tr" class="btn">↗</button><button data-region-mode="bl" class="btn">↙</button><button data-region-mode="br" class="btn">↘</button><button class="btn" id="regionUvLeft">←</button><button class="btn" id="regionUvUp">↑</button><button class="btn" id="regionUvDown">↓</button><button class="btn" id="regionUvRight">→</button></div>',
 '<div class="regionUvOptions"><label>Yüklenen PNG <select id="regionUvInputMode"><option value="region">Seçilen bölge</option><option value="atlas">Tam UV atlası</option></select></label><label>X <input type="number" id="regionUvX" step="1" value="0"></label><label>Y <input type="number" id="regionUvY" step="1" value="0"></label><label>Ölçek <input type="number" id="regionUvScale" min=".1" max="20" step=".05" value="1"></label></div>',
 '<div class="islandStudioTools regionUvActions"><button class="btn" id="regionUvExport">Bölge PNG indir</button><button class="btn primary" id="regionUvImport">PNG yükle / eşleştir</button><button class="btn" id="regionUvPreview">Birleşimi önizle</button><button class="btn" id="regionUvFull">Tam UV PNG</button><button class="btn primary" id="regionUvSave" disabled>✓ Aktif texture’a kaydet</button><button class="btn" id="regionUv3D">3D bak</button><input id="regionUvFile" type="file" accept="image/png" hidden></div>'
 ].join('');
 document.body.append(root);
 const sheet=document.createElement('link');sheet.rel='stylesheet';sheet.href='css/island-region-studio.css?v=20261009-region1';document.head.append(sheet);
 initPointer();
 root.addEventListener('click',e=>{
   const b=e.target.closest('button');if(!b)return;
   if(b.id==='regionUvClose')root.classList.remove('open');
   if(b.dataset.regionView)view(b.dataset.regionView);
   if(b.dataset.regionMode){state.mode=b.dataset.regionMode;root.querySelectorAll('[data-region-mode]').forEach(x=>x.classList.toggle('primary',x===b))}
   if(b.id==='regionUvDirect')selection();
   if(b.id==='regionUvAddIsland')addIsland();
   if(b.id==='regionUvAdd')addRect();
   if(b.id==='regionUvPrev')cycle(-1);
   if(b.id==='regionUvNext')cycle(1);
   if(b.id==='regionUvUseIsland')islandSelect();
   if(b.id==='regionUvDel')deleteIsland();
   if(b.id==='regionUvExport')exportRegion();
   if(b.id==='regionUvImport')$('regionUvFile').click();
   if(b.id==='regionUvPreview')makePreview();
   if(b.id==='regionUvFull')fullExport();
   if(b.id==='regionUvSave')save();
   if(b.id==='regionUv3D')show3D();
   const steps={regionUvLeft:[-1,0],regionUvUp:[0,-1],regionUvDown:[0,1],regionUvRight:[1,0]};
   if(steps[b.id])editRect(...steps[b.id],state.mode);
 });
 $('regionUvFile').addEventListener('change',e=>{const f=e.target.files?.[0];if(f)loadPng(f)});
 ['regionUvInputMode','regionUvX','regionUvY','regionUvScale'].forEach(id=>$(id).addEventListener('change',()=>{if(state.imported)makePreview()}));
 $('regionUvTexture').addEventListener('change',e=>choose(e.target.value));
}
async function choose(path){
 const old=++state.epoch,meta=bridge().catalog?.().find(x=>x.path===path);
 if(!meta)return;
 state.meta=meta;state.base=null;state.preview=null;state.imported=null;state.scope=null;state.rect=null;
 try{
   const rec=await core().getEdit?.(path);
   const blob=rec?.blob||await bridge().originalBlob(path);
   const canvas=await bridge().decodeBlobToCanvas(blob);if(old!==state.epoch)return;
   state.base=canvas;
   state.rect={x:0,y:0,w:Math.max(1,Math.round(canvas.width*.25)),h:Math.max(1,Math.round(canvas.height*.25))};
   loadIslands();$('regionUvSave').disabled=true;view('active');
   label(meta.name+' · aktif '+canvas.width+'×'+canvas.height+' · sol tuş/parmakla alan çiz, ardından kullan.');
 }catch(e){inform('Aktif UV yüklenemedi: '+e.message)}
}
export async function open(path){
 create();const entries=(bridge().catalog?.()||[]).filter(x=>core().assetTypeOf?.(x)==='Entity');
 const picker=$('regionUvTexture');picker.innerHTML='';
 for(const x of entries){const o=document.createElement('option');o.value=x.path;o.textContent=x.name;picker.append(o)}
 if(path&&entries.some(x=>x.path===path))picker.value=path;
 $('regionalUvStudio').classList.add('open');if(picker.value)await choose(picker.value);
 return true;
}
