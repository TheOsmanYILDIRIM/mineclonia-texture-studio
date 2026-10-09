import {createPlan,loadPlan,pack,unpack} from './uv-generation-roundtrip.mjs';
const KEY='mts_uv_grid_export_v1:';
const MAPPING_URL='./tools/uv-pipeline/experiments/cat-connected-net/config/mapping.json';
async function readPng(blob){
 const bitmap=await createImageBitmap(blob);
 try{const canvas=document.createElement('canvas');canvas.width=bitmap.width;canvas.height=bitmap.height;const ctx=canvas.getContext('2d',{willReadFrequently:true});ctx.drawImage(bitmap,0,0);return ctx.getImageData(0,0,canvas.width,canvas.height);}finally{bitmap.close?.();}
}
async function writePng(image){const canvas=document.createElement('canvas');canvas.width=image.width;canvas.height=image.height;canvas.getContext('2d').putImageData(new ImageData(image.data,image.width,image.height),0,0);return new Promise((resolve,reject)=>canvas.toBlob(blob=>blob?resolve(blob):reject(Error('Grid PNG oluşturulamadı')),'image/png'));}
function key(meta){return KEY+meta.path;}
function isCalico(meta,image){return image.width===64 && image.height===32 && /(?:cat.*calico|calico.*cat)/i.test(meta.name||'');}
async function newPlan(image,meta){
 let mapping;
 if(isCalico(meta,image)){const response=await fetch(MAPPING_URL);if(!response.ok)throw Error('Kedi ConnectedNet haritası bulunamadı');mapping=await response.json();}
 return createPlan(image,{scale:24,spacing:48,clearance:8,align:'center',grid:'#ff00ff',matte:'#1c1f27',mapping});
}
async function prepare(meta,sourceBlob){
 if(!meta?.path)throw Error('Texture seçilmedi');
 const source=await readPng(sourceBlob);
 const plan=await newPlan(source,meta);
 return {source,plan};
}
async function exportGrid(meta,sourceBlob){
 const {source,plan}=await prepare(meta,sourceBlob);
 // A successful export is necessary before the manifest is committed.
 const blob=await writePng(pack(source,plan));
 try{localStorage.setItem(key(meta),JSON.stringify(plan.manifest));}catch(error){throw Error('Grid eşleme kaydedilemedi; tarayıcı depolamasını kontrol et: '+error.message);}
 return {blob,name:meta.name.replace(/\.png$/i,'')+'_MTS_UVGRID.png',manifest:plan.manifest};
}
/** Reconcile a model's resized output with the saved grid coordinate system.
 * No crop or stretch: nonmatching aspect ratios are rejected.
 */
function normalizeGeneratedCanvas(image,width,height){
 if(image.width===width&&image.height===height)return {image,resized:false,originalSize:[image.width,image.height]};
 if(image.width*height!==image.height*width)throw Error('AI çıktısının en-boy oranı UV gridinden farklı: '+image.width+'×'+image.height+'. Kırpma veya esnetme yapılmadı.');
 const canvas=document.createElement('canvas');canvas.width=width;canvas.height=height;
 const source=document.createElement('canvas');source.width=image.width;source.height=image.height;
 source.getContext('2d').putImageData(new ImageData(image.data,image.width,image.height),0,0);
 const context=canvas.getContext('2d',{willReadFrequently:true});
 context.imageSmoothingEnabled=true;context.imageSmoothingQuality='high';
 context.drawImage(source,0,0,width,height);
 return {image:context.getImageData(0,0,width,height),resized:true,originalSize:[image.width,image.height]};
}
async function importGrid(meta,sourceBlob,generatedBlob){
 const saved=localStorage.getItem(key(meta));
 if(!saved)throw Error('Bu texture için önce Gridli PNG indir. UV haritası bulunamadı; tahmini kırpma yapılmadı.');
 const source=await readPng(sourceBlob),manifest=JSON.parse(saved);
 const plan=loadPlan(source,manifest),rawGenerated=await readPng(generatedBlob);
 const normalized=normalizeGeneratedCanvas(rawGenerated,manifest.layout_size[0]*manifest.scale,manifest.layout_size[1]*manifest.scale);
 const result=unpack(source,normalized.image,plan,{autoShift:true,maxShift:6,repairMagenta:true,edgeBand:3,repairRadius:6});
 result.report.inputSize=normalized.originalSize;
 result.report.resizedToGrid=normalized.resized;
 result.report.resizeNote=normalized.resized?'AI çıktısı orantılı olarak grid çözünürlüğüne yeniden örneklendi; piksel düzeyinde birebirlik iddiası yok.':'AI çıktı boyutu grid ile aynı.';
 if(result.report.clippedSamples)throw Error('UV dönüşümünde '+result.report.clippedSamples+' piksel taşma bulundu; otomatik kaydetme durduruldu.');
 return {blob:await writePng(result.image),report:result.report};
}
window.MTSDetailUv=Object.freeze({exportGrid,importGrid});
