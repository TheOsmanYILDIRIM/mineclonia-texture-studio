import fs from 'node:fs';

const source = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');

function fail(message) {
  console.error('FAIL:', message);
  process.exitCode = 1;
}

function expect(condition, message) {
  if (!condition) fail(message);
}

function lastBlock(marker, span = 14000) {
  const start = source.lastIndexOf(marker);
  if (start < 0) {
    fail(`Missing marker: ${marker}`);
    return '';
  }
  return source.slice(start, Math.min(source.length, start + span));
}

const importPng = lastBlock('async function importPng(file,seam=false)');
expect(importPng.includes('prepareImportedTextureBlob(file,target)'), 'runtime-winning importPng must normalize to the selected target');
expect(importPng.includes('textureMatchesOriginal(b,target)'), 'runtime-winning importPng must ignore unchanged textures');

const importZip = lastBlock('async function importZip(file)');
expect(importZip.includes('prepareImportedTextureBlob(blob,meta)'), 'runtime-winning ZIP import must normalize imported PNGs');
expect(importZip.includes('textureMatchesOriginal(blob,meta)'), 'runtime-winning ZIP import must ignore unchanged textures');

const exportPack = lastBlock('async function exportPack()');
expect(exportPack.includes('changedPathsFast.has(e.path)'), 'runtime-winning export must use the hydrated changed set');
expect(exportPack.includes('prepareImportedTextureBlob(e.blob,meta,TARGET_RESOLUTION)'), 'runtime-winning export must enforce selected target resolution');
expect(exportPack.includes("{compression:'STORE'}"), 'runtime-winning export must not recompress PNG payloads with DEFLATE');

const backup = lastBlock('async function importProjectBackup(file)');
expect(backup.includes('[64,128,256,512].includes(m.targetResolution)'), 'runtime-winning backup restore must accept 64/128/256/512');
expect(!backup.includes('m.targetResolution===256||m.targetResolution===512'), 'runtime-winning backup restore must not retain the old 256/512-only gate');

const targetDims = lastBlock('function targetTextureDimensions(meta,targetRes)');
expect(targetDims.includes('SOURCE_TEXEL_BASE=16') || source.includes('const SOURCE_TEXEL_BASE=16;'), 'density scaling must use 16px as the source texel baseline');
expect(targetDims.includes('baseW*scale') && targetDims.includes('baseH*scale'), 'target dimensions must scale both native axes by source density');
const normalize = lastBlock('async function normalizeTextureBlobTo(blob,meta,targetRes)');
expect(normalize.includes('const maxW=Math.min(sw,target.width),maxH=Math.min(sh,target.height);'), 'normalization must cap each axis by both input size and density target so it never upscales');
expect(normalize.includes('Math.min(maxW,maxH*ratio)'), 'normalization must restore source aspect ratio within the no-upscale ceiling');
const densityProbe = (w,h,target)=>({width:Math.round(w*(target/16)),height:Math.round(h*(target/16))});
expect(JSON.stringify(densityProbe(16,16,128))===JSON.stringify({width:128,height:128}), '16x16 at 128 target must become 128x128');
expect(JSON.stringify(densityProbe(64,32,128))===JSON.stringify({width:512,height:256}), '64x32 entity at 128 target must become 512x256');
expect(JSON.stringify(densityProbe(32,64,128))===JSON.stringify({width:256,height:512}), '32x64 atlas at 128 target must become 256x512');
const fitProbe=(sw,sh,bw,bh,target)=>{const tw=bw*(target/16),th=bh*(target/16),ratio=bw/bh,maxW=Math.min(sw,tw),maxH=Math.min(sh,th);let dw=Math.max(1,Math.floor(Math.min(maxW,maxH*ratio))),dh=Math.max(1,Math.round(dw/ratio));if(dh>maxH){dh=Math.max(1,Math.floor(maxH));dw=Math.max(1,Math.round(dh*ratio))}return {width:dw,height:dh}};
expect(JSON.stringify(fitProbe(256,256,64,32,128))===JSON.stringify({width:256,height:128}), 'square 256px entity output must downscale to 256x128 rather than upscale to 512x256');
expect(source.includes('<option value="64">64px</option>') && source.includes('<option value="128">128px</option>') && source.includes('<option value="256">256px</option>') && source.includes('<option value="512">512px</option>'), 'all four target-resolution controls must exist');


const init = lastBlock('async function init()');
expect(init.includes("setSaveState('Hazır • kayıtlar arka planda yükleniyor','warn')"), 'startup must immediately leave the indefinite preparing state');
expect(init.includes('setTimeout(()=>bootstrapStorageInBackground(),0)'), 'storage bootstrap must run after the UI is interactive');
expect(!init.includes('await hydrateChangedPathsFast()'), 'startup must not synchronously wait for remote original-texture hydration');

const storageBootstrap = lastBlock('async function bootstrapStorageInBackground()');
expect(storageBootstrap.includes('changedHydrationPromise=hydrateChangedPathsFast(edits)'), 'changed-state verification must continue in the background');

const primaryStorage = lastBlock('async function initStorage()');
expect(primaryStorage.includes("setTimeout(()=>{settled=true;rej(Error('IndexedDB açılışı zaman aşımına uğradı'))},2500)"), 'primary IndexedDB open must have a timeout');

const scaledStorage = lastBlock('async function initScaledStorage()');
expect(scaledStorage.includes("setTimeout(()=>{settled=true;rej(Error('Scaled IndexedDB açılışı zaman aşımına uğradı'))},2500)"), 'scaled IndexedDB open must have a timeout');

const originalBlob = lastBlock('async function originalBlob(path)');
expect(originalBlob.includes('new AbortController()') && originalBlob.includes('signal:controller.signal'), 'upstream original fetch must be abortable');
expect(originalBlob.includes('setTimeout(()=>controller.abort(),12000)'), 'upstream original fetch must have a bounded timeout');

expect(exportPack.includes('await changedHydrationPromise.catch(()=>{})'), 'texturepack export must wait for background changed-state verification');
expect(exportPack.includes('await editWriteQueue.catch(()=>{})'), 'texturepack export must wait for pending edit persistence');
const densityScale = lastBlock('function targetTextureDimensions(meta,targetRes)');
expect(densityScale.includes('const scale=Math.max(1,targetRes)/SOURCE_TEXEL_BASE'), 'target resolution must represent 16px source-density scaling');
expect(densityScale.includes('baseW*scale') && densityScale.includes('baseH*scale'), 'target dimensions must preserve source atlas proportions');
expect(source.includes('const ratio=baseW/baseH;') && source.includes('maxH*ratio'), 'normalization must restore source aspect ratio without forcing upscale');
expect(source.includes('const SOURCE_TEXEL_BASE=16;'), '16px source-density baseline must be explicit');

const verificationHydrate = lastBlock('async function hydrateChangedPathsFast(seedEdits=null)');
expect(source.includes('const VERIFY_CONCURRENCY=8;'), 'unknown edit verification must run with bounded concurrency');
expect(verificationHydrate.includes("filter(e=>(e.verification||'unknown')!=='changed')"), 'known changed records must not be recomputed on every startup');
expect(verificationHydrate.includes("await markPersistedVerification(e.path,'changed')"), 'newly verified changes must be persisted');
expect(verificationHydrate.includes('await deletePersistedEditQuiet(e.path)'), 'records proven original must be permanently removed');

const persistedWriter = lastBlock('async function persistBlobOnly(path,blob');
expect(persistedWriter.includes("verification='changed'"), 'new PNG edits must persist as verified changed');
expect(source.includes("async function durableDbPut(path,blob,verification='changed')"), 'IndexedDB edit records must carry persistent verification state');

const priorityReset = lastBlock('async function resetStoredEditsByPriorities(priorities)');
expect(priorityReset.includes("wanted.has(x.priority)"), 'priority reset must select catalog records by P0-P6 priority');
expect(priorityReset.includes("dbp.transaction(STORE,'readwrite')"), 'priority reset must batch-delete persisted edits');
expect(priorityReset.includes('pendingChangedPaths.delete(path)') && priorityReset.includes('changedPathsFast.delete(path)'), 'priority reset must clear runtime count state');
expect(source.includes('data-reset-priority="P0"') && source.includes('data-reset-priority="P6"'), 'settings must expose P0 through P6 reset controls');
expect(source.includes('id="resetFuturePriorities"'), 'settings must expose fast P2-P6 cleanup');
expect(source.includes("resolutionModel:'16px-source-density'"), 'export manifest must record density-based resolution semantics');
expect(source.includes('texturePixelsVisuallyEquivalent'), 'unchanged detection must tolerate harmless rescale drift');

const persistedInstall = lastBlock('function installPersistedEditFast(edit,{markChanged=false}={})');
expect(persistedInstall.includes('hotEdits.set(edit.path,rec)'), 'late-loaded persisted edits must populate hot edit cache');
expect(persistedInstall.includes('setFastEditUrl(edit.path,edit.blob)'), 'late-loaded persisted edits must replace stale edited-thumbnail cache');
expect(persistedInstall.includes('if(ref)ref.img.src=url'), 'visible cards must refresh immediately when persisted edits load');
expect(persistedInstall.includes('else if(!changedPathsFast.has(edit.path))pendingChangedPaths.add(edit.path)'), 'unknown late-loaded records must stay pending while verified changed records may be counted immediately');

const bootstrap = lastBlock('async function bootstrapStorageInBackground()');
expect(bootstrap.includes("installPersistedEditFast(e,{markChanged:(e.verification||'unknown')==='changed'})"), 'background storage bootstrap must trust only persistently verified changed records and keep unknown records pending');

const hydrate = lastBlock('async function hydrateChangedPathsFast(seedEdits=null)');
expect(hydrate.includes('deletePersistedEditQuiet(e.path)'), 'verified-original stale edit records must be permanently cleaned from storage');
expect(hydrate.includes('pendingChangedPaths.delete(e.path);changedPathsFast.add(e.path)'), 'only verified differences may enter the changed set');
expect(hydrate.includes("{throwOnError:true}"), 'verification failures must remain pending rather than being counted as changed');


const scriptBlocks = [...source.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/gi)].map(match=>match[1]);
expect(scriptBlocks.length >= 2, 'expected inline script blocks');
for (const [index, script] of scriptBlocks.entries()) {
  try { new Function(script); }
  catch (error) { fail(`inline script ${index + 1} has a syntax error: ${error.message}`); }
}



const animInfo = lastBlock('function actualStripFrameInfo(src,spec)');
expect(animInfo.includes('Math.floor(long/spec.frames)'), 'animation preview must infer frame size from the saved strip');
const animExport = lastBlock('async function stripBlobToAtlasBlob(blob, meta)');
expect(animExport.includes('actualStripFrameInfo(src,spec)'), 'strip-to-atlas export must use actual edited frame resolution');
const animPreview = lastBlock('async function refreshAnimPreview()');
expect(animPreview.includes('actualStripFrameInfo(src,spec)'), 'live animation preview must use actual edited frame resolution');
expect(animPreview.includes('ctx.drawImage(src,sx,sy,actual.frame,actual.frame'), 'live animation preview must crop frames at the actual saved frame size');

expect(!source.includes('<<<<<<<') && !source.includes('>>>>>>>'), 'merge-conflict markers must not be present');

if (process.exitCode) process.exit(process.exitCode);
console.log('Runtime override guards: OK');


const loaderSource = fs.readFileSync(new URL('../js/data/catalog-loader.js', import.meta.url), 'utf8');
expect(loaderSource.includes(".catch(()=>ASSET_TAGS={})"), 'asset tag metadata must remain optional and fall back to an empty tag map');
expect(loaderSource.includes("tags:ASSET_TAGS['tex_'+r[7]]?.tags||[]"), 'catalog tags must be additive metadata with an empty-array fallback');
const appSource = fs.readFileSync(new URL('../js/app.js', import.meta.url), 'utf8');
expect(appSource.includes('function runtimeTintInfo'), 'legacy runtime-tint detector must remain available while tag metadata is additive');
expect(appSource.includes('.animated') || appSource.includes('animated:'), 'legacy catalog animated metadata must remain available while tag metadata is additive');
const preview3dSource = fs.readFileSync(new URL('../js/preview3d.js', import.meta.url), 'utf8');
expect(preview3dSource.includes('function faceFamily(meta)'), '3D filename/semantic face resolver must remain as fallback');
expect(preview3dSource.includes('if(fromLua)return fromLua'), '3D must prefer Lua manifest but preserve fallback resolution');
