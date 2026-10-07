(()=>{
'use strict';
const api=()=>window.MTSVariantBridge||{};
const $=id=>document.getElementById(id);
const CATALOG=new Proxy([], {get(_t,p){const a=api().catalog?.()||[];const v=a[p];return typeof v==='function'?v.bind(a):v}});
const toast=msg=>api().toast?.(msg);
const originalBlob=path=>api().originalBlob(path);
const getEdit=path=>api().getEdit(path);
const putEdit=(path,blob)=>api().putEdit(path,blob);
const assetTypeOf=x=>api().assetTypeOf(x);
const runtimeRoleInfo=x=>api().runtimeRoleInfo(x);
const prepareVariantTextureBlob=(f,x)=>api().prepareVariantTextureBlob(f,x);
const lockEntityAlphaToSource=(b,x)=>api().lockEntityAlphaToSource(b,x);
const applyFilter=()=>api().applyFilter();
const activeMeta=()=>api().active?.()||null;
const variantSets=new Map();
let preview3dLoadPromise=null;
let variantTextureId=null,variantSelectedIndex=0,variantTileN=6,variantMixMode=false,variantSources=[];
function variantSelectedMeta(){return CATALOG.find(x=>x.id===variantTextureId)||null}
function variantUserList(){if(!variantTextureId)return[];if(!variantSets.has(variantTextureId))variantSets.set(variantTextureId,[]);return variantSets.get(variantTextureId)}
function variantList(){return [...variantSources,...variantUserList()]}
async function refreshVariantSources(){
 const x=variantSelectedMeta();variantSources=[];if(!x)return;
 const orig=await originalBlob(x.path),edit=await getEdit(x.path);
 variantSources.push({blob:orig,name:'Orijinal',enabled:true,url:null,system:true,kind:'original'});
 variantSources.push({blob:edit?.blob||orig,name:'Aktif',enabled:true,url:null,system:true,kind:'active'});
}
function variantUrl(rec){if(!rec.url)rec.url=URL.createObjectURL(rec.blob);return rec.url}
function variantEnabled(){return variantList().filter(v=>v.enabled!==false)}
function variantMixIndex(i,n){let x=(i+1)*1103515245+12345;x=(x^(x>>>16))>>>0;return n?x%n:0}
function renderVariantThumbs(){
 const strip=$('variantThumbStrip'),list=variantList();
 strip.innerHTML='';
 if(!list.length){strip.innerHTML='<div class="stat" style="padding:12px 2px">Galeriden birden fazla PNG seçebilirsin.</div>';return}
 list.forEach((rec,i)=>{
   const b=document.createElement('button');b.className='variantThumb'+(!variantMixMode&&i===variantSelectedIndex?' selected':'')+(rec.enabled===false?' off':'');b.dataset.variantIndex=String(i);b.title=rec.name;
   const im=document.createElement('img');im.src=variantUrl(rec);im.alt=rec.name;
   const nm=document.createElement('span');nm.className='variantThumbName';nm.textContent=rec.name.replace(/\.png$/i,'');
   b.append(im,nm);strip.appendChild(b);
 });
}
function renderVariantStage(){
 const stage=$('variantStage'),list=variantList(),enabled=variantEnabled();
 stage.innerHTML='';stage.style.backgroundImage='none';stage.style.backgroundSize='auto';stage.style.gridTemplateColumns='';stage.style.gridTemplateRows='';stage.classList.remove('single');
 document.querySelectorAll('[data-vtile]').forEach(b=>b.classList.toggle('active',Number(b.dataset.vtile)===variantTileN));
 $('variantMixToggle').classList.toggle('active',variantMixMode);
 const selected=list[variantSelectedIndex]||null;
 $('activateSelectedVariant').disabled=!selected||variantMixMode||!!selected.system;
 if(!list.length){stage.classList.add('single');stage.innerHTML='<div class="variantNone">PNG ekleyerek varyantları karşılaştır.</div>';$('variantStatus').textContent='';return}
 if(variantMixMode){
   if(!enabled.length){stage.classList.add('single');stage.innerHTML='<div class="variantNone">Tüm varyantlar kapalı. Üstteki thumbnail’lere dokunup geri açabilirsin.</div>';$('variantStatus').textContent='0 aktif varyant';return}
   const n=Math.max(variantTileN,1),cells=n*n;stage.style.gridTemplateColumns=`repeat(${n},1fr)`;stage.style.gridTemplateRows=`repeat(${n},1fr)`;
   for(let i=0;i<cells;i++){const rec=enabled[variantMixIndex(i,enabled.length)],cell=document.createElement('div');cell.className='variantMixCell';cell.style.backgroundImage=`url("${variantUrl(rec)}")`;cell.title=rec.name;stage.appendChild(cell)}
   $('variantStatus').textContent=`Karışık · ${enabled.length}/${list.length} aktif · thumbnail’e dokunarak ele/geri ekle`;
 }else{
   stage.classList.add('single');
   if(!selected){stage.innerHTML='<div class="variantNone">Bir varyant seç.</div>';return}
   const u=variantUrl(selected);
   if(variantTileN===1){const im=document.createElement('img');im.src=u;im.alt=selected.name;stage.appendChild(im)}
   else{stage.style.backgroundImage=`url("${u}")`;stage.style.backgroundSize=`${100/variantTileN}% ${100/variantTileN}%`}
   $('variantStatus').textContent=`${variantSelectedIndex+1}/${list.length} · ${selected.name}`;
 }
}
async function ensurePreview3dLoaded(){
 if(window.MTSPreview3D)return window.MTSPreview3D;
 if(!preview3dLoadPromise)preview3dLoadPromise=new Promise((resolve,reject)=>{const s=document.createElement('script');s.src='js/preview3d.js?v=20261006-joystick1';s.async=true;s.onload=resolve;s.onerror=()=>reject(Error('3D önizleme modülü yüklenemedi'));document.body.appendChild(s)});
 await preview3dLoadPromise;return window.MTSPreview3D;
}
function updateVariant3dButton(){
 const x=variantSelectedMeta(),b=$('variant3dToggle');if(!b)return;
 const entity=assetTypeOf(x)==='Entity',hasModel=!!String(runtimeRoleInfo?.(x)?.model||'').match(/\.b3d/i);
 const eligible=entity&&hasModel;b.style.display=eligible?'':'none';b.disabled=!eligible||variantMixMode||!variantList()[variantSelectedIndex];const ub=$('variantUvManual'),rec=variantList()[variantSelectedIndex];if(ub){ub.style.display=entity?'':'none';ub.disabled=!entity||variantMixMode||!rec;}
}
function renderVariantLab(){
 const x=variantSelectedMeta();if(!x)return;
 const list=variantList(),enabled=variantEnabled(),user=variantUserList();
 $('variantMeta').textContent=`${x.name} · ${user.length} varyant${variantMixMode?` · ${enabled.length} aktif`:''}`;
 renderVariantThumbs();renderVariantStage();updateVariant3dButton();
}
async function populateVariantTextureSelect(){
 const sel=$('variantTexture');if(sel.dataset.ready)return;
 sel.innerHTML=CATALOG.map(x=>`<option value="${x.id}">${x.priority} · ${x.name}</option>`).join('');
 sel.dataset.ready='1';sel.onchange=async()=>{variantTextureId=sel.value;variantSelectedIndex=0;variantMixMode=false;await refreshVariantSources();renderVariantLab()};
}
async function openVariantLabFor(meta){
 bindVariantLabUi();await populateVariantTextureSelect();
 const chosen=meta||activeMeta()||CATALOG[0];variantTextureId=chosen.id;$('variantTexture').value=chosen.id;
 await refreshVariantSources();$('variantLab').classList.add('open');renderVariantLab();
}
async function addVariantFiles(files){
 const x=variantSelectedMeta();if(!x||!files?.length)return;
 const list=variantUserList();let added=0;
 for(const file of files){
   if(!file.type.includes('png')&&!/\.png$/i.test(file.name))continue;
   try{const blob=await prepareVariantTextureBlob(file,x);list.push({blob,name:file.name,enabled:true,url:null,addedAt:Date.now(),rawAlpha:true});added++}catch(err){console.warn('Varyant PNG alınamadı',file.name,err)}
 }
 if(added){variantSelectedIndex=variantSources.length+Math.max(0,list.length-added);renderVariantLab();toast(`${added} varyant eklendi`)}
}
async function activateSelectedVariant(){
 const x=variantSelectedMeta(),rec=variantList()[variantSelectedIndex];if(!x||!rec||variantMixMode)return;
 const committed=assetTypeOf(x)==='Entity'?await lockEntityAlphaToSource(rec.blob,x):rec.blob;await putEdit(x.path,committed);api().markChanged?.(x.path);await refreshVariantSources();variantSelectedIndex=1;await applyFilter();renderVariantLab();toast('Seçili varyant ana texture olarak kaydedildi');
}




function bindVariantLabUi(){
 const root=$('variantLab');if(!root||root.dataset.delegateBound==='1')return;root.dataset.delegateBound='1';
 root.addEventListener('click',async e=>{
   const t=e.target.closest('button,[data-variant-index],[data-vtile]');if(!t)return;
   if(t.id==='closeVariantLab'){root.classList.remove('open');return}
   if(t.id==='addVariantPngs'){e.preventDefault();$('variantFiles')?.click();return}
   if(t.id==='activateSelectedVariant'){await activateSelectedVariant();return}
   if(t.id==='variantMixToggle'){variantMixMode=!variantMixMode;renderVariantLab();return}
   if(t.id==='variantUvManual'){if(window.MTSVertexUvStudio?.open)await window.MTSVertexUvStudio.open();else toast('Vertex UV Studio yüklenemedi');return}
   if(t.id==='variant3dToggle'){const x=variantSelectedMeta(),rec=variantList()[variantSelectedIndex];if(!x||!rec||variantMixMode)return;try{const p=await ensurePreview3dLoaded();await p?.openVariant?.(x,rec.blob,rec.name,variantList(),variantSelectedIndex)}catch(err){console.error(err);toast(err?.message||'3D varyant önizleme açılamadı')}return}
   if(t.dataset.vtile){variantTileN=Number(t.dataset.vtile);renderVariantStage();return}
   if(t.dataset.variantIndex!=null){const idx=Number(t.dataset.variantIndex);if(variantMixMode){const rec=variantList()[idx];if(rec&&!rec.system){rec.enabled=rec.enabled===false;renderVariantLab()}}else{variantSelectedIndex=idx;renderVariantLab()}}
 });
 const files=$('variantFiles');if(files)files.addEventListener('change',async e=>{await addVariantFiles([...e.target.files]);e.target.value=''});
}
window.MTSVariantLab={open:openVariantLabFor,selectedMeta:variantSelectedMeta,list:variantList,render:renderVariantLab,selectedIndex:()=>variantSelectedIndex,userList:variantUserList,sourcesLength:()=>variantSources.length,saveUvVariant:async(meta,rec,blob)=>{const list=variantUserList();list.push({blob,name:(rec?.name||'varyant').replace(/\.png$/i,'')+'_UV_FIXED.png',enabled:true,url:null,addedAt:Date.now(),rawAlpha:true,uvFixed:true});variantSelectedIndex=variantSources.length+list.length-1;renderVariantLab()}};
const __bindVariant=()=>{try{bindVariantLabUi()}catch(e){console.error('Variant Lab bind',e)}};if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',__bindVariant,{once:true});else __bindVariant();
})();
