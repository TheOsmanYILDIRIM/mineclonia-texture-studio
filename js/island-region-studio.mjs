import {extractRegion,compositeRegion,scaleSavedRects,normalizedRects} from './island-region-core.mjs?v=20261009-sourcecrop1';

// The active PNG is authoritative. Two independent selections: target UV and imported source.
const $=id=>document.getElementById(id);
const bridge=()=>window.MTSIslandBridge||{};
const legacy=()=>window.MTSVariantBridge||{};
const S={meta:null,base:null,imported:null,preview:null,rect:null,sourceRect:null,scope:null,islands:[],index:-1,view:'active',tool:'edit',handle:'move',drag:null,epoch:0,importEpoch:0,busy:false,zoom:1,nudge:1,undo:[],redo:[],editingIsland:false};
const clone=r=>r?{...r}:null;
const toast=t=>{const status=$('regionUvStatus');if(status)status.textContent=t;bridge().toast?.(t)};
const hint=t=>{const status=$('regionUvStatus');if(status)status.textContent=t};
const image=c=>c.getContext('2d',{willReadFrequently:true}).getImageData(0,0,c.width,c.height);
const activeRects=()=>S.scope?.length?S.scope:(S.rect?[S.rect]:[]);
const targetRects=()=>normalizedRects(activeRects(),S.base.width,S.base.height);
function makeCanvas(img){const c=document.createElement('canvas');c.width=img.width;c.height=img.height;c.getContext('2d').putImageData(new ImageData(img.data,img.width,img.height),0,0);return c}
function snapshot(){return {rect:clone(S.rect),sourceRect:clone(S.sourceRect),scope:S.scope?.map(clone)||null,islands:S.islands.map(a=>({id:a.id,rects:a.rects.map(clone)})),index:S.index,editingIsland:S.editingIsland,view:S.view}}
function historyButtons(){$('regionUvUndo').disabled=!S.undo.length;$('regionUvRedo').disabled=!S.redo.length}
function remember(){S.undo.push(snapshot());if(S.undo.length>100)S.undo.shift();S.redo=[];historyButtons()}
function restoreHistory(s){S.rect=clone(s.rect);S.sourceRect=clone(s.sourceRect);S.scope=s.scope?.map(clone)||null;S.islands=s.islands.map(a=>({id:a.id,rects:a.rects.map(clone)}));S.index=s.index;S.editingIsland=s.editingIsland;persistIslands();clearPreview();view(s.view==='preview'?'active':s.view);showIslandChoices()}
function travel(direction){const from=direction==='undo'?S.undo:S.redo,to=direction==='undo'?S.redo:S.undo;if(!from.length)return;to.push(snapshot());restoreHistory(from.pop());historyButtons()}
function syncIslandRect(){if(S.editingIsland&&S.index>=0&&S.islands[S.index]?.rects.length===1&&S.rect){S.islands[S.index].rects=[clone(S.rect)];S.scope=[clone(S.rect)];persistIslands()}}
function clearPreview(){
 S.preview=null;const save=$('regionUvSave');if(save)save.disabled=true;
}
function currentCanvas(){if(S.view==='uploaded')return S.imported;if(S.view==='preview')return S.preview;return S.base}
function rectInView(){return S.view==='uploaded'?S.sourceRect:S.rect||S.scope?.[0]||null}
function frameDims(){const c=currentCanvas();return c?{w:c.width,h:c.height}:null}
function draw(){
 const canvas=currentCanvas(),cv=$('regionUvCanvas');if(!cv)return;
 if(!canvas){cv.width=1;cv.height=1;cv.getContext('2d').clearRect(0,0,1,1);const overlay=$('regionUvOverlay');overlay.width=1;overlay.height=1;const selection=$('regionUvSelection');if(selection)selection.style.display='none';return}
 cv.width=canvas.width;cv.height=canvas.height;cv.getContext('2d').drawImage(canvas,0,0);
 const over=$('regionUvOverlay');over.width=canvas.width;over.height=canvas.height;
 const g=over.getContext('2d');g.clearRect(0,0,over.width,over.height);
 // Never paint inside selected pixels. Preview is always the clean, exact merged texture.
 const areas=S.view==='preview'?[]:S.view==='uploaded'?(S.sourceRect?[S.sourceRect]:[]):activeRects();
 g.lineWidth=1;g.strokeStyle=S.view==='uploaded'?'#ffd36b':'#a5f7bd';
 for(const r of areas)g.strokeRect(r.x+.5,r.y+.5,Math.max(0,r.w-1),Math.max(0,r.h-1));
 const grip=$('regionUvSelection'),r=rectInView();
 if(grip){
  grip.style.display='none'; // Corner targets live in the fixed joystick control, never over the image.
  if(r){
   const a=cv.getBoundingClientRect(),b=$('regionUvFrame').getBoundingClientRect();
   grip.style.left=(a.left-b.left+r.x*a.width/canvas.width)+'px';
   grip.style.top=(a.top-b.top+r.y*a.height/canvas.height)+'px';
   grip.style.width=Math.max(3,r.w*a.width/canvas.width)+'px';
   grip.style.height=Math.max(3,r.h*a.height/canvas.height)+'px';
   grip.querySelectorAll('[data-region-handle]').forEach(el=>el.classList.toggle('active',el.dataset.regionHandle===S.handle));
  }
 }
 const info=$('regionUvScope');
 if(info)info.textContent=S.view==='uploaded'?'Kaynak: '+canvas.width+'×'+canvas.height:S.base.width+'×'+S.base.height+' · '+activeRects().length+' hedef';
 const meta=$('regionUvMeta');if(meta)meta.textContent=S.islands.length?'Ada '+(S.index+1)+'/'+S.islands.length:'Kayıtlı ada yok';
}
function view(name){
 if(name==='uploaded'&&!S.imported){hint('Kaynak PNG henüz yüklenmedi. PNG yükle ile dosya seç.');return}
 if(name==='preview'&&!S.preview){hint('Önce kaynak adayı seçip birleşimi oluştur.');return}
 S.view=name;
 document.querySelectorAll('[data-region-view]').forEach(el=>el.classList.toggle('primary',el.dataset.regionView===name));
 draw();
}
function setTool(tool){
 S.tool=tool;
 $('regionalUvStudio').dataset.regionTool=tool;
 document.querySelectorAll('[data-region-tool]').forEach(el=>el.classList.toggle('primary',el.dataset.regionTool===tool));
 draw();
}
function setHandle(value){
 S.handle=value;
 const label={move:'Tüm seçim',tl:'Sol üst',tr:'Sağ üst',bl:'Sol alt',br:'Sağ alt'}[value]||'Tüm seçim';
 const el=$('regionUvHandleStatus');if(el)el.textContent=label+' · '+S.nudge+' px / adım';
 document.querySelectorAll('[data-region-handle-choice]').forEach(btn=>{const active=btn.dataset.regionHandleChoice===value;btn.classList.toggle('active',active);btn.setAttribute('aria-pressed',String(active))});
 draw();
}
function setNudge(value){
 const step=Number(value);
 if(![1,2,4,8].includes(step))return;
 S.nudge=step;
 document.querySelectorAll('[data-region-step]').forEach(el=>{
  const selected=Number(el.dataset.regionStep)===step;
  el.classList.toggle('active',selected);
  el.setAttribute('aria-pressed',String(selected));
 });
 setHandle(S.handle);
 try{localStorage.setItem('mts_uv_joystick_step_v1',String(step))}catch{}
}
function zoom(value){
 const stage=$('regionUvStage'),frame=$('regionUvFrame');if(!stage||!frame)return;
 const cx=(stage.scrollLeft+stage.clientWidth/2)/Math.max(1,frame.offsetWidth),cy=(stage.scrollTop+stage.clientHeight/2)/Math.max(1,frame.offsetHeight);
 S.zoom=Math.max(1,Math.min(12,Number(value)||1));
 frame.style.width=(S.zoom*100)+'%';
 $('regionUvZoom').value=String(S.zoom);$('regionUvZoomValue').textContent=S.zoom+'×';
 stage.scrollLeft=cx*frame.offsetWidth-stage.clientWidth/2;
 stage.scrollTop=cy*frame.offsetHeight-stage.clientHeight/2;
 draw();
}
function updateRect(dx,dy,where){
 const uploaded=S.view==='uploaded',canvas=uploaded?S.imported:S.base;
 const prop=uploaded?'sourceRect':'rect',r=S[prop];
 if(!canvas||!r)return;
 let x=r.x,y=r.y,right=r.x+r.w,bottom=r.y+r.h;
 if(where==='move'){
  const mx=Math.max(-x,Math.min(canvas.width-right,dx)),my=Math.max(-y,Math.min(canvas.height-bottom,dy));
  x+=mx;right+=mx;y+=my;bottom+=my;
 }else{
  if(where==='tl'||where==='bl')x=Math.max(0,Math.min(right-1,x+dx));
  if(where==='tr'||where==='br')right=Math.min(canvas.width,Math.max(x+1,right+dx));
  if(where==='tl'||where==='tr')y=Math.max(0,Math.min(bottom-1,y+dy));
  if(where==='bl'||where==='br')bottom=Math.min(canvas.height,Math.max(y+1,bottom+dy));
 }
 S[prop]={x,y,w:right-x,h:bottom-y};
 if(!uploaded){if(S.editingIsland)syncIslandRect();else S.scope=null;}
 clearPreview();draw();
}
function location(e){
 const cv=$('regionUvCanvas'),r=cv.getBoundingClientRect();
 const x=Math.floor((e.clientX-r.left)*cv.width/Math.max(1,r.width)),y=Math.floor((e.clientY-r.top)*cv.height/Math.max(1,r.height));
 return {x:Math.max(0,Math.min(cv.width-1,x)),y:Math.max(0,Math.min(cv.height-1,y))};
}
function initSelection(){
 const stage=$('regionUvStage');
 stage.addEventListener('pointerdown',e=>{
  if(!S.base||S.tool!=='edit'||S.view==='preview')return;
  const p=location(e);
  const canvas=currentCanvas();
  if(!canvas)return;
  const prop=S.view==='uploaded'?'sourceRect':'rect',r=S[prop];
  const inside=r&&p.x>=r.x&&p.x<r.x+r.w&&p.y>=r.y&&p.y<r.y+r.h;
  const operation=inside?'move':'draw';
  remember();S.drag={id:e.pointerId,start:p,origin:clone(r),operation,prop};
  if(operation==='draw')S[prop]={x:p.x,y:p.y,w:1,h:1};
  if(prop==='rect'&&!S.editingIsland)S.scope=null;
  clearPreview();draw();stage.setPointerCapture?.(e.pointerId);e.preventDefault();
 });
 stage.addEventListener('pointermove',e=>{
  const d=S.drag;if(!d||d.id!==e.pointerId)return;
  const p=location(e),dx=p.x-d.start.x,dy=p.y-d.start.y;
  if(d.operation==='draw')S[d.prop]={x:Math.min(p.x,d.start.x),y:Math.min(p.y,d.start.y),w:Math.abs(p.x-d.start.x)+1,h:Math.abs(p.y-d.start.y)+1};
  else{S[d.prop]=clone(d.origin);updateRect(dx,dy,'move')}
  clearPreview();draw();e.preventDefault();
 });
 const stop=e=>{if(S.drag?.id===e.pointerId){S.drag=null;draw()}};
 stage.addEventListener('pointerup',stop);stage.addEventListener('pointercancel',stop);
}
function initJoystick(){
 const joy=$('regionUvJoystick'),stick=$('regionUvStick');let id=null,last=0,prev='';
 joy.addEventListener('pointerdown',e=>{id=e.pointerId;prev='';last=0;joy.setPointerCapture?.(id);e.preventDefault()});
 joy.addEventListener('pointermove',e=>{
  if(id!==e.pointerId)return;
  const r=joy.getBoundingClientRect(),dx=e.clientX-r.left-r.width/2,dy=e.clientY-r.top-r.height/2;
  const magnitude=Math.hypot(dx,dy),reach=r.width*.31;
  const k=Math.min(1,reach/(magnitude||1));stick.style.transform='translate('+(dx*k)+'px,'+(dy*k)+'px)';
  const sx=Math.abs(dx)>r.width*.25?Math.sign(dx):0,sy=Math.abs(dy)>r.height*.25?Math.sign(dy):0;
  const direction=sx+','+sy,now=performance.now();
  if(!sx&&!sy){prev='';return}
  // Deliberately restrained: 1 source pixel per 260 ms, with a larger dead zone.
  if(S.tool==='edit'&&S.view!=='preview'&&(direction!==prev||now-last>=260)){
   if(rectInView()){remember();updateRect(sx*S.nudge,sy*S.nudge,S.handle)}
   prev=direction;last=now;
  }
  if(S.tool==='pan'&&(direction!==prev||now-last>=120)){
   const stage=$('regionUvStage');stage.scrollLeft+=sx*7;stage.scrollTop+=sy*7;
   prev=direction;last=now;
  }
  e.preventDefault();
 });
 const stop=e=>{if(id===e.pointerId){id=null;prev='';stick.style.transform='translate(0,0)'}};
 joy.addEventListener('pointerup',stop);joy.addEventListener('pointercancel',stop);
}
function islandKey(){return 'mts_uv_islands_v1:'+(S.meta?.path||'unknown')}
function savedIslands(){
 let raw;try{raw=JSON.parse(localStorage.getItem(islandKey())||'null')}catch{}
 const w=S.base.width,h=S.base.height,oldW=Number(raw?.width)||Number(S.meta.w)||w,oldH=Number(raw?.height)||Number(S.meta.h)||h;
 S.islands=(Array.isArray(raw?.islands)?raw.islands:[]).map((a,i)=>({id:a.id||'island_'+i,rects:oldW===w&&oldH===h?normalizedRects(a.rects||[],w,h):scaleSavedRects(a.rects||[],oldW,oldH,w,h)}));
 S.index=S.islands.length?0:-1;showIslandChoices();
}
function renderIslandThumbnail(canvas,island){
 const ctx=canvas.getContext('2d');
 canvas.width=72;canvas.height=72;ctx.clearRect(0,0,72,72);
 const rects=normalizedRects(island.rects||[],S.base.width,S.base.height);
 if(!rects.length)return;
 const left=Math.min(...rects.map(r=>r.x)),top=Math.min(...rects.map(r=>r.y));
 const right=Math.max(...rects.map(r=>r.x+r.w)),bottom=Math.max(...rects.map(r=>r.y+r.h));
 const scale=Math.min(64/Math.max(1,right-left),64/Math.max(1,bottom-top));
 const x0=(72-(right-left)*scale)/2,y0=(72-(bottom-top)*scale)/2;
 ctx.imageSmoothingEnabled=false;
 // Only the saved source UV rectangles are drawn. No background or irrelevant islands.
 for(const r of rects){
  ctx.drawImage(S.base,r.x,r.y,r.w,r.h,x0+(r.x-left)*scale,y0+(r.y-top)*scale,r.w*scale,r.h*scale);
 }
}
function showIslandChoices(){
 const gallery=$('regionUvIslandGallery');if(!gallery)return;
 gallery.replaceChildren();
 const total=$('regionUvIslandCount');if(total)total.textContent=String(S.islands.length);
 S.islands.forEach((a,i)=>{
  const card=document.createElement('button');
  card.type='button';card.className='regionUvIslandCard'+(S.index===i?' selected':'');
  card.dataset.regionIsland=String(i);card.setAttribute('aria-pressed',String(S.index===i));
  card.setAttribute('aria-label','Ada '+(i+1)+', '+(a.rects?.length||0)+' alan');
  const thumb=document.createElement('canvas');thumb.className='regionUvIslandThumb';
  renderIslandThumbnail(thumb,a);
  const name=document.createElement('strong');name.textContent='Ada '+(i+1);
  const count=document.createElement('small');count.textContent=(a.rects?.length||0)?a.rects.length+' alan':'Boş';
  card.append(thumb,name,count);gallery.append(card);
 });
 if(!S.islands.length){const empty=document.createElement('span');empty.className='regionUvIslandEmpty';empty.textContent='Henüz kayıtlı ada yok';gallery.append(empty)}
 draw();
}
function persistIslands(){
 try{localStorage.setItem(islandKey(),JSON.stringify({v:1,width:S.base.width,height:S.base.height,updatedAt:Date.now(),islands:S.islands}))}
 catch(e){hint('Ada kaydı yapılamadı: '+e.message)}
 showIslandChoices();
}
function newIsland(){
 remember();S.editingIsland=false;
 S.islands.push({id:'island_'+Date.now().toString(36),rects:[]});S.index=S.islands.length-1;
 S.scope=null;clearPreview();persistIslands();
}
function addArea(){
 remember();
 if(!S.rect)return toast('Önce aktif UV üzerinde alan çiz');
 if(S.index<0)newIsland();
 const island=S.islands[S.index];island.rects=normalizedRects([...island.rects,S.rect],S.base.width,S.base.height);
 persistIslands();hint('Seçim adaya eklendi');
}
function useIsland(){
 const a=S.islands[S.index];if(!a?.rects?.length)return toast('Bu adada kayıtlı alan yok');
 remember();S.scope=normalizedRects(a.rects,S.base.width,S.base.height);
 S.editingIsland=S.scope.length===1;S.rect=clone(S.scope[0]);
 clearPreview();view('active');hint(S.scope.length+' kayıtlı UV alanı hedef seçildi');
}
function removeIsland(){
 if(S.index<0)return;
 remember();S.editingIsland=false;
 S.islands.splice(S.index,1);S.index=Math.min(S.index,S.islands.length-1);S.scope=null;
 persistIslands();clearPreview();
}
function pickSource(){
 if(!S.sourceRect)return toast('Önce Yüklenen PNG sekmesinde kaynak adayı çiz');
 const r=S.sourceRect;hint('Kaynak ada: '+r.w+'×'+r.h+' px. Birleşimi önizleyebilirsin.');
}
async function loadPng(file){
 if(!file||!S.base)return;
 if(file.type&&!file.type.includes('png')&&!file.name.toLowerCase().endsWith('.png'))return toast('PNG seç');
 const generation=S.epoch,importGeneration=++S.importEpoch;
 try{
  // Source import must be independent of target selection. Users can choose the target afterwards.
  // Invalidate the previous image immediately; never display stale source while decoding.
  S.imported=null;S.sourceRect=null;clearPreview();S.view='uploaded';draw();
  hint('Kaynak yükleniyor: '+file.name);
  const c=await bridge().decodeBlobToCanvas(file);
  if(generation!==S.epoch||importGeneration!==S.importEpoch)return;
  S.imported=c;S.sourceRect=null;clearPreview();setTool('edit');setHandle('move');
  view('uploaded');
  hint('Kaynak PNG: '+file.name+' ('+c.width+'×'+c.height+'). Yüklenen PNG üzerinde değiştirmek istediğin kaynak adayı parmağınla seç. Bütün PNG otomatik eşlenmez.');
 }catch(e){if(generation===S.epoch&&importGeneration===S.importEpoch)toast('PNG açılamadı: '+e.message)}
}
function merged(){
 if(!S.base||!S.imported)return toast('Önce PNG yükle');
 if(!S.sourceRect)return toast('Yüklenen PNG üzerinde kaynak adayı seç');
 try{
  const r=compositeRegion(image(S.base),image(S.imported),targetRects(),{
   sourceRect:S.sourceRect,mode:'region',
   dx:Number($('regionUvX').value||0),dy:Number($('regionUvY').value||0),
   scale:Number($('regionUvScale').value||1)
  });
  S.preview=makeCanvas(r.image);$('regionUvSave').disabled=r.changed===0;
  view('preview');hint('Birleşim hazır · '+r.changed+' piksel güncellendi. Seçim dışı ve alfa aynı.');
 }catch(e){clearPreview();toast('Eşleme başarısız: '+e.message)}
}
function download(blob,name){
 const url=URL.createObjectURL(blob),a=document.createElement('a');
 a.href=url;a.download=name;a.style.display='none';document.body.appendChild(a);a.click();a.remove();
 setTimeout(()=>URL.revokeObjectURL(url),3000);
}
async function exportRegion(){
 if(!S.base)return;
 try{
  const patch=extractRegion(image(S.base),targetRects()),blob=await bridge().canvasPngBlob(makeCanvas(patch.image));
  download(blob,(S.meta.name||'entity').replace(/\.png$/i,'')+'_region.png');
  localStorage.setItem('mts_uv_region_export_v1:'+S.meta.path,JSON.stringify({version:1,sourceW:S.base.width,sourceH:S.base.height,rects:patch.rects}));
  hint('Seçim PNG indirildi: '+patch.image.width+'×'+patch.image.height);
 }catch(e){toast('PNG çıkarılamadı: '+e.message)}
}
async function exportWhole(){
 if(!S.preview)return toast('Önce birleşimi önizle');
 download(await bridge().canvasPngBlob(S.preview),(S.meta.name||'entity').replace(/\.png$/i,'')+'_region_merged.png');
}
async function save(){
 if(!S.preview||S.busy)return;
 const generation=S.epoch,preview=S.preview,path=S.meta.path;
 S.busy=true;$('regionUvSave').disabled=true;
 try{
  const blob=await bridge().canvasPngBlob(preview);
  const ok=await bridge().saveRestored(path,blob);
  if(!ok)throw Error('Aktif texture kaydedilemedi');
  if(S.epoch!==generation)return;
  S.base=preview;S.preview=null;S.imported=null;S.sourceRect=null;S.scope=null;
  showIslandChoices();view('active');hint('Yalnız hedef UV bölgesi aktif texture’a kaydedildi');
 }catch(e){if(generation===S.epoch){$('regionUvSave').disabled=false;toast(e.message)}}
 finally{S.busy=false}
}
async function preview3d(){
 if(!S.preview)return toast('Önce birleşimi önizle');
 try{
  const viewer=await bridge().ensurePreview3dLoaded?.();
  if(!viewer?.openVariant)throw Error('3D görüntüleyici yüklenemedi');
  const before=await bridge().canvasPngBlob(S.base),after=await bridge().canvasPngBlob(S.preview);
  await viewer.openVariant(S.meta,after,'Bölgesel UV',[{blob:before,name:'Aktif UV'},{blob:after,name:'Bölgesel UV'}],1);
 }catch(e){toast('3D açılamadı: '+e.message)}
}
function buildUI(){
 if($('regionalUvStudio'))return;
 const root=document.createElement('div');root.id='regionalUvStudio';root.className='islandStudio islandRegionRoot';
 root.innerHTML=[
 '<div class="islandStudioTop"><button class="btn" id="regionUvClose">←</button><b>Bölgesel UV</b><select class="select" id="regionUvTexture"></select></div>',
 '<div class="islandStudioTabs regionUvTabs"><button class="btn primary" data-region-view="active">Aktif UV · Hedef</button><button class="btn" data-region-view="uploaded">Yüklenen · Kaynak</button><button class="btn" data-region-view="preview">Birleşim</button><span class="stat" id="regionUvScope"></span></div>',
 '<div class="islandStudioStatus" id="regionUvStatus">UV üzerinde hedefi seç.</div>',
 '<div class="regionUvHistory"><button class="btn" id="regionUvUndo" disabled>↶ Geri al</button><button class="btn" id="regionUvRedo" disabled>↷ İleri al</button></div>',
 '<div class="regionUvZoomBar"><span>Yakınlaştır</span><input id="regionUvZoom" type="range" min="1" max="12" step=".5" value="1"><strong id="regionUvZoomValue">1×</strong></div>',
 '<div class="regionUvViewport"><div class="regionUvModeRail"><button class="btn" data-region-tool="pan" type="button">Pan</button><button class="btn primary" data-region-tool="edit" type="button">Edit</button></div>',
 '<div class="islandStudioStage" id="regionUvStage"><div class="regionUvFrame" id="regionUvFrame"><canvas id="regionUvCanvas"></canvas><canvas class="regionUvOverlay" id="regionUvOverlay"></canvas><div class="islandStudioSelection" id="regionUvSelection"></div></div></div></div>',
 '<div class="regionUvFixedControls"><div class="regionUvControlRow"><div class="islandJoystick" id="regionUvJoystick"><div class="islandStick" id="regionUvStick"></div></div><div class="regionUvNodePad" role="group" aria-label="Hareket ettirilecek nokta"><button type="button" data-region-handle-choice="tl" aria-label="Sol üst" aria-pressed="false"></button><button type="button" data-region-handle-choice="tr" aria-label="Sağ üst" aria-pressed="false"></button><button type="button" data-region-handle-choice="move" class="active" aria-label="Tüm seçimi taşı" aria-pressed="true"></button><button type="button" data-region-handle-choice="bl" aria-label="Sol alt" aria-pressed="false"></button><button type="button" data-region-handle-choice="br" aria-label="Sağ alt" aria-pressed="false"></button></div><div class="regionUvStepPicker" role="group" aria-label="Joystick hareket adımı"><button type="button" class="active" data-region-step="1" aria-pressed="true">1</button><button type="button" data-region-step="2" aria-pressed="false">2</button><button type="button" data-region-step="4" aria-pressed="false">4</button><button type="button" data-region-step="8" aria-pressed="false">8</button><span>px</span></div></div><span class="stat" id="regionUvHandleStatus">Tüm seçim · 1 px / adım</span></div>',
 '<details class="regionUvSaved"><summary>Kayıtlı adalar <span class="regionUvIslandCount" id="regionUvIslandCount">0</span></summary><div class="regionUvIslandGallery" id="regionUvIslandGallery" aria-label="Kayıtlı UV adaları"></div><div class="regionUvSavedRow"><button class="btn" id="regionUvAddIsland">+ Ada</button><button class="btn" id="regionUvAdd">Seçimi ekle</button><button class="btn danger" id="regionUvDel">Seçileni sil</button><span class="stat" id="regionUvMeta"></span></div></details>',
 '<details class="regionUvAdvanced"><summary>İnce eşleme</summary><div class="regionUvOptions"><label>X <input type="number" id="regionUvX" step="1" value="0"></label><label>Y <input type="number" id="regionUvY" step="1" value="0"></label><label>Ölçek <input type="number" id="regionUvScale" min=".1" max="20" step=".05" value="1"></label></div></details>',
 '<div class="islandStudioTools regionUvActions"><button class="btn" id="regionUvExport">Hedef PNG indir</button><button class="btn primary" id="regionUvImport">PNG yükle</button><button class="btn primary" id="regionUvPreview">Birleşimi göster</button><button class="btn" id="regionUv3D">3D</button><button class="btn" id="regionUvFull">Tam PNG</button><button class="btn primary" id="regionUvSave" disabled>✓ Kaydet</button><input id="regionUvFile" type="file" accept="image/png" hidden></div>'
 ].join('');
 document.body.append(root);
 const stylesheet=document.createElement('link');stylesheet.rel='stylesheet';stylesheet.href='css/island-region-studio.css?v=20261009-nodepad1';document.head.append(stylesheet);
 initSelection();initJoystick();
 $('regionUvZoom').addEventListener('input',e=>zoom(e.target.value));
 root.addEventListener('click',e=>{
  const b=e.target.closest('button');if(!b)return;
  if(b.id==='regionUvClose')root.classList.remove('open');
  if(b.dataset.regionTool)setTool(b.dataset.regionTool);
  if(b.dataset.regionView)view(b.dataset.regionView);
  if(b.dataset.regionStep)setNudge(b.dataset.regionStep);
  if(b.dataset.regionHandleChoice)setHandle(b.dataset.regionHandleChoice);
  if(b.dataset.regionIsland!==undefined){S.index=Number(b.dataset.regionIsland);if(S.islands[S.index]?.rects?.length)useIsland();else{S.scope=null;clearPreview();hint('Ada '+(S.index+1)+' boş; bir alan ekle')}showIslandChoices()}
  if(b.id==='regionUvUndo')travel('undo');
  if(b.id==='regionUvRedo')travel('redo');
  if(b.id==='regionUvAddIsland')newIsland();
  if(b.id==='regionUvAdd')addArea();
  if(b.id==='regionUvDel')removeIsland();
  if(b.id==='regionUvImport')$('regionUvFile').click();
  if(b.id==='regionUvPreview')merged();
  if(b.id==='regionUvExport')exportRegion();
  if(b.id==='regionUvFull')exportWhole();
  if(b.id==='regionUvSave')save();
  if(b.id==='regionUv3D')preview3d();
 });
 $('regionUvFile').addEventListener('change',e=>{const f=e.target.files?.[0];e.target.value='';if(f)loadPng(f)});
 ['regionUvX','regionUvY','regionUvScale'].forEach(id=>$(id).addEventListener('change',()=>{if(S.preview)clearPreview();if(S.imported&&S.sourceRect)merged()}));
 $('regionUvTexture').addEventListener('change',e=>choose(e.target.value));
 if(typeof ResizeObserver!=='undefined')new ResizeObserver(()=>{if(root.classList.contains('open'))draw()}).observe($('regionUvFrame'));
}
async function choose(path){
 const generation=++S.epoch,meta=bridge().catalog?.().find(x=>x.path===path);
 if(!meta)return;
 S.importEpoch++;
 S.undo=[];S.redo=[];S.editingIsland=false;historyButtons();
 S.meta=meta;S.base=null;S.imported=null;S.preview=null;S.rect=null;S.sourceRect=null;S.scope=null;
 try{
  const edit=await legacy().getEdit?.(path);
  const blob=edit?.blob||await bridge().originalBlob(path);
  const c=await bridge().decodeBlobToCanvas(blob);if(generation!==S.epoch)return;
  S.base=c;
  savedIslands();
  setTool('edit');setHandle('move');view('active');zoom(1);
  let stored=1;try{stored=Number(localStorage.getItem('mts_uv_joystick_step_v1'))||1}catch{}setNudge([1,2,4,8].includes(stored)?stored:1);
  clearPreview();
  hint(meta.name+' · aktif '+c.width+'×'+c.height+' · Edit ile hedef UV alanını çiz');
 }catch(e){toast('UV açılamadı: '+e.message)}
}
export async function open(path){
 buildUI();const records=(bridge().catalog?.()||[]).filter(x=>legacy().assetTypeOf?.(x)==='Entity');
 const picker=$('regionUvTexture');picker.innerHTML='';
 records.forEach(x=>{const el=document.createElement('option');el.value=x.path;el.textContent=x.name;picker.add(el)});
 if(path&&records.some(x=>x.path===path))picker.value=path;
 $('regionalUvStudio').classList.add('open');if(picker.value)await choose(picker.value);
 return true;
}
