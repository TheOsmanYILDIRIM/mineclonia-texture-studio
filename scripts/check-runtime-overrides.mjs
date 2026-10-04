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

expect(!source.includes('<<<<<<<') && !source.includes('>>>>>>>'), 'merge-conflict markers must not be present');

if (process.exitCode) process.exit(process.exitCode);
console.log('Runtime override guards: OK');
