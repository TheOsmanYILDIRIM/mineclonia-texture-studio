import fs from 'node:fs';

const indexPath='index.html';
let s=fs.readFileSync(indexPath,'utf8');
const must=(cond,msg)=>{if(!cond)throw new Error(msg)};

must(s.includes('const VARIANT_MODES='),'VARIANT_MODES anchor missing');
must(s.includes('id="copyPrompt"'),'copyPrompt missing');
must(s.includes('id="savePrompt"'),'savePrompt missing');

const compactPromptBox='<div class="promptBox"><div class="promptHead"><div><div class="promptTitle">AI üretim</div><div class="promptFamily" id="promptFamily"></div><div class="textureId" id="textureId"></div></div></div><div class="promptBtns"><button class="btn" id="copyPrompt">Ref prompt</button><button class="btn primary" id="savePrompt">Üretim prompt</button><button class="btn" id="creativePromptToggle" style="display:none">Yaratıcı alternatif</button><button class="btn" id="singlePromptJson" style="display:none">Bu prompt JSON</button></div><textarea id="promptText" spellcheck="false" style="display:none"></textarea></div><div class="hint" id="hint">';
const promptBoxRx=/<div class="promptBox"><div class="promptHead">[\s\S]*?<\/div><div class="hint" id="hint">/;
must(promptBoxRx.test(s),'promptBox block not found');
s=s.replace(promptBoxRx,compactPromptBox);

s=s.replace('id="exportP0CreativePrompts">P0 yaratıcı promptları indir</button>','id="exportP0CreativePrompts" style="display:none">P0 yaratıcı promptları indir</button>');

const refSystem=String.raw`
/* P0 REFERENCE-FIRST PROMPT SYSTEM — 2026-10-05 */
const P0_STANDARD_ORIGINAL_REF_PROMPT=`Use Image A as the structural source texture.

Use Image B as the dominant visual reference.

Rebuild Image A using the visual language, material richness, depth, contrast, irregularity, weathering, and overall artistic character of Image B.

Do not copy the composition or exact forms of Image B.
Transfer its visual character only.

Preserve Image A's function as a game texture and its overall structural logic.

SEAM RULE:
Only the literal outermost canvas boundaries of Image A are seam-critical.
Do not treat internal lines, shapes, contours, cracks, or material boundaries as seam constraints.

Keep the interior creatively free.

The final result should clearly remain the same texture type as Image A, but visually belong to the world and material language established by Image B.

Prioritize Image B for style.
Prioritize Image A for structure and function.`;

function p0ReferenceSubject(x){
 const n=String(x?.name||'').toLowerCase().replace(/\.png$/,'');
 const wood=(n.match(/(?:log|wood|plank|leaves?)_(acacia|birch|cherry|dark_oak|jungle|mangrove|oak|pale_oak|spruce)/)||n.match(/(acacia|birch|cherry|dark_oak|jungle|mangrove|oak|pale_oak|spruce)_(?:log|wood|plank|leaves?)/))?.[1];
 const prettyWood=wood?wood.replace(/_/g,' '):'';
 if(/leaves?|foliage/.test(n)) return prettyWood?prettyWood+' foliage':'natural foliage';
 if(/(?:^|_)log(?:_|$)|tree_side|bark/.test(n)) return prettyWood?'the side surface of a '+prettyWood+' tree':'the side surface of an old tree';
 if(/planks?/.test(n)) return prettyWood?prettyWood+' wooden planks':'aged wooden planks';
 if(/cobble/.test(n)) return 'an old cobblestone surface';
 if(/brick/.test(n)) return 'aged masonry and brickwork';
 if(/stone/.test(n)) return 'an old weathered stone surface';
 if(/dirt|soil|mud/.test(n)) return 'a natural earth surface';
 if(/sand/.test(n)) return 'a weathered natural sand surface';
 if(/gravel/.test(n)) return 'a rough gravel surface';
 if(/ore/.test(n)) return 'a mineral-bearing stone surface';
 if(/grass/.test(n)) return 'a natural grass-covered ground surface';
 if(/glass/.test(n)) return 'aged game-world glass material';
 if(/wool/.test(n)) return 'a worn natural wool material';
 const clean=String(x?.name||'texture').replace(/\.png$/i,'').replace(/^(mcl|default|extra)_/i,'').replace(/_/g,' ');
 return 'the material represented by the source texture '+clean;
}
function p0ReferencePromptFor(x){
 const subject=p0ReferenceSubject(x);
 return `Create a visual reference from a grounded dark-fantasy world where materials feel ancient, weathered, tactile, and physically believable.

This world is old, harsh, and deeply shaped by climate, time, decay, growth, use, and survival.

The visual language should feel:
rich in material depth,
organic,
restrained in color,
irregular,
weathered,
and visually distinctive without becoming exaggerated or theatrical.

Nothing should feel sterile, polished, procedural, plastic, or generically realistic.

The style should sit between realism and authored game art:
believable enough to feel physical,
but expressive enough that the material carries a strong artistic identity.

Create a close visual study centered on ${subject} from this world.

Do not follow a checklist of surface details.
Do not mechanically reproduce a real-world photograph.

Interpret freely how this material would naturally exist within this setting.

Let its structure, age, tonal variation, wear, imperfections, layering, and visual character emerge naturally from the world and art direction.

Prioritize:
material presence,
surface depth,
natural variation,
age,
visual richness,
and a cohesive artistic identity.

The result should feel like a definitive visual reference that other materials from the same game world could follow.

No scene narrative is needed.
No characters.
No props.
No text or interface elements.

Focus purely on establishing the material language and artistic identity of this world through this material.`;
}

/* Block semantics come from the app's existing assetTypeOf() classifier, not filename guesses. */
for(const x of CATALOG){
 if(x.priority==='P1'){
   const t=assetTypeOf(x);
   if(t==='Block'||t==='Functional Block')x.priority='P0';
 }
}

const __legacyPromptForP0Ref=promptFor;
promptFor=function(x,mode='classic'){
 if(x&&x.priority==='P0')return {text:p0ReferencePromptFor(x),family:'P0 · Reference-first'};
 return __legacyPromptForP0Ref(x,mode);
};
try{creativeP0PromptFor=()=>null}catch{}
`;
s=s.replace('const VARIANT_MODES=',refSystem+'\n\nconst VARIANT_MODES=');

const uiOverride=String.raw`
/* Compact P0 copy workflow: no prompt textarea, no creative alternative. */
(function installP0ReferenceFirstUi(){
 const copyBtn=$('copyPrompt'),buildBtn=$('savePrompt'),creativeBtn=$('creativePromptToggle'),singleBtn=$('singlePromptJson'),preview=$('promptText'),creativeExport=$('exportP0CreativePrompts');
 const legacyCopy=copyBtn?.onclick,legacySave=buildBtn?.onclick,legacySingle=singleBtn?.onclick;
 function sync(){
   const isP0=!!active&&active.priority==='P0';
   if(copyBtn)copyBtn.textContent=isP0?'Ref prompt':'Kopyala';
   if(buildBtn)buildBtn.textContent=isP0?'Üretim prompt':'Promptu kaydet';
   if(preview)preview.style.display=isP0?'none':'';
   if(creativeBtn)creativeBtn.style.display='none';
   if(singleBtn)singleBtn.style.display=isP0?'none':'';
   if(creativeExport)creativeExport.style.display='none';
 }
 if(copyBtn)copyBtn.onclick=async function(e){
   if(active?.priority==='P0'){
     const t=p0ReferencePromptFor(active);
     try{await navigator.clipboard.writeText(t)}catch{const ta=document.createElement('textarea');ta.value=t;document.body.appendChild(ta);ta.select();document.execCommand('copy');ta.remove()}
     toast('Ref prompt kopyalandı');return;
   }
   return legacyCopy?.call(this,e);
 };
 if(buildBtn)buildBtn.onclick=async function(e){
   if(active?.priority==='P0'){
     try{await navigator.clipboard.writeText(P0_STANDARD_ORIGINAL_REF_PROMPT)}catch{const ta=document.createElement('textarea');ta.value=P0_STANDARD_ORIGINAL_REF_PROMPT;document.body.appendChild(ta);ta.select();document.execCommand('copy');ta.remove()}
     toast('Üretim promptu kopyalandı');return;
   }
   return legacySave?.call(this,e);
 };
 if(singleBtn)singleBtn.onclick=function(e){if(active?.priority==='P0')return;return legacySingle?.call(this,e)};
 const oldRender=typeof renderActivePrompt==='function'?renderActivePrompt:null;
 if(oldRender){
   renderActivePrompt=function(...args){const r=oldRender.apply(this,args);sync();return r};
 }
 sync();
})();
`;
const lastScript=s.lastIndexOf('</script>');
must(lastScript>0,'closing script missing');
s=s.slice(0,lastScript)+uiOverride+'\n'+s.slice(lastScript);

fs.writeFileSync(indexPath,s);

let agents=fs.readFileSync('AGENTS.md','utf8');
agents=agents.replace('- No generic fallback prompt.','- P0 block/material work uses a reference-first two-step system: an asset-specific world/style reference prompt plus one controlled standard Original+Ref production prompt. This is deliberate workflow, not a generic fallback.\n- The former P0 “creative alternative” UI is retired; do not reintroduce it unless explicitly requested.');
fs.writeFileSync('AGENTS.md',agents);

let guide=fs.readFileSync('PROMPT_AUTHORING_GUIDE.md','utf8');
const creativeHeading='## Creative alternative mode — composition reset rule';
const ci=guide.indexOf(creativeHeading);
if(ci>=0)guide=guide.slice(0,ci).trimEnd()+'\n\n';
guide+=`## P0 reference-first workflow — 2026-10-05

P0 block/material textures now use two prompts:

1. **Reference prompt:** world- and art-direction-first. It names only the material/subject and intentionally leaves surface details to the image model so the reference can establish a strong authored visual language.
2. **Standard Original+Ref production prompt:** Image A is the structural source texture; Image B is the dominant visual/style reference. The prompt does not redescribe the material. Only the literal outer canvas boundary is seam-critical; internal contours are not seam constraints.

The former P0 creative-alternative mode is retired.

P1 entries already classified by the app as **Block** or **Functional Block** are promoted to P0 at runtime. This promotion uses the existing semantic asset classifier, not filename guessing.

In the texture detail UI, P0 prompt text is intentionally hidden. Two compact buttons copy the reference prompt and the standard production prompt directly.
`;
fs.writeFileSync('PROMPT_AUTHORING_GUIDE.md',guide);

let handoff=fs.readFileSync('SESSION_HANDOFF.md','utf8');
handoff=handoff.replace(/^Updated:.*$/m,'Updated: 2026-10-05');
const marker='## Project';
const note=`## Current continuation — reference-first P0 prompts — 2026-10-05

- Replaced the user-facing P0 classic/creative prompt workflow with two compact copy actions: **Ref prompt** and **Üretim prompt**.
- P0 reference prompts describe the shared grounded dark-fantasy world/art direction and only identify the material subject; they deliberately avoid prescribing surface details.
- The production prompt is one standard Original+Ref template: Image A = structure/function, Image B = dominant style/material language; only literal outer-canvas boundaries are seam-critical.
- The P0 creative alternative is retired from the UI/export path.
- Existing semantic classification is now used to promote P1 **Block** and **Functional Block** textures (including brick-like block assets) into P0; filenames are not used for that promotion.
- Non-P0 prompt behavior remains legacy/asset-specific.
- Next check: GitHub Actions runtime guard + Pages deployment, then Android spot-check of birch log, acacia/cobblestone and one promoted P1 block.

`;
if(!handoff.includes('## Current continuation — reference-first P0 prompts'))handoff=handoff.replace(marker,note+marker);
fs.writeFileSync('SESSION_HANDOFF.md',handoff);

console.log('reference-first migration applied');
