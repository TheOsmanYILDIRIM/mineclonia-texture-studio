import {createPlan,loadPlan,pack,unpack} from './uv-generation-roundtrip.mjs';

const $=id=>document.getElementById(id);
let original=null,sourceName='texture',plan=null,generated=null,originalFingerprint='',groupOffsets={};
const setStatus=(message,error=false)=>{const el=$('status');el.textContent=message;el.dataset.error=String(error);};
function safeName(s){return String(s||'texture').replace(/\.png$/i,'').replace(/[^\w-]+/g,'_').slice(0,80)||'texture';}
const downloadUrls=new Map();
function downloadBlob(blob,name){const u=URL.createObjectURL(blob);const a=document.createElement('a');a.href=u;a.download=name;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(u),30000);}
async function exportSession(){if(!window.JSZip)throw Error('ZIP modülü yüklenemedi');const p=await ensurePlan();const grid=pack(original,p);const zip=new window.JSZip();zip.file('original.png',await toPng(original));zip.file('grid.png',await toPng(grid));zip.file('mapping.json',JSON.stringify(p.manifest,null,2));downloadBlob(await zip.generateAsync({type:'blob',compression:'DEFLATE'}),`${sourceName}_uv_session.zip`);setStatus('Tek ZIP indirildi. Grid PNG AI üretimi için; aynı ZIP geri yüklemede kullanılabilir.');}
async function importSession(file){if(!window.JSZip)throw Error('ZIP modülü yüklenemedi');const zip=await window.JSZip.loadAsync(file);const orig=zip.file('original.png'),mapping=zip.file('mapping.json');if(!orig||!mapping)throw Error('ZIP içinde original.png ve mapping.json bulunamadı');await setOriginal(await orig.async('blob'),file.name.replace(/_uv_session\.zip$/i,'.png'));await importManifest({text:()=>mapping.async('string')});setStatus('Oturum yüklendi. Şimdi AI çıktısı PNG dosyasını seç.');}

function exposeDownload(id,blob,name){const old=downloadUrls.get(id);if(old)URL.revokeObjectURL(old);const url=URL.createObjectURL(blob);downloadUrls.set(id,url);const a=$(id);a.href=url;a.download=name;a.hidden=false;}
function resetDownloads(){for(const id of ['gridDownload','mapDownload','restoreDownload','reportDownload']){const old=downloadUrls.get(id);if(old)URL.revokeObjectURL(old);downloadUrls.delete(id);$(id).hidden=true;$(id).removeAttribute('href');}}
function makeCanvas(image){const c=document.createElement('canvas');c.width=image.width;c.height=image.height;c.getContext('2d',{willReadFrequently:true}).putImageData(new ImageData(image.data,image.width,image.height),0,0);return c;}
async function toPng(image){return await new Promise((resolve,reject)=>makeCanvas(image).toBlob(b=>b?resolve(b):reject(Error('PNG export failed')),'image/png'));}
function showPreview(image){const preview=$('preview');const g=preview.getContext('2d');preview.width=image.width;preview.height=image.height;g.clearRect(0,0,image.width,image.height);g.putImageData(new ImageData(image.data,image.width,image.height),0,0);$('previewMeta').textContent=`${image.width} × ${image.height} px`;}
async function decode(blob){
 const bitmap=await createImageBitmap(blob);try{const c=document.createElement('canvas');c.width=bitmap.width;c.height=bitmap.height;c.getContext('2d',{willReadFrequently:true}).drawImage(bitmap,0,0);return c.getContext('2d').getImageData(0,0,c.width,c.height);}finally{bitmap.close?.();}
}
async function fingerprint(im){const bytes=await crypto.subtle.digest('SHA-256',new Uint8Array(im.data.buffer,im.data.byteOffset,im.data.byteLength));return Array.from(new Uint8Array(bytes)).map(x=>x.toString(16).padStart(2,'0')).join('');}
async function setOriginal(blob,name){const image=await decode(blob);original=image;sourceName=safeName(name);originalFingerprint=await fingerprint(image);plan=null;generated=null;groupOffsets={};resetDownloads();$('generatedInfo').textContent='AI çıktısı henüz seçilmedi';$('originalInfo').textContent=`${sourceName} — ${image.width} × ${image.height} px`;showPreview(image);setStatus('Orijinal yüklendi. Üretim yerleşimini seçerek grid hazırlayabilirsin.');}
async function loadUpstream(path){
 const parts=path.split('/');if(parts.length!==3||!parts.every(p=>/^[\w.-]+$/.test(p))||!parts[2].toLowerCase().endsWith('.png'))throw Error('Kaynak dosya yolu geçersiz. PNG dosyasını elle seç.');
 const root='https://raw.githubusercontent.com/mark-wiemer/mineclonia/209ec2dc96adbf7f5ba083816d90596492ec53b5/mods';
 const url=`${root}/${encodeURIComponent(parts[0])}/${encodeURIComponent(parts[1])}/textures/${encodeURIComponent(parts[2])}`;
 const r=await fetch(url);if(!r.ok)throw Error('Mineclonia kaynağı alınamadı (HTTP '+r.status+'). Dosya seçebilirsin.');
 await setOriginal(await r.blob(),parts[2]);
}
function fillGroups(){const select=$('groupId');select.textContent='';for(const g of plan.manifest.groups){const o=document.createElement('option');o.value=g.id;o.textContent=g.id;select.append(o);}setGroupOffsetInputs();}
function setGroupOffsetInputs(){const v=groupOffsets[$('groupId').value]??{x:0,y:0};$('groupDx').value=v.x;$('groupDy').value=v.y;}
function createOptions(){return {scale:Number($('scale').value),spacing:Number($('spacing').value),clearance:Number($('clearance').value),align:$('align').value,grid:'#ff00ff',matte:'#1c1f27'};}
async function chooseMapping(){
 if($('align').value!=='cat') return null;
 const url='./tools/uv-pipeline/experiments/cat-connected-net/config/mapping.json';const r=await fetch(url);
 if(!r.ok)throw Error('Kedi ConnectedNet haritası okunamadı');const data=await r.json();
 if(original.width!==64||original.height!==32)throw Error('Kedi ConnectedNet yalnız 64×32 kaynak için doğrulandı');
 return data;
}
async function prepPlan(){if(!original)throw Error('Önce orijinal UV PNG yükle');
 const options=createOptions();options.mapping=await chooseMapping();
 plan=createPlan(original,options);plan.manifest.source_pixel_sha256=originalFingerprint;
 groupOffsets={};fillGroups();return plan;
}
async function ensurePlan(){if(!plan)await prepPlan();if(plan.manifest.source_pixel_sha256 && plan.manifest.source_pixel_sha256!==originalFingerprint)throw Error('Manifest farklı orijinal dokuyla oluşturulmuş');return plan;}
async function makeGrid(){setStatus('UV grid hazırlanıyor…');await new Promise(requestAnimationFrame);const p=await prepPlan();const ready=pack(original,p);showPreview(ready);
 const png=await toPng(ready);exposeDownload('gridDownload',png,`${sourceName}_uv_grid.png`);
 exposeDownload('mapDownload',new Blob([JSON.stringify(p.manifest,null,2)],{type:'application/json'}),`${sourceName}_uv_mapping.json`);
 setStatus(`${ready.width} × ${ready.height} grid hazır. PNG ve eşleme dosyaları hazır; tek ZIP ile de indirebilirsin.`);
}
function showGroupShift(){const id=$('groupId').value;if(!id)return;const x=Number($('groupDx').value),y=Number($('groupDy').value);
 if(!Number.isInteger(x)||!Number.isInteger(y)||Math.abs(x)>12||Math.abs(y)>12)throw Error('Grup kayması ±12 piksel olabilir');groupOffsets[id]={x,y};}
async function doRestore(){if(!original)throw Error('Orijinal UV gerekli');if(!generated)throw Error('Önce AI çıktısını yükle');setStatus('Grid hizalaması ve UV dönüşümü hesaplanıyor…');await new Promise(requestAnimationFrame);
 const p=await ensurePlan();showGroupShift();const restored=unpack(original,generated,p,{autoShift:$('autoShift').checked,manualX:Number($('offsetX').value),manualY:Number($('offsetY').value),maxShift:Number($('maxShift').value),edgeBand:Number($('edgeBand').value),repairRadius:Number($('repairRadius').value),repairMagenta:$('repairMagenta').checked,groupOffsets});
 const output=restored.image;showPreview(output);$('report').textContent=JSON.stringify(restored.report,null,2);$('reportBox').hidden=false;
 exposeDownload('restoreDownload',await toPng(output),`${sourceName}_mineclonia_${output.width}x${output.height}.png`);
 exposeDownload('reportDownload',new Blob([JSON.stringify(restored.report,null,2)],{type:'application/json'}),`${sourceName}_uv_report.json`);
 const r=restored.report;downloadBlob(await toPng(output),`${sourceName}_mineclonia_${output.width}x${output.height}.png`);setStatus(`UV üretildi ve PNG indirildi: ${output.width}×${output.height}. Kayma ${r.appliedShiftPx.x},${r.appliedShiftPx.y}px; kenarda onarılan magenta ${r.borderMagentaRepaired}, eksik numune ${r.clippedSamples}. Sonuç için 3D doğrulama gerekli.`);
}
async function importManifest(file){if(!file)return;const value=JSON.parse(await file.text());if(!original)throw Error('Haritadan önce orijinal PNG yükle');if(value.schema==='mts-uv-generation-v1'){
 if(value.source_pixel_sha256 && value.source_pixel_sha256!==originalFingerprint)throw Error('Harita bu kaynak PNG ile eşleşmiyor (SHA-256)');plan=loadPlan(original,value);plan.manifest.source_pixel_sha256=value.source_pixel_sha256||originalFingerprint;
} else if(value.groups&&value.layout_size) {plan=createPlan(original,{...createOptions(),mapping:value});plan.manifest.source_pixel_sha256=originalFingerprint;
} else throw Error('Bu dosya bir UV haritası değil');
 groupOffsets={};fillGroups();setStatus('UV haritası yüklendi; artık AI çıktısını geri çevirebilirsin.');
}
function wrap(handler){return async e=>{e?.preventDefault?.();try{await handler(e);}catch(err){console.error(err);setStatus(err.message||String(err),true);}};}
$('sourceFile').addEventListener('change',wrap(async e=>{const file=e.target.files?.[0];if(file)await setOriginal(file,file.name);}));
$('generatedFile').addEventListener('change',wrap(async e=>{const file=e.target.files?.[0];if(!file)return;generated=await decode(file);$('generatedInfo').textContent=`${file.name} (${generated.width} × ${generated.height})`;showPreview(generated);setStatus('AI çıktısı yüklendi. UV dönüşümüne hazır.');}));
$('manifestFile').addEventListener('change',wrap(async e=>{const file=e.target.files?.[0];if(file)await importManifest(file);}));
$('sessionFile').addEventListener('change',wrap(async e=>{const file=e.target.files?.[0];if(file)await importSession(file);}));
$('exportSession').addEventListener('click',wrap(exportSession));
$('pack').addEventListener('click',wrap(makeGrid));$('restore').addEventListener('click',wrap(doRestore));
$('groupId').addEventListener('change',setGroupOffsetInputs);
for(const id of ['groupDx','groupDy'])$(id).addEventListener('change',wrap(async ()=>showGroupShift()));
const path=new URLSearchParams(location.search).get('path');if(path){setStatus('Mineclonia orijinali alınıyor…');loadUpstream(path).catch(err=>setStatus(err.message,true));}
