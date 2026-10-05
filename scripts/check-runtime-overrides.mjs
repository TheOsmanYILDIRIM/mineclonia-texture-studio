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

const normalize = lastBlock('async function normalizeTextureBlobTo(blob,meta,targetRes)');
expect(normalize.includes('if(sw<=dw && sh<=dh)return blob'), 'normalization must never upscale textures already within the target');
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

const persistedInstall = lastBlock('function installPersistedEditFast(edit)');
expect(persistedInstall.includes('hotEdits.set(edit.path,rec)'), 'late-loaded persisted edits must populate hot edit cache');
expect(persistedInstall.includes('setFastEditUrl(edit.path,edit.blob)'), 'late-loaded persisted edits must replace stale edited-thumbnail cache');
expect(persistedInstall.includes('updateCardFast(edit.path,url)'), 'visible cards must refresh immediately when persisted edits load');

const bootstrap = lastBlock('async function bootstrapStorageInBackground()');
expect(bootstrap.includes('installPersistedEditFast(e)'), 'background storage bootstrap must install persisted edits into thumbnail cache');

const hydrate = lastBlock('async function hydrateChangedPathsFast(seedEdits=null)');
expect(hydrate.includes("revoke(e.path)"), 'hydration must invalidate edited-thumbnail cache for records proven identical to original');


const scriptBlocks = [...source.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/gi)].map(match=>match[1]);
expect(scriptBlocks.length >= 2, 'expected inline script blocks');
for (const [index, script] of scriptBlocks.entries()) {
  try { new Function(script); }
  catch (error) { fail(`inline script ${index + 1} has a syntax error: ${error.message}`); }
}

expect(!source.includes('<<<<<<<') && !source.includes('>>>>>>>'), 'merge-conflict markers must not be present');

if (process.exitCode) process.exit(process.exitCode);
console.log('Runtime override guards: OK');
