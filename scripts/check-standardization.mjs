import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const rootDir=fileURLToPath(new URL('..',import.meta.url));
const app=fs.readFileSync(new URL('../js/app.js',import.meta.url),'utf8');
const index=fs.readFileSync(new URL('../index.html',import.meta.url),'utf8');

function fail(msg){console.error('FAIL:',msg);process.exitCode=1}
function expect(cond,msg){if(!cond)fail(msg)}

const coreFns=['allEdits','applyFilter','delEdit','exportPack','getEdit','importPng','importProjectBackup','importZip','normalizeTextureBlob','putEdit','render'];
for(const name of coreFns){
  const re=new RegExp('\\b(?:async\\s+)?function\\s+'+name+'\\s*\\(','g');
  const count=[...app.matchAll(re)].length;
  expect(count===1,`core function ${name} must have exactly one implementation, found ${count}`);
}

expect(app.includes("const DB='MinecloniaTextureStudio', STORE='edits', EDIT_DB_VERSION=1, EDIT_LOCAL_PREFIX='mts:';"),
  'browser edit storage identity must remain backward-compatible');
expect(app.includes("indexedDB.open(DB,EDIT_DB_VERSION)"),'edit IndexedDB must use the stable version constant');
expect(app.includes("k.startsWith(EDIT_LOCAL_PREFIX)"),'legacy localStorage edit records must remain discoverable by stable prefix');
expect(app.includes("o.verification||'unknown'"),'old browser edit records without verification must remain readable');

expect(index.includes('js/prompt-registry.js'),'canonical prompt registry must load before app runtime');
expect(app.includes('const PROMPT_STORE=window.MTSPromptStore'),'app must use the single canonical prompt registry');
for(const forbidden of ['loadCanonicalPromptFamily','ITEM_TWO_PASS_PROMPTS','BLOCK_REFERENCE_PROMPTS','AUTHORED_UV_REFS']){
  expect(!app.includes(forbidden),`legacy prompt runtime path must stay removed: ${forbidden}`);
}

for(const family of ['blocks','mobs','armor','items']){
  const dir=path.join(rootDir,'prompts',family);
  if(!fs.existsSync(dir))continue;
  const files=fs.readdirSync(dir);
  expect(!files.some(f=>f.endsWith('.txt')),`${family}: production .txt prompt files are forbidden`);
  expect(!files.some(f=>/^batch_.*\.json$/i.test(f)),`${family}: production batch prompt files are forbidden`);
  const manifest=JSON.parse(fs.readFileSync(path.join(dir,'manifest.json'),'utf8'));
  expect(manifest.schema_version===2&&manifest.family===family,`${family}: manifest must be canonical schema v2`);
  expect(!manifest.batches?.length,`${family}: manifest batches must remain empty`);
  for(const e of manifest.entries||[]){
    if(e.status!=='done')continue;
    expect(e.file===`prompts/${family}/${e.id}.json`,`${family}: done prompt must use one-file-per-id path ${e.id}`);
  }
}

expect(index.includes('js/uv-repair-router.js'),'UV repair router must be loaded');
expect(app.includes('window.MTSUvRepair?.openIsland?.(path)'),'optional island repair must route through shared UV router');
expect(!index.includes('js/uv-mapper.js'),'removed duplicate UV mapper module must not be reloaded');

if(process.exitCode)process.exit(process.exitCode);
console.log('Standardization guards: OK');
