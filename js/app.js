const SOURCE_ZIPS={};

const PAGE_SIZE=36; let filtered=[], page=0, active=null, changedOnly=false, promptedOnly=false, renderToken=0; const urlCache=new Map();
const $=id=>document.getElementById(id);
const toast=t=>{const e=$('toast'); if(!e){console.log(t);return} e.textContent=t;e.classList.add('show');setTimeout(()=>e.classList.remove('show'),1700)};
const sourceZips={};
const sourceZipPromises={};
const MINECLONIA_REF="209ec2dc96adbf7f5ba083816d90596492ec53b5";
const MINECLONIA_RAW_BASE=`https://raw.githubusercontent.com/mark-wiemer/mineclonia/${MINECLONIA_REF}/mods`;
function upstreamTextureUrl(meta){
  return `${MINECLONIA_RAW_BASE}/${encodeURIComponent(meta.category)}/${encodeURIComponent(meta.mod)}/textures/${encodeURIComponent(meta.name)}`;
}
async function originalBlob(path){
  const meta=CATALOG.find(x=>x.path===path);if(!meta)throw Error('Katalog kaydı bulunamadı: '+path);
  const url=upstreamTextureUrl(meta);
  const controller=new AbortController();
  const timer=setTimeout(()=>controller.abort(),12000);
  try{
    const r=await fetch(url,{cache:'force-cache',signal:controller.signal});
    if(!r.ok) throw Error(`Mineclonia kaynak texture bulunamadı (${r.status}): ${path}`);
    return await r.blob();
  }catch(err){
    if(err?.name==='AbortError')throw Error('Mineclonia kaynak texture zaman aşımı: '+path);
    throw err;
  }finally{clearTimeout(timer)}
}
async function displayBlob(path){const e=await getEdit(path);return e?.blob || await originalBlob(path)}
async function blobUrl(path,preferEdit=true){const key=(preferEdit?'e:':'o:')+path;if(urlCache.has(key))return urlCache.get(key);const b=preferEdit?await displayBlob(path):await originalBlob(path);const u=URL.createObjectURL(b);urlCache.set(key,u);return u}

const THUMB_MAX_EDGE=192;
const THUMB_CACHE_RES=192;
const EDITOR_PREVIEW_MAX_EDGE=1024;
async function previewBlob(blob,maxEdge){
 if(!blob||!maxEdge)return blob;
 let bmp=null;
 try{
   if('createImageBitmap' in window){
     bmp=await createImageBitmap(blob);
     const sw=bmp.width,sh=bmp.height,scale=Math.min(1,maxEdge/Math.max(sw,sh));
     if(scale>=1){bmp.close?.();return blob}
     const dw=Math.max(1,Math.round(sw*scale)),dh=Math.max(1,Math.round(sh*scale));
     const canvas=document.createElement('canvas');canvas.width=dw;canvas.height=dh;
     const g=canvas.getContext('2d');g.imageSmoothingEnabled=true;g.imageSmoothingQuality='high';g.drawImage(bmp,0,0,dw,dh);
     bmp.close?.();return await canvasPngBlob(canvas);
   }
 }catch(err){try{bmp?.close?.()}catch(_){} console.warn('preview bitmap fallback',err)}
 const source=await decodeBlobToCanvas(blob),sw=source.width,sh=source.height,scale=Math.min(1,maxEdge/Math.max(sw,sh));
 if(scale>=1)return blob;
 const dw=Math.max(1,Math.round(sw*scale)),dh=Math.max(1,Math.round(sh*scale));
 const canvas=document.createElement('canvas');canvas.width=dw;canvas.height=dh;
 const g=canvas.getContext('2d');g.imageSmoothingEnabled=true;g.imageSmoothingQuality='high';g.drawImage(source,0,0,dw,dh);
 return await canvasPngBlob(canvas);
}
function invalidatePreviewUrls(path){
 for(const [key,url] of [...urlCache.entries()]){
   if(key.endsWith(':'+path)){try{URL.revokeObjectURL(url)}catch(_){}urlCache.delete(key)}
 }
}
async function invalidateDerivedCaches(path){
 invalidatePreviewUrls(path);
 // Drop queued derived-cache work for the previous blob before deleting persisted entries.
 for(let i=scaleQueue.length-1;i>=0;i--)if(scaleQueue[i]?.path===path){scaleQueued.delete(scaleQueue[i].qk);scaleQueue.splice(i,1)}
 await delScaledPath(path);
}
async function rebuildEditThumbnail(path,blob){
 try{
   const small=await previewBlob(blob,THUMB_MAX_EDGE);
   await putScaled(path,THUMB_CACHE_RES,small);
   invalidatePreviewUrls(path);
   const u=URL.createObjectURL(small),key=`p:${THUMB_MAX_EDGE}:e:${path}`;
   urlCache.set(key,u);
   const ref=cardRefsFast.get(path);if(ref?.img)ref.img.src=u;
   return u
 }catch(e){console.warn('thumbnail rebuild failed',path,e);return null}
}
async function previewUrl(path,preferEdit=true,maxEdge=EDITOR_PREVIEW_MAX_EDGE){
 const key=`p:${maxEdge}:${preferEdit?'e':'o'}:${path}`;
 if(urlCache.has(key))return urlCache.get(key);
 if(preferEdit&&maxEdge===THUMB_MAX_EDGE){
   const cached=await getScaled(path,THUMB_CACHE_RES);
   if(cached?.blob){const u=URL.createObjectURL(cached.blob);urlCache.set(key,u);return u}
 }
 const source=preferEdit?await displayBlob(path):await originalBlob(path);
 const small=await previewBlob(source,maxEdge);
 if(preferEdit&&maxEdge===THUMB_MAX_EDGE)putScaled(path,THUMB_CACHE_RES,small).catch(e=>console.warn('thumbnail cache write',e));
 const u=URL.createObjectURL(small);urlCache.set(key,u);return u;
}
function priorityColor(p){return {P0:'#ff6b6b',P1:'#ffad5a',P2:'#ffd65a',P3:'#71a7ff',P4:'#a98cff',P5:'#84909f',P6:'#616a75'}[p]||'#999'}
const MINECLONIA_INVENTORY_TABS=[
 ['blocks','Building Blocks'],['deco','Decoration Blocks'],['redstone','Redstone'],['rail','Transportation'],
 ['food','Foodstuffs'],['tools','Tools'],['combat','Combat'],['mobs','Mobs'],['brew','Brewing'],
 ['matr','Materials'],['misc','Miscellaneous'],['nici','Not in Creative Inventory']
];
const TEXTURE_TECH_CATEGORIES=[
 ['terrain','Terrain / Natural'],['stone','Stone / Masonry'],['wood','Wood Sets'],['ores','Ores / Minerals'],
 ['plants','Plants / Foliage'],['crops','Crops / Farming'],['liquids','Liquids'],['animated','Animated Textures'],
 ['passive','Passive Mobs'],['hostile','Hostile Mobs'],['boss','Bosses'],['npc','Villagers / NPCs'],
 ['player','Player'],['armor','Armor / Wearables'],['vehicles','Vehicles'],['items','General Items'],
 ['tools-tech','Tools'],['weapons','Weapons / Combat'],['food-tech','Food'],['materials','Materials'],
 ['workstations','Workstations'],['containers','Containers'],['doors','Doors / Trapdoors'],['redstone-tech','Redstone Components'],
 ['hud','HUD'],['gui','GUI / Menus'],['icons','Icons / Indicators'],['overlays','Overlays'],
 ['particles','Particles'],['effects','Effects / VFX'],['sky','Sky / Weather'],['environment','Environment'],
 ['maps','Maps / Minimap'],['runtime-tint','Runtime Tint / Color Masks'],['debug','System / Debug'],['other','Other / Unresolved']
];
function textureFacts(x){
 const p=String(x.path||''),parts=p.split('/'),top=(parts[0]||'').toUpperCase(),mod=(parts[1]||'').toLowerCase();
 const n=String(x.name||parts.at(-1)||'').toLowerCase(),q=(p+' '+n).toLowerCase();
 return {p,parts,top,mod,n,q,broad:assetTypeOf(x)};
}
function minecloniaInventoryCategoriesOf(x){
 const {top,mod,n,q,broad}=textureFacts(x),out=new Set(),add=(...ids)=>ids.forEach(id=>out.add(id));
 if(top==='ENTITIES'){
   if(/boat|minecart/.test(q))add('rail'); else add('mobs');
   return [...out];
 }
 if(top==='HUD'||top==='PLAYER'||/particle|effect|overlay|weather|sky|sun|moon|rain|snow/.test(q)){add('misc');return [...out]}
 if(/redstone|repeater|comparator|piston|observer|dispenser|dropper|lever|button|pressure_plate|daylight_detector|target|tripwire/.test(q))add('redstone');
 if(/minecart|rail|boat|elytra/.test(q))add('rail');
 if(mod==='mcl_tools'||/pickaxe|shovel|hoe|axe|shears|fishing_rod|flint_and_steel|compass|clock/.test(q))add('tools');
 if(/mcl_armor|sword|bow|crossbow|arrow|trident|mace|shield|helmet|chestplate|leggings|boots/.test(q))add('combat');
 if(/mcl_potions|mcl_brewing|potion|dragon_breath|brewing/.test(q))add('brew');
 if(/apple|bread|cookie|cake|stew|carrot|potato|beetroot|melon|pumpkin_pie|berry|pork|beef|chicken|mutton|rabbit|cod|salmon|food/.test(q))add('food');
 if(/ingot|nugget|diamond|emerald|lapis|stick|paper|bowl|flint|feather|string|leather|dye|shard|crystal|raw_/.test(q))add('matr');
 if(/flower|sapling|leaves|coral|seagrass|kelp|cactus|reeds|lichen|glass|pane|wool|carpet|torch|lantern|fence|door|trapdoor|bed|chest|barrel|bookshelf|sign|banner|pot|workbench|crafting|furnace|anvil/.test(q)||broad==='Plant / Foliage'||broad==='Functional Block')add('deco');
 if(/stone|cobble|brick|plank|wood|log|tree|dirt|sand|gravel|ore|deepslate|blackstone|terracotta|concrete|prismarine|quartz|basalt|netherrack|end_stone|bedrock|copper/.test(q)&&broad!=='Item')add('blocks');
 if(/spawn_egg/.test(q))add('mobs');
 if(/barrier|debug|structure_void|unknown_node|blank|placeholder/.test(q))add('nici');
 if(!out.size)add('misc');
 return [...out];
}
const RUNTIME_TINT_EXACT=new Set([
 'mcl_core_grass_block_top.png','mcl_core_grass_block_side_overlay.png','mcl_core_papyrus.png',
 'mcl_farming_melon_stem_disconnected.png','mcl_farming_pumpkin_stem_disconnected.png',
 'mcl_candles_candle.png','mcl_banners_banner_base.png','mcl_banners_item_base_48.png',
 'mcl_bows_arrow_overlay.png','mcl_potions_arrow_inv.png',
 'mobs_mc_cat_collar.png','mobs_mc_wolf_collar.png','mobs_mc_sheep_fur.png','mobs_mc_sheep_sheared.png'
]);
function runtimeTintInfo(x){
 const n=String(x?.name||'').toLowerCase(),p=String(x?.path||'').toLowerCase();
 if(RUNTIME_TINT_EXACT.has(n))return {kind:/grass_block|papyrus/.test(n)?'biome':'runtime',reason:'Mineclonia runtime palette/colorize mask'};
 if(/(?:^|_)(?:leaves|leaf)(?:_|\.|$)/.test(n)&&!/azalea|cherry/.test(n))return {kind:'biome',reason:'Mineclonia leaves palette'};
 if(/mcl_redstone.*(?:wire|dust)/.test(p+n))return {kind:'state',reason:'redstone power palette'};
 if(/tropical_fish/.test(p+n))return {kind:'runtime',reason:'entity base/pattern colorize'};
 if(/mcl_skins/.test(p)&&/(mask|base)/.test(n))return {kind:'runtime',reason:'player skin color mask'};
 if(/mcl_armor/.test(p)&&/leather/.test(n))return {kind:'runtime',reason:'dyed leather armor colorize'};
 if(/mcl_banners/.test(p)&&/(base|pattern)/.test(n))return {kind:'runtime',reason:'banner dye colorize'};
 return null;
}
function isRuntimeTintTexture(x){return !!runtimeTintInfo(x)}
const RUNTIME_TINT_PROMPT_LOCK=`RUNTIME TINT / COLOR MASK LOCK:
This texture is intentionally color-neutral because Mineclonia applies its visible color later at runtime through a biome palette, state palette, dye, or colorize modifier.
Preserve the neutral/grayscale value structure and material detail. Do NOT bake the final green, foliage, biome, redstone-power, dye, skin, armor, banner, or entity color into the texture.
Keep luminance/value relationships suitable for multiplication/colorization. Avoid colored lighting, colored stains, or hue information that would contaminate runtime tinting.
The runtime-applied color is authoritative; author material detail and value only.`;
function tintPromptText(text,x){
 if(!isRuntimeTintTexture(x))return text;
 return String(text)
  .replaceAll('characteristic color family','neutral grayscale/value structure suitable for runtime tinting')
  .replaceAll('color relationships','value/luminance relationships')
  .replaceAll('color variation','value/luminance variation')
  .replaceAll('restrained in color','neutral and disciplined in value/luminance, without a baked final hue')
  .replaceAll('restrained saturation','neutral tint-ready values')
  .replaceAll('pigmentation','neutral value patterning');
}

function textureTechnicalCategoriesOf(x){
 const {top,mod,n,q,broad}=textureFacts(x),out=new Set(),add=(...ids)=>ids.forEach(id=>out.add(id));
 if(top==='HUD'||/\/hud\/|crosshair|hotbar|heart|hunger|armor_bar|experience|xp_bar|breath|damage_indicator/.test(q))add('hud');
 if(/gui|inventory|menu|button|slot|container_gui|formspec|creative/.test(q))add('gui');
 if(/icon|indicator|marker|pointer|reticle/.test(q))add('icons');
 if(/overlay|vignette|pumpkinblur|underwater|portal_overlay|powder_snow/.test(q))add('overlays');
 if(/particle|particles|smoke|spark|bubble|splash|flame|ash|drip|poof/.test(q))add('particles');
 if(/effect|beam|glint|enchant|aura|explosion|flash|firework|vfx/.test(q))add('effects');
 if(/sky|sun|moon|cloud|rain|snow|weather|stars/.test(q))add('sky');
 if(/water|lava|river|liquid/.test(q))add('liquids');
 if(/animated|animation|_anim|flowing|portal|fire_/.test(q))add('animated');
 if(top==='PLAYER'||/player|steve|alex|skin/.test(q))add('player');
 if(/armor|helmet|chestplate|leggings|boots|elytra|wearable/.test(q))add('armor');
 if(top==='ENTITIES'||broad==='Entity'){
   if(/dragon|wither|warden/.test(q))add('boss');
   else if(/zombie|skeleton|creeper|spider|enderman|witch|slime|ghast|blaze|guardian|pillager|vindicator|evoker|ravager|piglin|hoglin|phantom|drowned|husk|stray|silverfish|endermite|shulker/.test(q))add('hostile');
   else if(/villager|wandering_trader|npc/.test(q))add('npc');
   else if(/boat|minecart/.test(q))add('vehicles');
   else add('passive');
 }
 if(/boat|minecart|cart|vehicle/.test(q))add('vehicles');
 if(/crop|wheat|carrot|potato|beetroot|stem|farmland|cocoa|nether_wart|stage_/.test(q))add('crops');
 if(/flower|sapling|leaves|grass|fern|vine|coral|seagrass|kelp|cactus|reeds|lichen|mushroom|bamboo/.test(q))add('plants');
 if(/ore|raw_|diamond|emerald|lapis|amethyst|coal|iron|gold|copper/.test(q))add('ores');
 if(/stone|cobble|brick|deepslate|blackstone|terracotta|concrete|prismarine|quartz|basalt|netherrack|end_stone|bedrock/.test(q))add('stone');
 if(/plank|wood|log|tree|bark|stripped|hyphae|stem/.test(q)&&!out.has('crops'))add('wood');
 if(/dirt|sand|gravel|clay|mud|snow|ice|mycelium|podzol|nylium/.test(q))add('terrain');
 if(/chest|barrel|shulker_box|container/.test(q))add('containers');
 if(/crafting|furnace|smoker|blast_furnace|anvil|grindstone|loom|lectern|stonecutter|cartography|fletching|smithing|brewing_stand|composter/.test(q))add('workstations');
 if(/door|trapdoor/.test(q))add('doors');
 if(/redstone|repeater|comparator|piston|observer|dispenser|dropper|lever|pressure_plate|tripwire/.test(q))add('redstone-tech');
 if(/sword|bow|crossbow|arrow|trident|mace|shield/.test(q))add('weapons');
 if(/pickaxe|shovel|hoe|axe|shears|fishing_rod|flint_and_steel/.test(q))add('tools-tech');
 if(/apple|bread|cookie|cake|stew|carrot|potato|beetroot|melon|berry|pork|beef|chicken|mutton|rabbit|cod|salmon/.test(q))add('food-tech');
 if(/ingot|nugget|shard|crystal|dye|string|leather|paper|stick|flint|feather/.test(q))add('materials');
 if(top==='ITEMS'&&![...out].some(v=>['tools-tech','weapons','food-tech','materials','armor'].includes(v)))add('items');
 if(/map|minimap|map_/.test(q))add('maps');
 if(isRuntimeTintTexture(x))add('runtime-tint');
 if(/debug|unknown|placeholder|blank|missing|structure_void|barrier/.test(q))add('debug');
 if(!out.size&&/environment|biome|fog/.test(q))add('environment');
 if(!out.size)add('other');
 return [...out];
}
function minecloniaInventoryCategoryLabels(x){const labels=Object.fromEntries(MINECLONIA_INVENTORY_TABS);return minecloniaInventoryCategoriesOf(x).map(id=>labels[id]||id)}
async function buildFilters(){
 const sel=$('category');
 sel.innerHTML='<option value="">Tüm sınıflar</option><optgroup label="Özel üretim"><option value="special:armor_uv">Armor UV · 32</option></optgroup><optgroup label="Mineclonia Creative">'+MINECLONIA_INVENTORY_TABS.map(([id,label])=>`<option value="inv:${id}">${label}</option>`).join('')+'</optgroup><optgroup label="Texture / Teknik">'+TEXTURE_TECH_CATEGORIES.map(([id,label])=>`<option value="tech:${id}">${label}</option>`).join('')+'</optgroup>';
 const vals=['ALL','P0','P1','P2','P3','P4','P5','P6'];
 const counts=Object.fromEntries(vals.map(v=>[v,v==='ALL'?CATALOG.length:CATALOG.filter(x=>x.priority===v).length]));
 $('filters').innerHTML=vals.map(v=>`<button class="chip ${v==='P0'?'active':''}" data-p="${v}">${v==='ALL'?'Tümü':v} · ${counts[v]}</button>`).join('');
 $('filters').onclick=e=>{const b=e.target.closest('[data-p]');if(!b)return;document.querySelectorAll('.chip').forEach(x=>x.classList.remove('active'));b.classList.add('active');const p=b.dataset.p;$('stat').textContent=(p==='ALL'?'Liste':p)+' hazırlanıyor…';applyFilter()}
}
function categoryMatches(x,cat){if(!cat)return true;if(cat==='special:armor_uv')return isArmorUvTexture(x);const [kind,id]=cat.split(':');return kind==='tech'?textureTechnicalCategoriesOf(x).includes(id):minecloniaInventoryCategoriesOf(x).includes(id)}
function activePriority(){return document.querySelector('.chip.active')?.dataset.p||'P0'}
function assetTypeOf(x){
 const p=x.path||'', n=(x.name||'').toLowerCase(), parts=p.split('/'), top=parts[0]||'', mod=parts[1]||'';
 // Semantic effect sprites can live under ENTITIES but are not entity UV skins.
 if(/^extra_mobs_glow_squid_glint[1-4]\.png$/.test(n)||/^mobs_mc_wolf_splash_[0-3]\.png$/.test(n)) return 'Animated / Effect';
 if(top==='ENTITIES') return 'Entity';
 if(n.includes('_animated')||n.includes('_anim')||n.endsWith('_anim.png')||/tear[23]\.png$/.test(n)) return 'Animated / Effect';
 if(mod==='mcl_tools'||n.includes('tool_')||n.endsWith('_inv.png')||n.endsWith('_item.png')||n.endsWith('_hud.png')||['default_brick.png','default_clay_brick.png','default_clay_lump.png','default_coal_lump.png','default_paper.png','mcl_core_bowl.png','mcl_core_gold_nugget.png','mcl_core_iron_nugget.png','mcl_core_lapis.png'].includes(n)) return 'Item';
 if(['mcl_doors','mcl_beds','mcl_chests','mcl_furnaces','mcl_crafting_table','mcl_panes','mcl_fences','mcl_torches'].includes(mod)) return 'Functional Block';
 if(mod==='mcl_flowers') return 'Plant / Foliage';
 if(mod==='mcl_farming'){
   if(['stage_','stem_','berry_bush','farmland','melon_side','melon_top','pumpkin_face','pumpkin_side','pumpkin_top','hayblock'].some(k=>n.includes(k))) return 'Plant / Foliage';
   if(['carrot_1','carrot_2','carrot_3','carrot_4','beetroot_0','beetroot_1','beetroot_2','beetroot_3','potatoes_stage','wheat_stage'].some(k=>n.includes(k))) return 'Plant / Foliage';
   return 'Item';
 }
 if(mod==='mcl_ocean'){
   if(['coral','kelp_plant','seagrass'].some(k=>n.includes(k))&&!['_item','_block'].some(k=>n.includes(k))) return 'Plant / Foliage';
   if(['_item','shard','crystals'].some(k=>n.includes(k))) return 'Item';
   if(n.includes('anim')) return 'Animated / Effect';
   return 'Block';
 }
 if(mod==='mcl_core'){
   if(['sapling','cactus_flower','dry_shrub','papyrus','reeds','glow_lichen'].some(k=>n.includes(k))) return 'Plant / Foliage';
   if(['_lump','nugget','paper','bowl'].some(k=>n.includes(k))||['default_brick.png','default_clay_brick.png','default_clay_lump.png'].includes(n)) return 'Item';
   return 'Block';
 }
 if(['mcl_deepslate','mcl_wool'].includes(mod)) return 'Block';
 if(top==='HUD'||top==='PLAYER') return 'Item';
 return 'Block';
}
function runtimeRoleInfo(x){
 const n=(x.name||'').toLowerCase(), top=(x.path||'').split('/')[0]||'', broad=assetTypeOf(x);
 const info=(role,model='',evidence='')=>({role,model,evidence});
 if(/^extra_mobs_glow_squid_glint[1-4]\.png$/.test(n)) return info('Particle / Effect Sprite','none','mobs_mc/squid+glow_squid.lua → particlespawner texture pool');
 if(/^mobs_mc_wolf_splash_[0-3]\.png$/.test(n)) return info('Particle / Effect Sprite','none','mobs_mc/wolf.lua + villager.lua → particle texpool');
 if(n==='mobs_chicken_egg.png') return info('Inventory Template / Mask','none','mcl_mobs/init.lua → spawn-egg inventory composition');
 if(top==='ENTITIES'){
   if(n==='mobs_mc_cat_collar.png') return info('Tintable Entity Overlay','mobs_mc_cat.b3d','mobs_mc/ocelot.lua → colorized collar composited over cat skin');
   if(n==='mobs_mc_wolf_collar.png') return info('Tintable Entity Overlay','mobs_mc_wolf.b3d','mobs_mc/wolf.lua → colorized collar on tame texture');
   if(n==='mobs_mc_sheep_fur.png') return info('Tintable Entity Material Layer','mobs_mc_sheepfur.b3d','mobs_mc/sheep.lua → colorized wool material layer');
   if(n==='mobs_mc_sheep_sheared.png') return info('Tintable Entity Overlay','mobs_mc_sheepfur.b3d','mobs_mc/sheep.lua → colorized sheared layer composited with base');
   if(/^mobs_mc_horse_markings_/.test(n)) return info('Entity Marking Overlay','mobs_mc_horse.b3d','mobs_mc/horse.lua → marking overlay combined with horse base coat');
   if(n==='mobs_mc_pig_saddle.png') return info('Reusable Equipment Overlay','mobs_mc_pig.b3d + extra_mobs_strider.b3d','mobs_mc/pig.lua + strider.lua → saddle layer');
   if(n==='mobs_mc_creeper_charge.png') return info('Entity State Overlay','mobs_mc_creeper.b3d','mobs_mc/creeper.lua → second texture layer with opacity modifier');
   if(n==='mobs_mc_spider_eyes.png') return info('Emissive / Eye Overlay','mobs_mc_spider.b3d','mobs_mc/spider.lua → eye layer; opacity/makealpha composition');
   if(n==='mobs_mc_enderman_eyes.png') return info('Emissive Eye Overlay + Effect Entity','mobs_mc_enderman.b3d + mobs_mc_spider.b3d','mobs_mc/enderman.lua → composited on Enderman + glowing ender_eyes entity');
   if(/^mobs_mc_villager_(base|desert|jungle|plains|savanna|snow|swamp|taiga|profession_)/.test(n))
     return info(n.includes('_base')?'Entity Base Layer':n.includes('_profession_')?'Entity Profession Overlay':'Entity Biome Overlay','mobs_mc_villager.b3d','mobs_mc/villager.lua → get_overlaid_texture()');
   if(/^mobs_mc_zombie_villager_(base|desert|jungle|plains|savanna|snow|swamp|taiga|profession_)/.test(n))
     return info(n.includes('_base')?'Entity Base Layer':n.includes('_profession_')?'Entity Profession Overlay':'Entity Biome Overlay','mobs_mc_villager_zombie.b3d','mobs_mc/villager_zombie.lua → get_overlaid_texture()');
   if(n==='extra_mobs_cod.png') return info('Entity Base Skin','extra_mobs_cod.b3d','mobs_mc/cod.lua');
   if(n==='extra_mobs_salmon.png') return info('Entity Base Skin','extra_mobs_salmon.b3d','mobs_mc/salmon.lua');
   if(n==='extra_mobs_glow_squid.png') return info('Entity Base Skin','mobs_mc_squid.b3d','mobs_mc/squid+glow_squid.lua; active mesh is squid mesh');
   if(/^extra_mobs_(piglin|piglin_brute|zombified_piglin)\.png$/.test(n)) return info('Entity Variant Skin','mobs_mc_piglin.b3d (child: mobs_mc_baby_piglin.b3d)','mobs_mc/piglin.lua');
   if(n==='mobs_mc_bat.png') return info('Entity Base Skin','mobs_mc_bat.b3d','mobs_mc/bat.lua');
   if(/^mobs_mc_cat_/.test(n)) return info('Entity Coat / Variant Skin','mobs_mc_cat.b3d','mobs_mc/ocelot.lua → cat texture tables');
   if(n==='mobs_mc_chicken.png') return info('Entity Base Skin','mobs_mc_chicken.b3d','mobs_mc/chicken.lua');
   if(n==='mobs_mc_cow.png') return info('Entity Base Skin','mobs_mc_cow.b3d','mobs_mc/cow+mooshroom.lua');
   if(/^mobs_mc_(cave_spider|spider)\.png$/.test(n)) return info('Entity Base / Variant Skin','mobs_mc_spider.b3d','mobs_mc/spider.lua');
   if(n==='mobs_mc_creeper.png') return info('Entity Base Skin','mobs_mc_creeper.b3d','mobs_mc/creeper.lua');
   if(n==='mobs_mc_enderman.png') return info('Entity Base Skin','mobs_mc_enderman.b3d','mobs_mc/enderman.lua');
   if(/^mobs_mc_horse_(black|brown|chestnut|creamy|darkbrown|gray|white|skeleton|zombie)\.png$/.test(n)) return info('Entity Coat / Variant Skin','mobs_mc_horse.b3d','mobs_mc/horse.lua');
   if(n==='mobs_mc_pig.png') return info('Entity Base Skin','mobs_mc_pig.b3d','mobs_mc/pig.lua');
   if(/^mobs_mc_rabbit_/.test(n)) return info('Entity Coat / Variant Skin','mobs_mc_rabbit.b3d','mobs_mc/rabbit.lua');
   if(n==='mobs_mc_sheep.png') return info('Entity Base Skin','mobs_mc_sheepfur.b3d','mobs_mc/sheep.lua');
   if(n==='mobs_mc_skeleton.png') return info('Entity Base Skin','mobs_mc_skeleton.b3d','mobs_mc/skeleton+stray.lua');
   if(n==='mobs_mc_wither_skeleton.png') return info('Entity Base Skin','mobs_mc_witherskeleton.b3d','mobs_mc/skeleton_wither.lua');
   if(n==='mobs_mc_squid.png') return info('Entity Base Skin','mobs_mc_squid.b3d','mobs_mc/squid+glow_squid.lua');
   if(n==='mobs_mc_vindicator.png') return info('Entity Base Skin','mobs_mc_vindicator.b3d','mobs_mc/villager_vindicator.lua');
   if(n==='mobs_mc_villager_wandering_trader.png') return info('Entity Variant Skin','mobs_mc_villager.b3d','mobs_mc/wandering_trader.lua inherits villager base');
   if(n==='mobs_mc_villager.png') return info('Entity Fallback / Full Skin','mobs_mc_villager.b3d','mobs_mc/villager.lua initial texture; layered runtime system');
   if(n==='mobs_mc_zombie_villager.png') return info('Entity Fallback / Full Skin','mobs_mc_villager_zombie.b3d','mobs_mc/villager_zombie.lua initial texture; layered runtime system');
   if(n==='mobs_mc_zombie.png') return info('Entity Base Skin','mobs_mc_zombie.b3d','mobs_mc/zombie.lua');
   if(/^mobs_mc_wolf(_|\.).*/.test(n)) return info(n.includes('_angry')||n.includes('_tame')?'Entity State / Coat Skin':'Entity Coat / Variant Skin','mobs_mc_wolf.b3d (child: mobs_mc_baby_wolf.b3d)','mobs_mc/wolf.lua → dynamic variant table');
   return info('Entity Skin / Layer (unresolved subtype)','unknown','ENTITIES asset; exact runtime subtype not yet code-traced');
 }
 if(broad==='Animated / Effect') return info(isAnimatedStrip(x)?'Animation Atlas / Strip':'Effect / State Texture','','dimension/name + family rules');
 if(broad==='Item') return info('Inventory / Item Sprite','','item/inventory family');
 if(broad==='Plant / Foliage') return info('Plant / Alpha-Masked World Texture','','plant/foliage family');
 if(broad==='Functional Block') return info('Functional Block Surface / Atlas','','functional object texture family');
 if(broad==='Block') return info('Block / Node Surface','','node tile/material family');
 return info(broad||'Unresolved','','');
}
function runtimeRoleOf(x){return runtimeRoleInfo(x).role}
function hasAuthoredPrompt(x){return !!(x&&(BLOCK_REFERENCE_PROMPTS.has(x.id)||AUTHORED_UV_REFS.has(x.id)||PROMPT_OVERRIDES.has(x.id)))}
async function applyFilter(){const q=$('search').value.trim().toLowerCase(),cat=$('category').value,p=activePriority();filtered=CATALOG.filter(x=>(p==='ALL'||x.priority===p)&&categoryMatches(x,cat)&&(!q||x.path.toLowerCase().includes(q))&&(!changedOnly||changedPaths.has(x.path))&&(!promptedOnly||hasAuthoredPrompt(x)));page=0;return render()}
async function render(){
 const token=++renderToken,start=page*PAGE_SIZE,arr=filtered.slice(start,start+PAGE_SIZE);$('grid').innerHTML='';$('stat').textContent=`${filtered.length}/${CATALOG.length} • ${changedPaths.size} değişti • ${storageLabel()}`;$('pageInfo').textContent=`${Math.min(page+1,Math.max(1,Math.ceil(filtered.length/PAGE_SIZE)))} / ${Math.max(1,Math.ceil(filtered.length/PAGE_SIZE))}`;
 if(!arr.length){$('grid').innerHTML='<div class="empty" style="grid-column:1/-1">Bu filtrede texture yok.</div>';return}
 const cards=[];for(const x of arr){const b=document.createElement('button');b.className='card';b.innerHTML=`<img><span class="badge" style="color:${priorityColor(x.priority)}">${x.priority}</span>${changedPaths.has(x.path)?'<span class="changed"></span>':''}`;b.title=x.path;b.onclick=()=>openDetail(x);$('grid').appendChild(b);cards.push([x,b.querySelector('img')])}
 for(let i=0;i<cards.length;i+=6){if(token!==renderToken)return;await Promise.all(cards.slice(i,i+6).map(async([x,img])=>{try{img.src=await previewUrl(x.path,true,THUMB_MAX_EDGE)}catch(e){console.warn(x.path,e)}}));await new Promise(requestAnimationFrame)}
}
async function countChanged(){return (await allEdits()).length}

function b64bytes(s){const bin=atob(s),u=new Uint8Array(bin.length);for(let i=0;i<bin.length;i++)u[i]=bin.charCodeAt(i);return u}
const DB='MinecloniaTextureStudio', STORE='edits';
let dbp=null, storageMode='checking'; const memoryEdits=new Map();
function blobToDataURL(blob){return new Promise((res,rej)=>{const r=new FileReader();r.onload=()=>res(r.result);r.onerror=()=>rej(r.error);r.readAsDataURL(blob)})}
function dataURLToBlob(s){const [h,b]=s.split(','),m=(h.match(/data:([^;]+)/)||[])[1]||'image/png',bin=atob(b),u=new Uint8Array(bin.length);for(let i=0;i<bin.length;i++)u[i]=bin.charCodeAt(i);return new Blob([u],{type:m})}
async function initStorage(){
  if(!('indexedDB' in window)){storageMode='local';return}
  try{
    dbp=await new Promise((res,rej)=>{
      let settled=false;
      const r=indexedDB.open(DB,1);
      const finish=(fn,value)=>{if(settled)return;settled=true;clearTimeout(timer);fn(value)};
      const timer=setTimeout(()=>{settled=true;rej(Error('IndexedDB açılışı zaman aşımına uğradı'))},2500);
      r.onupgradeneeded=()=>{if(!r.result.objectStoreNames.contains(STORE))r.result.createObjectStore(STORE,{keyPath:'path'})};
      r.onsuccess=()=>{if(settled){try{r.result.close()}catch(_){};return}finish(res,r.result)};
      r.onerror=()=>finish(rej,r.error||Error('IndexedDB açılamadı'));
      r.onblocked=()=>finish(rej,Error('IndexedDB blocked'));
    });
    storageMode='indexeddb';
  }catch(e){console.warn('IndexedDB unavailable',e);storageMode='local';dbp=null}
}
function storageLabel(){return storageMode==='indexeddb'?'kalıcı':storageMode==='local'?'yerel fallback':'oturum'}
async function localPut(path,blob){try{const data=await blobToDataURL(blob);localStorage.setItem('mts:'+path,JSON.stringify({data,updatedAt:Date.now()}));return true}catch(e){console.warn('localStorage unavailable/full',e);storageMode='memory';memoryEdits.set(path,{path,blob,updatedAt:Date.now()});return false}}
async function putEdit(path,blob){
 if(storageMode==='indexeddb'&&dbp){try{await new Promise((res,rej)=>{const tx=dbp.transaction(STORE,'readwrite');tx.objectStore(STORE).put({path,blob,updatedAt:Date.now()});tx.oncomplete=res;tx.onerror=()=>rej(tx.error)});revoke(path);return}catch(e){console.warn(e);storageMode='local'}}
 if(storageMode==='local'){await localPut(path,blob)}else memoryEdits.set(path,{path,blob,updatedAt:Date.now()});revoke(path)
}
async function getEdit(path){
 if(storageMode==='indexeddb'&&dbp){try{return await new Promise((res,rej)=>{const r=dbp.transaction(STORE).objectStore(STORE).get(path);r.onsuccess=()=>res(r.result||null);r.onerror=()=>rej(r.error)})}catch(e){storageMode='local'}}
 if(storageMode==='local'){try{const s=localStorage.getItem('mts:'+path);if(!s)return null;const o=JSON.parse(s);return {path,blob:dataURLToBlob(o.data),updatedAt:o.updatedAt}}catch(e){storageMode='memory'}}
 return memoryEdits.get(path)||null
}
async function delEdit(path){
 if(storageMode==='indexeddb'&&dbp){try{await new Promise((res,rej)=>{const tx=dbp.transaction(STORE,'readwrite');tx.objectStore(STORE).delete(path);tx.oncomplete=res;tx.onerror=()=>rej(tx.error)})}catch(e){storageMode='local'}}
 if(storageMode==='local'){try{localStorage.removeItem('mts:'+path)}catch(e){}} memoryEdits.delete(path);revoke(path)
}
async function allEdits(){
 if(storageMode==='indexeddb'&&dbp){try{return await new Promise((res,rej)=>{const r=dbp.transaction(STORE).objectStore(STORE).getAll();r.onsuccess=()=>res(r.result||[]);r.onerror=()=>rej(r.error)})}catch(e){storageMode='local'}}
 const out=[];
 if(storageMode==='local'){try{for(let i=0;i<localStorage.length;i++){const k=localStorage.key(i);if(k&&k.startsWith('mts:')){const o=JSON.parse(localStorage.getItem(k));out.push({path:k.slice(4),blob:dataURLToBlob(o.data),updatedAt:o.updatedAt})}}}catch(e){storageMode='memory'}}
 for(const v of memoryEdits.values())if(!out.some(x=>x.path===v.path))out.push(v);return out
}



const P0_CREATIVE_BASE=`CREATIVE REINTERPRETATION MODE

This is NOT an HD remake and NOT a faithful reconstruction of the source texture.

Keep the same gameplay material/object identity, but deliberately redesign the texture's internal composition. Do not preserve the source's large cracks, patches, blobs, knots, stains, veins, stone boundaries, grain groupings, light/dark islands, focal marks or other major spatial features just because they exist in the original. Their positions, sizes, shapes and rhythm may change completely.

Use the source only to understand what the asset is and which hard technical constraints matter. Do not trace it, upscale it, or match its macro-composition. A successful result should look like a different authored texture for the same gameplay material, not the old texture rendered at higher resolution.

Keep only the constraints required for game function: same asset role and face/orientation, tileability when needed, transparency/occupied regions only where alpha is functionally meaningful, and exact frame topology/order/loop continuity for animation assets.

Within those limits, take strong creative ownership. Invent new natural structure at both large and small scales. You may change material rhythm, color balance, crack placement, mineral/organic distribution, grain flow, scars, weathering, age, contamination, moisture, erosion and microstructure if the result remains believable and recognizable as the intended material.

Art direction: grounded dark-fantasy realism with a strong sense of place and history. Prefer bold but plausible material storytelling, natural irregularity and asymmetry over safe generic realism or source-matching.

Do not turn the texture into a scene, illustration, object render or perspective view. Keep it game-ready and materially flat.`;



function creativeP0PromptFor(x){
 const direction=P0_CREATIVE_DIRECTIONS[x.id];
 if(!direction)return null;
 const base=P0_PROMPT_LIBRARY[x.id];
 return {
   id:x.id,
   label:(base?.label||x.name)+' — Creative',
   text:`${P0_CREATIVE_BASE}

TEXTURE:
ID: ${x.id}
File: ${x.name}
Path: ${x.path}

ART DIRECTION:
${direction}`,
   source:'P0 yaratıcı alternatif'
 };
}
function applyCreativeOutputRequirements(text,x){
 let out=String(text||'').trimEnd();
 const n=(x.name||'').toLowerCase();
 const fullSquareMaterial=x.w===x.h&&!isAnimatedStrip(x)&&!/(leav|foliage|overlay|glass|plant|sapling|vine|grass_side)/.test(n);
 out+=`

TECHNICAL LOCK:
Preserve the source image dimensions and the asset's gameplay function. Preserve transparency only where it is functionally meaningful. Do not add a separate background or scene outside the texture.
${fullSquareMaterial?'MACRO-COMPOSITION RESET: This full-square material texture should NOT preserve the original large-scale spatial arrangement. Generate a new distribution of major forms, cracks, stains, grain masses, knots, stones, veins, tonal islands and focal features. Similarity should come from material identity and gameplay role, not from matching the old layout.':''}
${isAnimatedStrip(x)?'Preserve the exact animation frame count, frame order, cell boundaries and loop continuity, but redesign the visual content within each frame rather than reproducing the source frame shapes.':''}`;
 return out;
}

const PROMPT_OVERRIDES=new Map();
const PROMPT_KEY='mts:promptOverrides:v1';
function loadPromptOverrides(){try{const raw=localStorage.getItem(PROMPT_KEY);if(!raw)return;const o=JSON.parse(raw);for(const [id,prompt] of Object.entries(o))if(typeof prompt==='string')PROMPT_OVERRIDES.set(id,prompt)}catch(e){console.warn('prompt overrides not persisted',e)}}
function savePromptOverrides(){try{localStorage.setItem(PROMPT_KEY,JSON.stringify(Object.fromEntries(PROMPT_OVERRIDES)))}catch(e){console.warn('prompt override save failed',e)}}
function textureMeta(id){return CATALOG.find(x=>x.id===id)}
function materialHints(x){const n=x.name.toLowerCase(),p=x.path.toLowerCase();let kind='game texture',detail='Preserve its exact functional role and infer the physical material from the filename and source image.';
 if(/ore/.test(n)){kind='ore-bearing stone';detail='Keep the host rock dominant and embed the named mineral as natural veins/deposits with restrained contrast; never floating, glowing, or pasted on.'}
 else if(/plank|wood/.test(n)){kind='crafted wood';detail='Use species-appropriate continuous grain, aged board wear, muted dark-fantasy weathering, and clear construction rhythm without furniture gloss.'}
 else if(/log|tree/.test(n)&&/top/.test(n)){kind='log end grain';detail='Use organic non-geometric growth rings, natural end-grain fibers, restrained radial cracks, and species-appropriate aging.'}
 else if(/log|tree/.test(n)){kind='tree bark';detail='Use species-appropriate continuous bark structure, directional rhythm, aged fissures, dirt/staining, and restrained environmental weathering.'}
 else if(/leav|leaf/.test(n)){kind='foliage';detail='Preserve alpha-mask logic and density while creating dense natural foliage, muted greens, age discoloration, and restrained branch hints.'}
 else if(/grass/.test(n)){kind='grass/groundcover';detail='Use dense short weathered groundcover, muted olive/forest greens, subtle exposed soil, and preserve any overlay transparency logic.'}
 else if(/sand/.test(n)){kind='sand';detail='Use compact fine grains, muted mineral variation, slight dirt contamination, and calm block-scale readability.'}
 else if(/gravel/.test(n)){kind='gravel';detail='Use dense small-to-medium mineral fragments, varied angular/rounded pieces, fine grit filler, and restrained dark-fantasy aging.'}
 else if(/ice/.test(n)){kind='ice';detail='Use muted blue-gray translucent ice, cloudy inclusions, fine fractures, trapped bubbles, dirt/mineral staining, and no decorative crystal gloss.'}
 else if(/snow/.test(n)){kind='snow';detail='Use compact aged off-white/blue-gray snow, subtle frost crust, dirty mineral specks, matte crystalline microtexture, and no scene-like piles.'}
 else if(/cobble|brick|blackstone|deepslate|tuff|basalt/.test(n)){kind='rough stone';detail='Use segmented old stone masses, worn edges, shallow joints, mineral staining, restrained dirt/moss residue, and no perfect clean masonry unless source demands it.'}
 else if(/stone|bedrock|granite|diorite|andesite/.test(n)){kind='natural stone';detail='Use continuous aged mineral structure, cool/earthy muted variation, fine granular detail, shallow fractures, and a calm foundational surface.'}
 else if(x.animated||x.w!==x.h){kind='animated/sprite strip';detail='PRESERVE exact strip dimensions, frame count/order/boundaries, transparency, and animation layout. Edit material appearance only; never merge or reorder frames.'}
 return {kind,detail}}
function generatedPromptFor(x){const h=materialHints(x);return `${COMMON_PROMPT}

ASSET-SPECIFIC TARGET:
Texture ID: ${x.id}
File: ${x.name}
Path: ${x.path}
Material/function: ${h.kind}.
${h.detail}

Make this specific texture feel individually authored for the same grounded dark-fantasy world: ancient, muted, tactile, slightly dirty/weathered, physically believable, seamless where applicable, and never HD pixel art.`}
const COMMON_PROMPT="Use the provided texture only as a structural, tonal, directional, transparency, and material reference where relevant.\n\nPreserve the source texture's gameplay function, broad composition, overall density, broad light/dark distribution, characteristic color family, and transparency/animation logic where applicable.\n\nDO NOT preserve or upscale the original pixel shapes.\nDO NOT imitate pixel art.\nDO NOT create enlarged square pixels, blocky brush strokes, voxel-like surface detail, or stylized game-art shading.\nReplace the low-resolution pixel information with continuous natural material detail.\n\nSTYLE TARGET:\ngrounded dark-fantasy material realism.\nThe material should feel ancient, weathered, somber, muted, tactile, natural, slightly dirty or environmentally aged where appropriate, and physically believable.\nUse soft diffuse lighting, low-to-medium contrast, restrained saturation, realistic micro-detail, and subtle weathering.\nThe realism should feel cinematic and dark, but never like a clean stock photograph and never like HD pixel art.\n\nKeep the texture flat and game-ready. Preserve readability at block distance. Avoid perspective, scene context, strong baked directional lighting, glossy highlights, fantasy glow, extreme fake 3D relief, and excessive photographic noise.\nWhen realism conflicts with gameplay readability, source identity, transparency, animation layout, or tileability, those functional constraints win.";





function isAnimatedStrip(x){return !!(x&&!isArmorUvTexture(x)&&assetTypeOf(x)!=='Entity'&&x.w&&x.h&&((x.h>x.w&&x.h%x.w===0)||(x.w>x.h&&x.w%x.h===0)))}
function animSpec(x){
 if(!isAnimatedStrip(x)) return null;
 const vertical=x.h>=x.w, frame=vertical?x.w:x.h, frames=vertical?Math.round(x.h/x.w):Math.round(x.w/x.h);
 const cols=Math.ceil(Math.sqrt(frames)), rows=Math.ceil(frames/cols);
 return {vertical,frame,frames,cols,rows,atlasW:cols*frame,atlasH:rows*frame};
}
function animatedFamily(x){const n=(x.name||'').toLowerCase(); if(n.includes('lava')) return 'lava'; if(n.includes('water')) return 'water'; if(n.includes('fire')) return 'fire'; return 'generic';}
function animatedAtlasPromptFor(x){
 const s=animSpec(x); if(!s) return null;
 const fam=animatedFamily(x);
 const material = fam==='lava' ? 'animated lava surface' : fam==='water' ? 'animated water surface' : fam==='fire' ? 'animated fire / flame' : 'animated material surface';
 const motion = fam==='lava' ? 'slow viscous flow, glowing hot channels, heavy molten movement' : fam==='water' ? 'gentle flowing ripple motion, coherent liquid drift, soft turbulence' : fam==='fire' ? 'upward flicker, heat turbulence, living flame rhythm' : 'coherent looping motion across consecutive frames';
 const avoid = fam==='lava' ? 'Avoid smoke, scene lighting, sparks outside the frame, random frame-to-frame style changes, and inconsistent glow.' : fam==='water' ? 'Avoid splash scenes, horizon reflections, foam overload, or random frame-to-frame style shifts.' : 'Avoid scene composition, camera changes, random frame-to-frame style shifts, and decorative background elements.';
 return {label:'Animated '+material, source:'animasyon atlası', text:`Edit the provided image as an animation atlas, not as a single texture. Each square cell is one animation frame. Preserve the exact frame count, frame order, grid layout, and cell boundaries. The atlas contains ${s.frames} frames arranged in a ${s.cols}×${s.rows} grid, read left-to-right and top-to-bottom. Do not merge adjacent cells. Do not change the number of frames.

Use the provided image only as a structural, motion, and material reference. Preserve the source texture's gameplay function, overall motion character, and looping logic. Replace the low-resolution pixel information with continuous natural detail.

Render it as ${material} in grounded dark-fantasy material realism. The material should feel ancient, weathered, somber, muted, tactile, and physically believable. Use soft diffuse lighting, controlled contrast, and seamless per-frame readability. Create ${motion}. Keep neighboring frames closely related so the animation loops cleanly.

If realism conflicts with animation clarity, animation clarity wins. If detail conflicts with loop consistency, loop consistency wins. Keep the output flat, atlas-like, square-celled, and suitable for conversion back into a strip animation. ${avoid}`};
}

function missingPromptFor(x){return {label:'PROMPT YOK',text:`Bu texture için henüz özel prompt yazılmadı.

Texture ID: ${x.id}
File: ${x.name}
Path: ${x.path}

Fallback kaldırıldı. Bu asset için özel prompt eklenmeden kullanma.`,source:'eksik'}}
function defaultPromptFor(x){const ap=animatedAtlasPromptFor(x);if(ap)return ap;const p0=P0_PROMPT_LIBRARY[x.id];if(p0)return {label:p0.label,text:p0.prompt,source:'P0 özel'};if(x.priority==='P1')return {label:materialHints(x).kind,text:generatedPromptFor(x),source:'P1 değişkenli'};return missingPromptFor(x)}
let animTimer=null, animPlaying=true;
function stopAnim(){ if(animTimer){ clearInterval(animTimer); animTimer=null; } }
function actualStripFrameInfo(src,spec){
 const long=spec.vertical?src.height:src.width;
 const cross=spec.vertical?src.width:src.height;
 const along=Math.floor(long/spec.frames);
 const frame=Math.max(1,Math.min(cross,along));
 const trimCross=Math.max(0,Math.floor((cross-frame)/2));
 const trimLong=Math.max(0,Math.floor((long-frame*spec.frames)/2));
 return {frame,trimCross,trimLong};
}
async function stripBlobToAtlasBlob(blob, meta){
 const spec=animSpec(meta); if(!spec) throw Error('Animasyon strip değil');
 const src=await decodeBlobToCanvas(blob);
 const actual=actualStripFrameInfo(src,spec);
 const out=document.createElement('canvas'); out.width=spec.cols*actual.frame; out.height=spec.rows*actual.frame;
 const g=out.getContext('2d'); g.clearRect(0,0,out.width,out.height);
 for(let i=0;i<spec.frames;i++){
   const sx=spec.vertical?actual.trimCross:actual.trimLong+i*actual.frame;
   const sy=spec.vertical?actual.trimLong+i*actual.frame:actual.trimCross;
   const dx=(i%spec.cols)*actual.frame, dy=Math.floor(i/spec.cols)*actual.frame;
   g.drawImage(src,sx,sy,actual.frame,actual.frame,dx,dy,actual.frame,actual.frame);
 }
 return await canvasPngBlob(out);
}
async function atlasBlobToStripBlob(blob, meta){
 const spec=animSpec(meta); if(!spec) throw Error('Animasyon strip değil');
 const src=await decodeBlobToCanvas(blob);
 if(src.width<spec.cols || src.height<spec.rows) throw Error(`Atlas çözümlenemedi. Beklenen en az ${spec.cols}×${spec.rows} hücre.`);
 const cellW=Math.floor(src.width/spec.cols), cellH=Math.floor(src.height/spec.rows);
 if(cellW<1 || cellH<1) throw Error('Atlas hücre boyutu hesaplanamadı');
 const usedW=cellW*spec.cols, usedH=cellH*spec.rows;
 const trimX=Math.floor((src.width-usedW)/2), trimY=Math.floor((src.height-usedH)/2);
 const frameOut=Math.max(1,Math.min(cellW,cellH));
 const out=document.createElement('canvas');
 out.width=spec.vertical?frameOut:frameOut*spec.frames;
 out.height=spec.vertical?frameOut*spec.frames:frameOut;
 const g=out.getContext('2d');
 g.clearRect(0,0,out.width,out.height); g.imageSmoothingEnabled=true; g.imageSmoothingQuality='high';
 for(let i=0;i<spec.frames;i++){
   const sx=trimX+(i%spec.cols)*cellW, sy=trimY+Math.floor(i/spec.cols)*cellH;
   const dx=spec.vertical?0:i*frameOut, dy=spec.vertical?i*frameOut:0;
   g.drawImage(src,sx,sy,cellW,cellH,dx,dy,frameOut,frameOut);
 }
 return await canvasPngBlob(out);
}
async function refreshAnimPreview(){
 stopAnim();
 const box=$('animBox'); if(!active||!isAnimatedStrip(active)){ box.classList.remove('show'); return; }
 box.classList.add('show');
 const spec=animSpec(active);
 const blob=await displayBlob(active.path);
 const src=await decodeBlobToCanvas(blob);
 const actual=actualStripFrameInfo(src,spec);
 $('animMeta').textContent=`${spec.frames} frame • ${actual.frame}×${actual.frame} • atlas ${spec.cols}×${spec.rows}`;
 $('animHint').textContent='Uzun stripi GPT için kare atlas olarak dışa aktar. Düzenlenmiş atlası geri yüklediğinde uygulama onu tekrar aynı frame sırasına çevirir. Canlı önizleme kaydedilmiş stripin gerçek frame çözünürlüğünü otomatik algılar.';
 const c=$('animCanvas'), ctx=c.getContext('2d'); c.width=actual.frame; c.height=actual.frame; ctx.clearRect(0,0,c.width,c.height);
 let f=0;
 const draw=()=>{
   const sx=spec.vertical?actual.trimCross:actual.trimLong+f*actual.frame;
   const sy=spec.vertical?actual.trimLong+f*actual.frame:actual.trimCross;
   ctx.clearRect(0,0,c.width,c.height);
   ctx.drawImage(src,sx,sy,actual.frame,actual.frame,0,0,c.width,c.height);
 };
 draw(); animPlaying=true; $('animToggle').textContent='Durdur';
 animTimer=setInterval(()=>{ if(!animPlaying)return; f=(f+1)%spec.frames; draw(); },140);
}

const TRANSPARENCY_OUTPUT_MARKER='ALPHA / BACKGROUND LOCK:';
const ENTITY_TRANSPARENCY_MARKER='UV / ALPHA LOCK:';
const TRANSPARENCY_OUTPUT_REQUIREMENT=`ALPHA / BACKGROUND LOCK:
Treat the source alpha channel as locked structural data, not as an area to redesign.
Do not create new transparency and do not remove existing transparency.
Pixels/regions that are transparent in the source must remain transparent; pixels/regions that are opaque in the source must remain occupied.
Preserve the source silhouette and alpha-edge coordinates exactly. Do not expand, contract, feather, blur, soften, round, anti-alias, or reinterpret mask boundaries.
Do not add a white, black, colored, scenic, shadow, glow, or environmental background.
Material/detail changes must stay strictly inside the source occupied mask.
When transparency conflicts with shape fidelity, the ORIGINAL SOURCE MASK AND BOUNDARIES WIN.`;

const ENTITY_TRANSPARENCY_REQUIREMENT=`UV / ALPHA LOCK:
Keep the original UV layout and source alpha mask EXACTLY unchanged. Do not redraw, regenerate, expand, shrink, soften, or reinterpret island edges or transparency.
Edit RGB/material appearance only inside the existing occupied source pixels. Do not move, resize, rotate, warp, merge, split, or repack UV islands.
Outside the original occupied mask must remain transparent. Do not add any background.
If realism conflicts with the source UV geometry, the source UV geometry wins.`;

function applyPromptOutputRequirements(text,x){
 let out=tintPromptText(String(text||'').trimEnd(),x);
 if(isRuntimeTintTexture(x)&&!out.includes('RUNTIME TINT / COLOR MASK LOCK:'))out+='\n\n'+RUNTIME_TINT_PROMPT_LOCK;
 if(assetTypeOf(x)==='Entity'){
   if(!out.includes(ENTITY_TRANSPARENCY_MARKER)) out+='\n\n'+ENTITY_TRANSPARENCY_REQUIREMENT;
   return out;
 }
 if(!out.includes(TRANSPARENCY_OUTPUT_MARKER)) out+='\n\n'+TRANSPARENCY_OUTPUT_REQUIREMENT;
 return out;
}
const MOB_UV_PATHS=new Set();
const ARMOR_UV_PATHS=new Set();
fetch('prompts/armor/manifest.json',{cache:'no-cache'}).then(r=>r.ok?r.json():null).then(m=>{for(const e of (m?.entries||[]))ARMOR_UV_PATHS.add(e.texture_path)}).catch(e=>console.warn('Armor manifest yüklenemedi',e));
fetch('prompts/mobs/manifest.json',{cache:'no-cache'}).then(r=>r.ok?r.json():null).then(m=>{for(const e of (m?.entries||[]))MOB_UV_PATHS.add(e.texture_path)}).catch(e=>console.warn('Mobs manifest yüklenemedi',e));
function isMobUvTexture(x){return !!x&&MOB_UV_PATHS.has(x.path)}
function isArmorUvTexture(x){return !!x&&ARMOR_UV_PATHS.has(x.path)}
function isThreeStageUvTexture(x){return isMobUvTexture(x)||isArmorUvTexture(x)}
function mobPromptMeta(x){
 const ri=runtimeRoleInfo(x),armor=isArmorUvTexture(x),raw=String(x.name||'').replace(/\.png$/i,'').replace(/^(extra_mobs_|mobs_mc_|mcl_armor_)/,'');
 if(armor){const part=(raw.match(/^(boots|chestplate|helmet|leggings)_/)||[])[1]||'armor',mat=raw.replace(/^(boots|chestplate|helmet|leggings)_/,'').replace(/_/g,' ');return {name:mat+' '+part,role:'Worn Player Armor UV Atlas',model:'player armor model',material:mat==='chain'?'interlinked aged metal chainmail with darkened recesses and worn edges':mat.includes('leather')?'worked leather armor with grain, seams, creasing and restrained wear; keep desaturated variants tint-friendly where applicable':mat==='diamond'?'hard blue-cyan diamond armor material with crystalline density, cut facets and restrained mineral variation':mat==='gold'?'aged forged gold armor with warm dense metal, fine scratches and restrained tarnish':mat==='iron'?'forged iron armor with cool gray metal, hammering, edge wear and restrained oxidation':mat==='copper'?'forged copper armor with warm red-brown metal and subtle natural oxidation/patina':mat==='netherite'?'extremely dense dark netherite armor, charcoal metallic body with heat-forged texture and restrained ancient wear':'physically believable armor material'};}

 const name=raw.replace(/_/g,' ').trim(),role=ri.role||'Entity UV texture',model=ri.model&&ri.model!=='unknown'&&ri.model!=='none'?ri.model:'the linked entity model';
 let material='biologically appropriate skin, fur, scales, feathers, cloth, armor, bone or other surface materials';
 if(/cod|salmon|fish|puffer|squid|guardian|dolphin|axolotl/.test(raw))material='aquatic skin, scales, fins and other species-appropriate wet biological surfaces';
 else if(/wolf|cat|rabbit|llama|polar|cow|sheep|horse|mule|donkey/.test(raw))material='species-appropriate fur, hair, hide and exposed biological surfaces';
 else if(/chicken|parrot/.test(raw))material='species-appropriate feathers, keratin, skin and beak or leg surfaces';
 else if(/skeleton|wither_skeleton/.test(raw))material='aged bone and any UV-mapped equipment or material surfaces';
 else if(/zombie|drowned|husk|zombified/.test(raw))material=/piglin/.test(raw)?'zombified fantasy piglin game-character skin with muted weathered coloration and any existing UV-mapped clothing or equipment materials':'zombified fantasy game-character skin with muted weathered coloration and any existing UV-mapped clothing or equipment materials';
 else if(/piglin/.test(raw))material='coarse porcine humanoid skin and UV-mapped clothing or equipment materials';
 else if(/creeper|slime|magmacube|enderman|endermite|shulker|blaze|vex|ghast|wither/.test(raw))material='creature-specific supernatural or organic material surfaces appropriate to this entity';
 return {name,role,model,material};
}
function mobHqUvPromptFor(x){const m=mobPromptMeta(x);return 'EDIT THE PROVIDED ENTITY TEXTURE / UV ATLAS.\n\nASSET: '+m.name+'\nRUNTIME ROLE: '+m.role+'\nMODEL CONTEXT: '+m.model+'\n\nThe provided image is the STRUCTURAL MASTER REFERENCE.\n\nABSOLUTE PRIORITY:\nPreserve the exact canvas and UV topology: every island position, island size, orientation, spacing, occupied region, transparent region, internal cutout, anatomical assignment, marking placement and layer alignment must remain coordinate-locked. Treat every occupied UV region as a locked mask. Do not move, rotate, resize, merge, split, crop, repack, expand, shrink, blur or reinterpret any UV island.\n\nThis is a SURFACE / MATERIAL RECONSTRUCTION ONLY, not a creature redesign. Preserve the identity and variant/state/layer meaning of '+m.name+'. Preserve all source landmarks needed for the texture to map correctly onto '+m.model+'.\n\nReplace low-resolution pixel information with continuous high-quality '+m.material+'. Resolve tiny ambiguous source regions conservatively from their existing placement; never invent anatomy to fill uncertainty.\n\nSTYLE:\nGrounded dark-fantasy material realism; physically believable, somber and restrained. Soft diffuse illumination, restrained saturation, natural micro-detail and subtle age/weathering. No scene lighting, perspective, background, cute redesign, exaggerated horror redesign, glossy toy finish or HD-pixel-art imitation.\n\nOUTPUT:\nOnly the completed high-resolution UV atlas on the exact original layout. No rendered creature, labels, guides, scene or background.'}
function mobCreatureRefPromptFor(x){const m=mobPromptMeta(x);return 'Create a high-quality visual MATERIAL REFERENCE for the creature/variant represented by "'+m.name+'".\n\nThis is reference art for a later UV-texture transfer, NOT a UV map and NOT a Minecraft-style render.\n\nIDENTITY / VARIANT:\n'+m.name+'\nRuntime role: '+m.role+'.\n\nShow the creature or relevant wearable/material layer clearly enough that its important surface identity can be understood: species-appropriate anatomy, pigmentation, markings, '+m.material+', age, wear and material transitions.\n\nART DIRECTION:\nGrounded dark-fantasy realism. Ancient, weathered, somber and physically believable; restrained saturation; soft diffuse neutral lighting; tactile natural surfaces; controlled micro-detail. Keep the entity recognizable rather than redesigning it into a different creature.\n\nREFERENCE QUALITY:\nPrioritize readable material information and color relationships over dramatic composition. Avoid heavy shadows, colored cinematic lighting, depth-of-field obscuring surfaces, action poses that hide major body regions, glossy toy surfaces, cartoon styling, pixel art, voxel styling, text, UI, diagrams or UV layouts.\n\nUse a simple neutral unobtrusive background. The image should function as a clean appearance/material reference for transferring the look onto an already-correct UV atlas.'}
function mobFinalUvPromptFor(x){const m=mobPromptMeta(x);return 'Image A is the already high-quality, structurally correct UV atlas for "'+m.name+'" produced by the strict HQ UV pass.\nImage B is the dominant creature/material reference for the same identity or compatible variant.\n\nRUNTIME ROLE: '+m.role+'\nMODEL CONTEXT: '+m.model+'\n\nIMAGE A IS THE ABSOLUTE STRUCTURAL MASTER.\nPreserve its exact canvas, UV island positions, sizes, orientations, spacing, occupied/transparent regions, internal cutouts, anatomical assignments, markings and layer alignment. Do not move, rotate, resize, merge, split, crop, extend, shrink, blur, repack or reinterpret UV regions. Do not re-solve anatomy.\n\nIMAGE B CONTROLS APPEARANCE ONLY.\nTransfer the compatible material language from Image B into the already-correct surfaces of Image A: '+m.material+', pigmentation, color relationships, tactile micro-detail, natural variation, age and weathering. Do not copy Image B pose, perspective, silhouette, background or scene lighting. Do not invent anatomy or markings that conflict with Image A UV assignments.\n\nKeep the result grounded dark-fantasy realism with restrained saturation and believable material response. Preserve rich detail right up to occupied-region boundaries without changing those boundaries.\n\nFINAL PRIORITY:\n1. Exact HQ UV structure/anatomical mapping from Image A.\n2. Identity, variant/state/layer meaning of '+m.name+'.\n3. Compatible material/style information from Image B.\n4. No structural invention.\n\nOUTPUT ONLY the completed UV atlas.'}
async function copyMobPrompt(kind){if(!active||!isThreeStageUvTexture(active))return;const t=tintPromptText(kind==='hq'?mobHqUvPromptFor(active):kind==='ref'?referencePromptFor(active):mobFinalUvPromptFor(active),active)+(isRuntimeTintTexture(active)?'\n\n'+RUNTIME_TINT_PROMPT_LOCK:'');try{await navigator.clipboard.writeText(t)}catch{const ta=document.createElement('textarea');ta.value=t;document.body.appendChild(ta);ta.select();document.execCommand('copy');ta.remove()}toast(kind==='hq'?'HQ UV promptu kopyalandı':kind==='ref'?(isArmorUvTexture(active)?'Armor Ref promptu kopyalandı':'Creature Ref promptu kopyalandı'):'Final UV promptu kopyalandı')}

let promptViewMode='classic';
function promptFor(x,mode='classic'){
 if(mode==='creative'){
   const c=creativeP0PromptFor(x);
   if(c)return {id:x.id,label:c.label,text:applyCreativeOutputRequirements(c.text,x),source:c.source};
 }
 const d=defaultPromptFor(x),o=PROMPT_OVERRIDES.get(x.id);
 return {id:x.id,label:d.label,text:applyPromptOutputRequirements(o||d.text,x),source:o?'JSON/özel':d.source};
}
function promptEntry(x,mode='classic'){const p=promptFor(x,mode);return {id:x.id,path:x.path,name:x.name,priority:x.priority,label:p.label,prompt:p.text,mode}}
function renderActivePrompt(){
 if(!active)return;
 promptViewMode='classic';
 const p=promptFor(active,'classic');
 $('promptFamily').textContent=(p.label||p.family||'Prompt')+(p.source?' · '+p.source:'');
 $('promptText').value=p.text;
 const isMob=isMobUvTexture(active),isArmor=isArmorUvTexture(active),isUv=isMob||isArmor,isP0=active.priority==='P0'&&!isUv;
 $('normalPromptBtns').style.display=isUv?'none':'';
 $('mobPromptBtns').classList.toggle('show',isUv);
 if(isUv){$('promptFamily').textContent=isArmor?'Armor · 3 aşamalı UV üretimi':'Mobs · 3 aşamalı UV üretimi';$('mobRefPrompt').textContent=isArmor?'2 · Armor Ref':'2 · Creature Ref';}
 $('copyPrompt').textContent=isP0?'Ref prompt':'Kopyala';
 $('savePrompt').textContent=isP0?'Üretim prompt':'Promptu kaydet';
 $('promptText').style.display=isP0?'none':'';
 $('singlePromptJson').style.display=isP0?'none':'';
 $('savePrompt').disabled=false;
 $('savePrompt').title=isP0?'Image A + Image B standart üretim promptunu kopyala':'';
}
function downloadJson(obj,name){dl(new Blob([JSON.stringify(obj,null,2)],{type:'application/json'}),name)}
function parsePromptPayload(obj){let arr;if(Array.isArray(obj))arr=obj;else if(obj&&Array.isArray(obj.prompts))arr=obj.prompts;else if(obj&&(obj.id||obj.path))arr=[obj];else throw Error('JSON formatı tanınmadı');let applied=0,missing=[];for(const e of arr){if(!e||typeof e.prompt!=='string')continue;let meta=null;if(typeof e.id==='string')meta=textureMeta(e.id);if(!meta&&typeof e.path==='string')meta=CATALOG.find(x=>x.path===e.path);if(!meta){missing.push(e.id||e.path||'(kimlik yok)');continue}PROMPT_OVERRIDES.set(meta.id,e.prompt);applied++}savePromptOverrides();return {applied,missing}}
function applyPromptJsonObject(obj){const r=parsePromptPayload(obj);toast(`${r.applied} prompt güncellendi${r.missing.length?' · '+r.missing.length+' ID bulunamadı':''}`);if(active)openDetail(active);return r}
let tileN=1,tileEdited=true;
async function updateTilePreview(){if(!active)return;const box=$('tilePreview');document.querySelectorAll('[data-tile]').forEach(b=>b.classList.toggle('active',Number(b.dataset.tile)===tileN));if(tileN===1){box.classList.remove('show');$('preview').style.display='block';return}$('preview').style.display='none';box.classList.add('show');const url=await blobUrl(active.path,tileEdited);box.style.backgroundImage=`url("${url}")`;box.style.backgroundSize=`${100/tileN}% ${100/tileN}%`;box.style.backgroundPosition='0 0';}

let previewView={scale:1,x:0,y:0,pointers:new Map(),lastDist:0,lastMid:null,lastTap:0};
function applyPreviewView(){const t=`translate(${previewView.x}px,${previewView.y}px) scale(${previewView.scale})`;$('origImg').style.transform=t;$('editImg').style.transform=t}
function resetPreviewView(){previewView.scale=1;previewView.x=0;previewView.y=0;previewView.pointers.clear();previewView.lastDist=0;previewView.lastMid=null;applyPreviewView()}
function bindPreviewGestures(){const el=$('preview');if(el.dataset.gestures)return;el.dataset.gestures='1';
 const pts=()=>[...previewView.pointers.values()];
 el.addEventListener('pointerdown',e=>{el.setPointerCapture(e.pointerId);previewView.pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});const now=Date.now();if(now-previewView.lastTap<300){resetPreviewView();previewView.lastTap=0}else previewView.lastTap=now});
 el.addEventListener('pointermove',e=>{if(!previewView.pointers.has(e.pointerId))return;const old=previewView.pointers.get(e.pointerId);previewView.pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});const p=pts();
   if(p.length===1&&previewView.scale>1){previewView.x+=e.clientX-old.x;previewView.y+=e.clientY-old.y}
   else if(p.length>=2){const a=p[0],b=p[1],dist=Math.hypot(b.x-a.x,b.y-a.y),mid={x:(a.x+b.x)/2,y:(a.y+b.y)/2};if(previewView.lastDist){const ns=Math.max(1,Math.min(12,previewView.scale*dist/previewView.lastDist));const rect=el.getBoundingClientRect(),mx=mid.x-rect.left,my=mid.y-rect.top,k=ns/previewView.scale;previewView.x=mx-(mx-previewView.x)*k;previewView.y=my-(my-previewView.y)*k;previewView.scale=ns}previewView.lastDist=dist;previewView.lastMid=mid}
   applyPreviewView();e.preventDefault()});
 const end=e=>{previewView.pointers.delete(e.pointerId);if(previewView.pointers.size<2){previewView.lastDist=0;previewView.lastMid=null}if(previewView.scale<=1)resetPreviewView()};
 el.addEventListener('pointerup',end);el.addEventListener('pointercancel',end);
 el.addEventListener('wheel',e=>{e.preventDefault();const rect=el.getBoundingClientRect(),mx=e.clientX-rect.left,my=e.clientY-rect.top,ns=Math.max(1,Math.min(12,previewView.scale*(e.deltaY<0?1.15:.87))),k=ns/previewView.scale;previewView.x=mx-(mx-previewView.x)*k;previewView.y=my-(my-previewView.y)*k;previewView.scale=ns;if(ns===1){previewView.x=previewView.y=0}applyPreviewView()},{passive:false});
}
bindPreviewGestures();
const MINECLONIA_COMMIT='209ec2dc96adbf7f5ba083816d90596492ec53b5';
function closeDetailSheet(){stopAnim();resetPreviewView();$('sheet').classList.remove('open');active=null;}
function bindDetailSheetEvents(){
  const closeBtn=$('close');
  if(closeBtn){
    closeBtn.onclick=e=>{e.preventDefault();e.stopPropagation();closeDetailSheet()};
  }
  const sheet=$('sheet');
  if(sheet){
    sheet.onclick=e=>{if(e.target===sheet){e.preventDefault();closeDetailSheet()}};
  }
  document.addEventListener('keydown',e=>{if(e.key==='Escape'&&$('sheet').classList.contains('open'))closeDetailSheet()});
}
async function openDetail(x){active=x;resetPreviewView();const ri=runtimeRoleInfo(x);$('detailName').textContent=`${x.priority} · ${x.name}`;$('detailPath').textContent=`${x.path} · ${x.w}×${x.h}${isAnimatedStrip(x)?' · animated strip':''}`;$('detailRole').textContent='Rol: '+ri.role+(ri.model?' · Model: '+ri.model:'')+(ri.evidence?' · Kaynak: '+ri.evidence:'');$('origImg').src=await previewUrl(x.path,false,EDITOR_PREVIEW_MAX_EDGE);const edit=await getEdit(x.path);$('editImg').src=edit?await previewUrl(x.path,true,EDITOR_PREVIEW_MAX_EDGE):$('origImg').src;$('editImg').style.opacity=edit?1:.35;$('compare').value=edit?50:100;updateCompare();promptViewMode='classic';$('textureId').textContent='ID: '+x.id;renderActivePrompt();$('hint').textContent=isAnimatedStrip(x)?'Bu asset uzun bir animasyon stripidir. Seam offset kapalıdır. GPT için “Strip → Kare atlas” kullan; düzenlenmiş atlası geri yüklediğinde uygulama onu tekrar aynı strip düzenine çevirir.':'Seam düzenleme: “50% Offset PNG” kenar birleşimlerini merkeze taşır. Bu PNG’yi düzenletip “Offset düzenlemeyi geri yükle” ile içe aktar; uygulama aynı yarım kaydırmayı tekrar uygulayıp gerçek tile düzenine döndürür.';$('seamExport').disabled=assetTypeOf(x)==='Entity'||isAnimatedStrip(x)||x.w!==x.h;$('seamImport').disabled=assetTypeOf(x)==='Entity'||isAnimatedStrip(x)||x.w!==x.h;tileN=1;tileEdited=!!edit;$('tileSource').textContent=tileEdited?'Yeni':'Orijinal';$('tilePreview').classList.remove('show');$('preview').style.display='block';$('sheet').classList.add('open');await refreshAnimPreview()}
function updateCompare(){const v=Number($('compare').value);$('editImg').style.clipPath=`inset(0 0 0 ${100-v}%)`}
function dl(blob,name){const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=name;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(a.href),1500)}

const RESOLUTION_KEY='mineclonia_texture_target_resolution_v1';
let TARGET_RESOLUTION=256;
try{const saved=Number(localStorage.getItem(RESOLUTION_KEY));if([64,128,256,512].includes(saved))TARGET_RESOLUTION=saved}catch(e){}
function sinc(x){if(Math.abs(x)<1e-8)return 1;const p=Math.PI*x;return Math.sin(p)/p}
function lanczosKernel(x,a=3){x=Math.abs(x);return x<a?sinc(x)*sinc(x/a):0}
function buildContrib(srcN,dstN,a=3){
 const scale=srcN/dstN, widen=Math.max(1,scale), support=a*widen, all=new Array(dstN);
 for(let d=0;d<dstN;d++){
   const center=(d+.5)*scale-.5, left=Math.ceil(center-support), right=Math.floor(center+support), list=[];let sum=0;
   for(let i=left;i<=right;i++){
     const clamped=Math.max(0,Math.min(srcN-1,i));
     const w=lanczosKernel((i-center)/widen,a);
     if(Math.abs(w)>1e-8){list.push([clamped,w]);sum+=w}
   }
   if(Math.abs(sum)<1e-8){const n=Math.max(0,Math.min(srcN-1,Math.round(center)));all[d]=[[n,1]]}
   else{for(const p of list)p[1]/=sum;all[d]=list}
 }
 return all
}
function lanczosResizeImageData(src,sw,sh,dw,dh){
 const srcD=src.data, hx=buildContrib(sw,dw,3), hy=buildContrib(sh,dh,3);
 // premultiplied RGBA intermediate prevents dark/bright halos around transparent edges
 const mid=new Float32Array(dw*sh*4);
 for(let y=0;y<sh;y++)for(let x=0;x<dw;x++){
   let pr=0,pg=0,pb=0,pa=0;const list=hx[x];
   for(let k=0;k<list.length;k++){
     const sx=list[k][0],w=list[k][1],si=(y*sw+sx)*4,a=srcD[si+3]/255;
     pr+=srcD[si]*a*w;pg+=srcD[si+1]*a*w;pb+=srcD[si+2]*a*w;pa+=a*w;
   }
   const mi=(y*dw+x)*4;mid[mi]=pr;mid[mi+1]=pg;mid[mi+2]=pb;mid[mi+3]=pa;
 }
 const out=new ImageData(dw,dh), od=out.data;
 for(let y=0;y<dh;y++)for(let x=0;x<dw;x++){
   let pr=0,pg=0,pb=0,pa=0;const list=hy[y];
   for(let k=0;k<list.length;k++){
     const sy=list[k][0],w=list[k][1],mi=(sy*dw+x)*4;
     pr+=mid[mi]*w;pg+=mid[mi+1]*w;pb+=mid[mi+2]*w;pa+=mid[mi+3]*w;
   }
   const oi=(y*dw+x)*4, aa=Math.max(0,Math.min(1,pa));
   od[oi+3]=Math.round(aa*255);
   if(aa>1e-6){od[oi]=Math.round(Math.max(0,Math.min(255,pr/aa)));od[oi+1]=Math.round(Math.max(0,Math.min(255,pg/aa)));od[oi+2]=Math.round(Math.max(0,Math.min(255,pb/aa)))}
   else{od[oi]=od[oi+1]=od[oi+2]=0}
 }
 return out
}
async function decodeBlobToCanvas(blob){
 const url=URL.createObjectURL(blob);try{
  const im=await new Promise((res,rej)=>{const x=new Image();x.onload=()=>res(x);x.onerror=()=>rej(Error('PNG okunamadı'));x.src=url});
  const c=document.createElement('canvas');c.width=im.naturalWidth;c.height=im.naturalHeight;const g=c.getContext('2d',{willReadFrequently:true});g.drawImage(im,0,0);return c
 }finally{URL.revokeObjectURL(url)}
}
async function canvasPngBlob(c){return await new Promise((res,rej)=>c.toBlob(b=>b?res(b):rej(Error('PNG oluşturulamadı')),'image/png'))}
async function normalizeTextureBlob(blob,meta){
 const c=await decodeBlobToCanvas(blob), sw=c.width, sh=c.height;
 const baseW=(meta&&meta.w)||sw, baseH=(meta&&meta.h)||sh;
 const dw=TARGET_RESOLUTION, dh=Math.max(1,Math.round(TARGET_RESOLUTION*(baseH/baseW)));
 if(sw<=dw && sh<=dh)return blob; // never upscale low-resolution originals
 const src=c.getContext('2d',{willReadFrequently:true}).getImageData(0,0,sw,sh);
 const resized=lanczosResizeImageData(src,sw,sh,dw,dh);
 const out=document.createElement('canvas');out.width=dw;out.height=dh;out.getContext('2d').putImageData(resized,0,0);
 return await canvasPngBlob(out)
}
async function lockEntityAlphaToSource(blob,meta){
 if(!meta||assetTypeOf(meta)!=='Entity')return blob;
 const [edited,sourceBlob]=await Promise.all([decodeBlobToCanvas(blob),originalBlob(meta.path)]);
 const source=await decodeBlobToCanvas(sourceBlob);
 const w=edited.width,h=edited.height;
 const mask=document.createElement('canvas');mask.width=w;mask.height=h;
 const mg=mask.getContext('2d',{willReadFrequently:true});mg.imageSmoothingEnabled=false;mg.clearRect(0,0,w,h);mg.drawImage(source,0,0,w,h);
 const eg=edited.getContext('2d',{willReadFrequently:true});
 const ed=eg.getImageData(0,0,w,h), md=mg.getImageData(0,0,w,h);
 for(let i=3;i<ed.data.length;i+=4)ed.data[i]=md.data[i];
 eg.putImageData(ed,0,0);
 return await canvasPngBlob(edited)
}
async function prepareVariantTextureBlob(blob,meta,targetRes=TARGET_RESOLUTION){
 let out=blob;
 // Variant Lab must preserve the uploaded PNG's own alpha so UV repair can compare
 // generated alpha geometry against the original alpha geometry.
 out=await normalizeTextureBlob(out,meta,targetRes);
 return out
}
async function prepareImportedTextureBlob(blob,meta,targetRes=TARGET_RESOLUTION){
 let out=await autoRemoveBorderBlackBackground(blob,meta);
 out=await normalizeTextureBlob(out,meta,targetRes);
 if(meta&&assetTypeOf(meta)==='Entity')out=await lockEntityAlphaToSource(out,meta);
 return out
}
async function prepareStoredEditBlob(blob,meta){
 let out=await autoRemoveBorderBlackBackground(blob,meta);
 if(meta&&assetTypeOf(meta)==='Entity')out=await lockEntityAlphaToSource(out,meta);
 return out
}
async function imageBlobTransform(blob, offset=false){return await new Promise((res,rej)=>{const u=URL.createObjectURL(blob),im=new Image();im.onload=()=>{const c=document.createElement('canvas');c.width=im.naturalWidth;c.height=im.naturalHeight;const g=c.getContext('2d');g.imageSmoothingEnabled=false;if(!offset){g.drawImage(im,0,0)}else{const w=c.width,h=c.height,dx=Math.floor(w/2),dy=Math.floor(h/2);g.drawImage(im, dx,dy);g.drawImage(im,dx-w,dy);g.drawImage(im,dx,dy-h);g.drawImage(im,dx-w,dy-h)}c.toBlob(b=>{URL.revokeObjectURL(u);b?res(b):rej(Error('PNG oluşturulamadı'))},'image/png')};im.onerror=()=>rej(Error('PNG okunamadı'));im.src=u})}
async function importPng(file,seam=false){if(!active||!file)return;toast(assetTypeOf(active)==='Entity'?'UV maskesi kaynaktan kilitleniyor…':'Yüksek kaliteli küçültme…');let b=await prepareImportedTextureBlob(file,active);if(seam)b=await imageBlobTransform(b,true);await putEdit(active.path,b);toast((seam?'Seam dönüşü':'Yeni texture')+(assetTypeOf(active)==='Entity'?' · kaynak alpha kilitli':' · '+TARGET_RESOLUTION+'px Lanczos-3 kaydedildi'));await openDetail(active);await applyFilter();setTimeout(()=>warmScaledForExisting(BACKGROUND_RESOLUTION).catch(console.warn),200)}
async function blobsEqual(a,b){
 if(!a||!b||a.size!==b.size)return false;
 const [aa,bb]=await Promise.all([a.arrayBuffer(),b.arrayBuffer()]);
 const av=new Uint8Array(aa),bv=new Uint8Array(bb);for(let i=0;i<av.length;i++)if(av[i]!==bv[i])return false;return true
}
async function texturePixelsEqual(a,b){
 if(!a||!b)return false;
 if(await blobsEqual(a,b))return true;
 const [ca,cb]=await Promise.all([decodeBlobToCanvas(a),decodeBlobToCanvas(b)]);
 if(ca.width!==cb.width||ca.height!==cb.height)return false;
 const ad=ca.getContext('2d',{willReadFrequently:true}).getImageData(0,0,ca.width,ca.height).data;
 const bd=cb.getContext('2d',{willReadFrequently:true}).getImageData(0,0,cb.width,cb.height).data;
 if(ad.length!==bd.length)return false;
 for(let i=0;i<ad.length;i++)if(ad[i]!==bd[i])return false;
 return true
}
async function texturePixelsVisuallyEquivalent(a,b){
 if(await texturePixelsEqual(a,b))return true;
 const [ca,cb]=await Promise.all([decodeBlobToCanvas(a),decodeBlobToCanvas(b)]);
 if(ca.width!==cb.width||ca.height!==cb.height)return false;
 const ad=ca.getContext('2d',{willReadFrequently:true}).getImageData(0,0,ca.width,ca.height).data;
 const bd=cb.getContext('2d',{willReadFrequently:true}).getImageData(0,0,cb.width,cb.height).data;
 let total=0,count=0,outliers=0;
 for(let i=0;i<ad.length;i+=4){
   const aa=ad[i+3],ba=bd[i+3],alphaDelta=Math.abs(aa-ba);
   total+=alphaDelta;count++;let maxDelta=alphaDelta;
   if(aa>2||ba>2){for(let c=0;c<3;c++){const d=Math.abs(ad[i+c]-bd[i+c]);total+=d;count++;if(d>maxDelta)maxDelta=d}}
   if(maxDelta>12)outliers++;
 }
 const mean=count?total/count:0,pixelCount=ad.length/4,outlierRatio=pixelCount?outliers/pixelCount:0;
 return mean<=2.5&&outlierRatio<=0.02;
}
async function textureMatchesOriginal(blob,meta,{throwOnError=false}={}){
 if(!blob||!meta)return false;
 try{
   const original=await originalBlob(meta.path);
   if(await texturePixelsEqual(blob,original))return true;
   const originalCanvas=await decodeBlobToCanvas(original);
   const nativeW=Math.max(1,Number(meta.w)||originalCanvas.width);
   const nativeH=Math.max(1,Number(meta.h)||originalCanvas.height);
   const [editedCanonical,originalCanonical]=await Promise.all([
     resizeTextureBlobToDimensions(blob,nativeW,nativeH),
     resizeTextureBlobToDimensions(original,nativeW,nativeH)
   ]);
   return await texturePixelsVisuallyEquivalent(editedCanonical,originalCanonical);
 }catch(err){
   if(throwOnError)throw err;
   console.warn('Orijinal karşılaştırması yapılamadı',meta.path,err);
   return false;
 }
}
async function meaningfulEdits(){
 const raw=await allEdits(), out=[];
 for(const e of raw){
   const meta=CATALOG.find(x=>x.path===e.path);if(!meta)continue;
   try{const orig=await originalBlob(e.path);if(!(await blobsEqual(e.blob,orig)))out.push(e)}catch(err){console.warn('Değişiklik karşılaştırılamadı',e.path,err);out.push(e)}
 }
 return out
}
async function exportPack(){
 const btn=$('exportPack'),oldLabel=btn.textContent;
 btn.disabled=true;btn.textContent='ZIP • kayıtlar hazırlanıyor…';setSaveState('ZIP hazırlanıyor…','warn');
 try{
   await editWriteQueue.catch(()=>{});
   const edits=(await allEdits()).filter(e=>CATALOG.some(x=>x.path===e.path));
   if(!edits.length){toast('Değiştirilmiş texture yok');return}
   const z=new JSZip();const root=z.folder('Mineclonia_Dark_Realism');
   root.file('texture_pack.conf','name = mineclonia_dark_realism\ntitle = Mineclonia Dark Realism\ndescription = Only user-modified Mineclonia textures. Original relative texture paths are preserved.\n');
   for(let i=0;i<edits.length;i++){
     const e=edits[i];root.file(e.path,e.blob,{compression:'STORE'});
     if(i===0||i===edits.length-1||i%20===0){btn.textContent=`ZIP • dosyalar ${i+1}/${edits.length}`;await new Promise(requestAnimationFrame)}
   }
   const manifest={format:'mineclonia-dark-realism-delta',version:3,createdAt:new Date().toISOString(),count:edits.length,targetResolution:TARGET_RESOLUTION,paths:edits.map(e=>e.path)};
   root.file('changed_textures.json',JSON.stringify(manifest,null,2),{compression:'STORE'});
   const out=await z.generateAsync({type:'blob',compression:'STORE',streamFiles:true},m=>{
     const p=Math.max(0,Math.min(100,Math.round(m.percent||0)));btn.textContent=`ZIP • %${p}`;setSaveState(`ZIP oluşturuluyor • %${p}`,'warn');
   });
   btn.textContent='ZIP • indiriliyor…';dl(out,'Mineclonia_Dark_Realism_delta.zip');
   toast(`${edits.length} texture ZIP olarak hazırlandı`);
 }catch(err){
   console.error('texturepack export',err);toast('ZIP oluşturulamadı: '+(err?.message||err));setSaveState('ZIP hatası','bad');
 }finally{
   btn.disabled=false;btn.textContent=oldLabel;
   setTimeout(()=>setSaveState(storageMode==='indexeddb'?'Hazır • kalıcı kayıt':storageMode==='local'?'Hazır • yerel fallback':'Hazır • sadece oturum',storageMode==='indexeddb'?'ok':storageMode==='local'?'warn':'bad'),400);
 }
}
function catalogMatchForZipPath(zipPath){
 const clean=zipPath.replace(/^\/+/, '');
 const direct=CATALOG.find(x=>clean===x.path||clean.endsWith('/'+x.path));if(direct)return direct;
 const base=clean.split('/').pop();const matches=CATALOG.filter(x=>x.name===base);return matches.length===1?matches[0]:null
}
async function importZip(file){
 const z=await JSZip.loadAsync(file);let changed=0,same=0,ambiguous=0;
 for(const [path,f] of Object.entries(z.files)){
   if(f.dir||!path.toLowerCase().endsWith('.png'))continue;
   const meta=catalogMatchForZipPath(path);if(!meta){ambiguous++;continue}
   let blob=await f.async('blob');blob=await prepareStoredEditBlob(blob,meta);
   try{const orig=await originalBlob(meta.path);if(await blobsEqual(blob,orig)){await delEdit(meta.path);same++;continue}}catch(err){console.warn(err)}
   await putEdit(meta.path,blob);changed++
 }
 toast(`${changed} değişiklik içe aktarıldı${same?`, ${same} orijinal atlandı`:''}${ambiguous?`, ${ambiguous} eşleşmedi`:''}`);applyFilter()
}
async function exportProjectBackup(){
 const edits=await allEdits();
 const z=new JSZip();
 const root=z.folder('Mineclonia_Texture_Studio_Backup');
 const manifest={format:'mineclonia-texture-studio-backup',version:1,createdAt:new Date().toISOString(),edits:[],targetResolution:TARGET_RESOLUTION,promptOverrides:Object.fromEntries(PROMPT_OVERRIDES)};
 for(const e of edits){const x=CATALOG.find(v=>v.path===e.path);if(!x)continue;const fn=`edits/${x.id}.png`;root.file(fn,e.blob);manifest.edits.push({id:x.id,path:x.path,name:x.name,file:fn});}
 root.file('manifest.json',JSON.stringify(manifest,null,2));
 const out=await z.generateAsync({type:'blob',compression:'STORE',streamFiles:true});
 dl(out,'Mineclonia_Texture_Studio_Backup.zip');toast(`${manifest.edits.length} düzenleme + ${PROMPT_OVERRIDES.size} prompt yedeklendi`)
}
async function importProjectBackup(file){
 const z=await JSZip.loadAsync(file);const mf=z.file('Mineclonia_Texture_Studio_Backup/manifest.json')||z.file('manifest.json');
 if(!mf)throw new Error('Geçerli proje yedeği değil');const m=JSON.parse(await mf.async('string'));
 if(m.format!=='mineclonia-texture-studio-backup')throw new Error('Yedek formatı tanınmadı');if([64,128,256,512].includes(m.targetResolution)){TARGET_RESOLUTION=m.targetResolution;if($('resolution'))$('resolution').value=String(TARGET_RESOLUTION)}
 let ok=0,missing=0;for(const e of (m.edits||[])){const x=CATALOG.find(v=>v.id===e.id)||CATALOG.find(v=>v.path===e.path);const f=z.file('Mineclonia_Texture_Studio_Backup/'+e.file)||z.file(e.file);if(!x||!f){missing++;continue}await putEdit(x.path,await f.async('blob'));ok++;}
 let pc=0;if(m.promptOverrides&&typeof m.promptOverrides==='object'){for(const [id,prompt] of Object.entries(m.promptOverrides)){if(CATALOG.some(x=>x.id===id)&&typeof prompt==='string'){PROMPT_OVERRIDES.set(id,prompt);pc++;}}savePromptOverrides();}
 await applyFilter();toast(`${ok} düzenleme, ${pc} prompt geri yüklendi${missing?`, ${missing} eşleşmedi`:''}`)
}


/* P0 REFERENCE-FIRST PROMPT SYSTEM — 2026-10-05 */
const MATERIAL_REFERENCE_DEPENDENCIES=[
 {test:n=>n==='mcl_core_grass_block_side_overlay.png',refs:['mcl_core_grass_block_top.png'],kind:'runtime-composite',note:'Mineclonia overlays this tintable grass edge over default_dirt; top grass is the material-continuity reference.'},
 {test:n=>/^mcl_core_(coal|iron|gold|diamond|lapis|emerald|redstone)_ore\.png$/.test(n),refs:['default_stone.png'],kind:'host-material',note:'Mineclonia registers these as stone-with-ore nodes; use the finished Mineclonia stone as the authoritative host-rock appearance.'},
 {test:n=>n==='mcl_copper_ore.png',refs:['default_stone.png'],kind:'runtime-composite',note:'Mineclonia explicitly renders Copper Ore as default_stone.png ^ mcl_copper_ore.png.'},
 {test:n=>/^mcl_deepslate_(coal|iron|gold|copper|diamond|lapis|emerald|redstone)_ore\.png$/.test(n),refs:['mcl_deepslate_deepslate.png'],kind:'host-material',note:'Mineclonia creates these through register_deepslate_ore; use finished deepslate as the host-rock reference.'},
 {test:n=>n==='mcl_nether_quartz_ore.png'||n==='mcl_nether_gold_ore.png',refs:['mcl_nether_netherrack.png'],kind:'host-material',note:'Mineclonia defines these as ores occurring in netherrack; use the finished Mineclonia netherrack material when available.'}
];
function materialReferenceDependency(x){
 const n=String(x?.name||'').toLowerCase();
 const d=MATERIAL_REFERENCE_DEPENDENCIES.find(v=>v.test(n));if(!d)return null;
 const refs=d.refs.map(name=>CATALOG.find(v=>String(v.name||'').toLowerCase()===name)).filter(Boolean);
 return {...d,refs};
}
function materialDependencyPromptBlock(x){
 const d=materialReferenceDependency(x);if(!d||!d.refs.length)return '';
 const names=d.refs.map(v=>v.name).join(', ');
 return `MINECLONIA MATERIAL CONTINUITY:
This asset has a verified Mineclonia material dependency.
Reference texture(s): ${names}.
Use the finished/generated version of the referenced Mineclonia texture as the authoritative material-family reference when creating this asset's visual reference.
Preserve this target asset's own gameplay role and geometry; inherit only the physically shared host/base material identity, scale, microstructure, weathering, roughness and value behavior.
Do not treat the reference as a generic Minecraft assumption. This relationship is specific to Mineclonia.
Dependency type: ${d.kind}.
${d.note}`;
}

function p0ProductionMeta(x){
 const subject=p0ReferenceSubject(x),n=String(x?.name||'').toLowerCase();
 let face='general material surface';
 if(/_top\.png$|tree_top|log_top|wood_top/.test(n))face='top-facing / cut / upper surface as defined by Image A';
 else if(/_side\.png$|tree_side|log_side/.test(n))face='side-facing surface as defined by Image A';
 else if(/_bottom\.png$/.test(n))face='bottom-facing surface as defined by Image A';
 else if(/_detail\.png$/.test(n))face='detail/overlay component whose functional placement is defined by Image A';
 const tileable=assetTypeOf(x)==='Block'&&!/glass_.*detail/.test(n);
 return {subject,face,tileable};
}
function p0ProductionPromptFor(x){
 const m=p0ProductionMeta(x);
 return tintPromptText(`Use Image A to understand WHAT the texture is and how it functions in the game.
Use Image B to determine HOW the final material should actually look.${materialReferenceDependency(x)?' Image B should be the dependency-aware reference generated using the verified Mineclonia base/host texture listed below.':''}

SELECTED MATERIAL: ${m.subject}
FACE / COMPONENT ROLE: ${m.face}

IMAGE A — SEMANTIC AND FUNCTIONAL REFERENCE:
Preserve the material identity, gameplay meaning, general scale, density, orientation, face/component role, and functional character of Image A.
Do NOT trace or preserve Image A's individual internal shapes, pixels, cracks, stones, grains, joints, markings, or exact feature placement unless that geometry is required by the stated face/component role.
Image A defines the meaning and functional orientation of the texture, not its exact low-resolution surface composition.

IMAGE B — DOMINANT VISUAL REFERENCE:
Rebuild the material using Image B's material character, surface geometry, micro-detail, sharpness, local contrast, depth, weathering, irregularity, color relationships, and natural light behavior.
Do not merely recolor, soften, upscale, clean up, denoise, or beautify Image A.
The final image should feel genuinely rebuilt in the visual language of Image B while remaining unmistakably ${m.subject}.

${m.tileable?`SEAMLESS TILING:
The final texture must tile seamlessly on all four sides.
Achieve seamlessness by making the MATERIAL ITSELF continue physically across opposite boundaries: left/right and top/bottom are physically adjacent.
Features reaching an edge should continue naturally from the corresponding opposite edge, including material masses, cracks, joints, grain, fibers, veins, roots, relief, color variation, shadows and highlights.
The outer edges are NOT protected regions; geometry may be rebuilt at the boundaries to create real continuation.
Never fake seamlessness by blurring, smoothing, fading, averaging, flattening lighting, reducing contrast, removing texture, neutralizing borders, or suppressing high-frequency detail.
Keep the same richness, sharpness, local contrast, depth and micro-detail at boundaries as in the center.`:`STRUCTURAL COMPONENT:
This selected asset is not treated as a freely tileable generic square. Preserve the functional component/overlay placement communicated by Image A while rebuilding its material appearance from Image B.`}

FINAL PRIORITY:
1. Preserve what Image A represents, its face/component role, and how it functions.
2. Make the actual material strongly follow Image B.
3. ${m.tileable?'Create true physical continuity across opposite canvas edges.':'Preserve the functional placement/role defined by Image A.'}
4. Preserve Image B's detail and visual energy without copying its composition.

Do not preserve Image A's internal composition unnecessarily. Reconstruct the surface freely within its gameplay and orientation constraints.${materialReferenceDependency(x)?'\n\n'+materialDependencyPromptBlock(x):''}${isRuntimeTintTexture(x)?'\n\n'+RUNTIME_TINT_PROMPT_LOCK:''}`,x);
}


const P0_REFERENCE_SUBJECT_EXACT={
 'default_acacia_leaves':'natural acacia foliage',
 'default_acacia_tree':'the bark-covered side surface of an acacia tree trunk',
 'default_acacia_tree_top':'the cut cross-section and end-grain surface of an acacia tree trunk',
 'default_acacia_wood':'acacia wooden planks',
 'default_cobble':'an old cobblestone surface',
 'default_dirt':'a natural compact soil surface',
 'default_gravel':'a rough natural gravel surface',
 'default_ice':'a natural solid ice surface',
 'default_jungleleaves':'natural jungle-tree foliage',
 'default_jungletree':'the bark-covered side surface of a jungle tree trunk',
 'default_jungletree_top':'the cut cross-section and end-grain surface of a jungle tree trunk',
 'default_junglewood':'jungle wood planks',
 'default_lava_flowing_animated':'a flowing molten lava surface',
 'default_lava_source_animated':'a dense molten lava source surface',
 'default_leaves':'natural oak foliage',
 'default_sand':'a natural sand surface',
 'default_snow':'a natural settled snow surface',
 'default_stone':'a natural weathered stone surface',
 'default_tree':'the bark-covered side surface of an oak tree trunk',
 'default_tree_top':'the cut cross-section and end-grain surface of an oak tree trunk',
 'default_water_flowing_animated':'a flowing natural water surface',
 'default_water_source_animated':'a calm natural water source surface',
 'default_wood':'oak wooden planks',
 'mcl_core_bedrock':'an ancient extremely dense bedrock surface',
 'mcl_core_grass_block_side_overlay':'the grassy edge layer used along the side face of a grass-covered soil block',
 'mcl_core_grass_block_top':'the top surface of a natural grass-covered soil block',
 'mcl_core_grass_side_snowed':'the side face of a grass-and-soil block covered by snow',
 'mcl_core_leaves_big_oak':'natural big/dark oak foliage',
 'mcl_core_leaves_birch':'natural birch foliage',
 'mcl_core_leaves_spruce':'natural spruce foliage',
 'mcl_core_log_big_oak':'the bark-covered side surface of a big/dark oak tree trunk',
 'mcl_core_log_big_oak_top':'the cut cross-section and end-grain surface of a big/dark oak tree trunk',
 'mcl_core_log_birch':'the bark-covered side surface of a birch tree trunk',
 'mcl_core_log_birch_top':'the cut cross-section and end-grain surface of a birch tree trunk',
 'mcl_core_log_spruce':'the bark-covered side surface of a spruce tree trunk',
 'mcl_core_log_spruce_top':'the cut cross-section and end-grain surface of a spruce tree trunk',
 'mcl_core_planks_big_oak':'big/dark oak wooden planks',
 'mcl_core_planks_birch':'birch wooden planks',
 'mcl_core_planks_spruce':'spruce wooden planks',
 'default_river_water_flowing_animated':'a flowing natural river-water surface',
 'default_river_water_source_animated':'a calm natural river-water source surface'
};
function p0ReferenceSubject(x){
 const n=String(x?.name||'').toLowerCase().replace(/\.png$/,'');
 if(P0_REFERENCE_SUBJECT_EXACT[n])return P0_REFERENCE_SUBJECT_EXACT[n];

 const speciesMatch=n.match(/(?:^|_)(acacia|birch|cherry|dark_oak|big_oak|jungle|oak|spruce|mangrove|pale_oak)(?:_|$)/);
 const compactSpecies=n.includes('jungletree')||n.includes('junglewood')||n.includes('jungleleaves')?'jungle':n.includes('bigoak')?'big_oak':'';
 const species=(speciesMatch?.[1]||compactSpecies).replace(/_/g,' ');
 const pretty=species==='big oak'?'big/dark oak':species;

 if(/stripped_/.test(n)&&/_top(?:_|$)/.test(n))return pretty?'the cut cross-section and end-grain surface of a stripped '+pretty+' tree trunk':'the cut cross-section and end-grain surface of a stripped tree trunk';
 if(/stripped_/.test(n)&&/_side(?:_|$)/.test(n))return pretty?'the exposed stripped-wood side surface of a '+pretty+' tree trunk':'the exposed stripped-wood side surface of a tree trunk';
 if(/tree_top|log_top|wood_top|top_log|top_wood/.test(n))return pretty?'the cut cross-section and end-grain surface of a '+pretty+' tree trunk':'the cut cross-section and end-grain surface of an old tree trunk';
 if(/leaves?|foliage/.test(n))return pretty?pretty+' foliage':'natural foliage';
 if(/(?:^|_)log(?:_|$)|tree_side|bark/.test(n))return pretty?'the bark-covered side surface of a '+pretty+' tree trunk':'the bark-covered side surface of an old tree trunk';
 if(/planks?/.test(n))return pretty?pretty+' wooden planks':'aged wooden planks';

 if(/bone_block_top/.test(n))return 'the end face of a dense bone block';
 if(/bone_block_side/.test(n))return 'the side surface of a dense bone block';
 if(/cactus_top/.test(n))return 'the top face of a cactus';
 if(/cactus_bottom/.test(n))return 'the bottom face of a cactus';
 if(/cactus_side/.test(n))return 'the side surface of a cactus';
 if(/podzol_top/.test(n))return 'the organic top surface of podzol soil';
 if(/podzol_side/.test(n))return 'the layered side face of a podzol soil block';
 if(/mycelium_top/.test(n))return 'the fungal top surface of a mycelium-covered soil block';
 if(/mycelium_side/.test(n))return 'the layered side face of a mycelium-covered soil block';
 if(/grass_path_top/.test(n))return 'the worn top surface of a compacted grass path';
 if(/grass_path_side/.test(n))return 'the exposed side face of a compacted grass path block';

 if(/dried_kelp_top/.test(n))return 'the top face of a compressed dried-kelp block';
 if(/dried_kelp_bottom/.test(n))return 'the bottom face of a compressed dried-kelp block';
 if(/dried_kelp_side/.test(n))return 'the side surface of a compressed dried-kelp block';
 if(/dried_kelp/.test(n))return 'a compressed dried-kelp block material';

 if(/red_sandstone_top/.test(n))return 'the top face of red sandstone';
 if(/red_sandstone_bottom/.test(n))return 'the bottom face of red sandstone';
 if(/red_sandstone_carved/.test(n))return 'carved red sandstone masonry';
 if(/red_sandstone_smooth/.test(n))return 'smooth finished red sandstone';
 if(/red_sandstone/.test(n))return 'natural red sandstone masonry';
 if(/sandstone_top/.test(n))return 'the top face of sandstone';
 if(/sandstone_bottom/.test(n))return 'the bottom face of sandstone';
 if(/sandstone_carved/.test(n))return 'carved sandstone masonry';
 if(/sandstone_smooth/.test(n))return 'smooth finished sandstone';
 if(/sandstone/.test(n))return 'natural sandstone masonry';

 if(/deepslate.*(?:brick|tiles?)/.test(n))return 'deep dark deepslate masonry';
 if(/deepslate.*cobbled/.test(n))return 'rough cobbled deepslate';
 if(/deepslate.*polished/.test(n))return 'polished deepslate stone';
 if(/deepslate.*chiseled/.test(n))return 'chiseled deepslate stonework';
 if(/deepslate/.test(n)&&/_ore/.test(n))return 'a mineral-bearing deepslate stone surface';
 if(/deepslate/.test(n))return 'a dense dark deepslate stone surface';

 if(/coral_block/.test(n))return /dead_/.test(n)?'a dead weathered coral-block surface':'a living coral-block surface';
 if(/prismarine_bricks/.test(n))return 'prismarine masonry blocks';
 if(/prismarine_dark/.test(n))return 'dark prismarine stonework';
 if(/sea_lantern/.test(n))return 'a luminous sea-lantern material surface';

 if(/wool/.test(n))return 'a dense woven wool block surface';
 if(/glass/.test(n))return 'a translucent game-world glass material';
 if(/mossycobble/.test(n))return 'old moss-covered cobblestone';
 if(/cobble/.test(n))return 'an old cobblestone surface';
 if(/stonebrick|stone_brick/.test(n))return 'aged stone-brick masonry';
 if(/brick/.test(n))return 'aged masonry and brickwork';
 if(/_ore/.test(n)||/ore_/.test(n))return 'a mineral-bearing stone surface';
 if(/obsidian/.test(n))return 'a dense volcanic obsidian surface';
 if(/granite/.test(n))return /smooth/.test(n)?'smooth finished granite':'natural granite stone';
 if(/diorite/.test(n))return /smooth/.test(n)?'smooth finished diorite':'natural diorite stone';
 if(/andesite/.test(n))return /smooth/.test(n)?'smooth finished andesite':'natural andesite stone';
 if(/stone/.test(n))return 'an old weathered stone surface';
 if(/coarse_dirt/.test(n))return 'coarse compact soil mixed with small stones';
 if(/dirt|soil|mud/.test(n))return 'a natural earth surface';
 if(/red_sand/.test(n))return 'a natural red-sand surface';
 if(/sand/.test(n))return 'a weathered natural sand surface';
 if(/gravel/.test(n))return 'a rough gravel surface';
 if(/ice/.test(n))return 'a natural solid ice surface';
 if(/snow/.test(n))return 'a natural settled snow surface';
 if(/slime/.test(n))return 'a translucent cohesive slime-block material';

 const clean=n.replace(/^(mcl|default|extra)_/i,'').replace(/_/g,' ');
 return 'the game-world block material represented by '+clean;
}
const BLOCK_PROMPT_MANIFEST_URL='prompts/blocks/manifest.json';
const BLOCK_REFERENCE_PROMPTS=new Map();
const AUTHORED_UV_REFS=new Map();
async function loadAuthoredReferenceSet(kind,manifestUrl){
 try{
  const r=await fetch(manifestUrl,{cache:'force-cache'});if(!r.ok)throw new Error('manifest '+r.status);
  const manifest=await r.json();
  const batchFiles=new Set((manifest.batches||[]).map(b=>b.file).filter(Boolean));
  const rows=(manifest.entries||[]).filter(e=>e.status==='done'&&e.file);
  const batchResults=await Promise.all(Array.from(batchFiles).map(async file=>{
   try{
    const q=await fetch(file,{cache:'force-cache'});if(!q.ok)return null;
    const j=await q.json();
    return Object.values(j.prompts||{}).filter(x=>x?.id&&typeof x.reference_prompt==='string');
   }catch(err){console.warn(kind+' authored batch unavailable',file,err);return null}
  }));
  for(const list of batchResults)for(const row of (list||[]))AUTHORED_UV_REFS.set(row.id,row.reference_prompt);
  const fileRows=rows.filter(e=>!batchFiles.has(e.file));
  const results=await Promise.all(fileRows.map(async e=>{
   try{
    const q=await fetch(e.file,{cache:'force-cache'});if(!q.ok)return null;
    const text=await q.text();
    if(/\.txt$/i.test(e.file))return {id:e.id,prompt:text};
    const j=JSON.parse(text);
    return j?.id&&typeof j.reference_prompt==='string'?{id:j.id,prompt:j.reference_prompt}:null;
   }catch(err){console.warn(kind+' authored prompt unavailable',e.file,err);return null}
  }));
  for(const row of results)if(row?.id&&typeof row.prompt==='string')AUTHORED_UV_REFS.set(row.id,row.prompt);
  console.info(kind+' authored reference prompts loaded:',Array.from(AUTHORED_UV_REFS.keys()).length);
  return true;
 }catch(err){
  console.warn(kind+' authored reference manifest unavailable; dynamic fallback remains active',err);
  return false;
 }
}
const AUTHORED_UV_REF_PROMISES={
 mobs:loadAuthoredReferenceSet('Mobs','prompts/mobs/manifest.json'),
 armor:loadAuthoredReferenceSet('Armor','prompts/armor/manifest.json')
};
function dynamicArmorRefPromptFor(x){
 const m=mobPromptMeta(x);
 return 'Create a high-quality visual MATERIAL REFERENCE for the worn player armor represented by "'+m.name+'".\n\nThis is reference art for a later UV-material transfer, NOT a UV map, texture atlas, inventory icon, item sprite, voxel render or game screenshot.\n\nARMOR IDENTITY:\n'+m.name+'\nRuntime role: '+m.role+'.\n\nMATERIAL:\n'+m.material+'. Preserve the practical identity of this exact armor piece and material. Show believable manufacturing character, wear, edge behavior, articulation/contact wear where appropriate, and restrained age without inventing new armor geometry, ornament, engravings, spikes, gems, straps or major components.\n\nART DIRECTION:\nGrounded dark-fantasy realism: ancient, weathered, somber, tactile and physically believable. Restrained saturation, soft neutral diffuse lighting, controlled micro-detail and honest material response. Avoid dramatic scene lighting, glossy toy finish, cartoon/anime styling, pixel art, voxel styling, text, UI and decorative props.\n\nREFERENCE FUNCTION:\nPrioritize readable material information, color relationships, manufacturing character and wear. Use a simple neutral unobtrusive background. The image must function as a clean appearance/material reference for transfer onto an already structurally correct player-armor UV atlas.';
}
function referencePromptFor(x){
 if(!x||!isThreeStageUvTexture(x))return null;
 const authored=AUTHORED_UV_REFS.get(x.id);
 if(typeof authored==='string'&&authored.length)return authored;
 return isArmorUvTexture(x)?dynamicArmorRefPromptFor(x):mobCreatureRefPromptFor(x);
}
let blockPromptManifest=null;
async function loadBlockReferencePrompts(){
 try{
  const r=await fetch(BLOCK_PROMPT_MANIFEST_URL,{cache:'force-cache'});if(!r.ok)throw new Error('manifest '+r.status);
  blockPromptManifest=await r.json();
  const done=(blockPromptManifest.entries||[]).filter(e=>e.status==='done'&&e.file);
  const batchRows=[];for(const batch of (blockPromptManifest.batches||[])){try{const q=await fetch(batch.file,{cache:'force-cache'});if(!q.ok)continue;const j=await q.json();batchRows.push(...Object.values(j.prompts||{}))}catch{}}
  for(const row of batchRows)if(row?.id&&row?.reference_prompt)BLOCK_REFERENCE_PROMPTS.set(row.id,row.reference_prompt);
  const rows=await Promise.all(done.filter(e=>e.file&&!String(e.file).includes('batch_')).map(async e=>{try{const q=await fetch(e.file,{cache:'force-cache'});if(!q.ok)return null;return await q.json()}catch{return null}}));
  for(const row of rows)if(row?.id&&row?.reference_prompt)BLOCK_REFERENCE_PROMPTS.set(row.id,row.reference_prompt);
 }catch(e){console.warn('Block prompt manifest unavailable; inline fallback active',e)}
}
function p0ReferencePromptFor(x){
 const dependency=materialDependencyPromptBlock(x);
 if(x?.id&&BLOCK_REFERENCE_PROMPTS.has(x.id)){const authored=BLOCK_REFERENCE_PROMPTS.get(x.id);return dependency?authored+'\n\n'+dependency:authored;}
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

Focus purely on establishing the material language and artistic identity of this world through this material.${dependency?'\n\n'+dependency:''}`;
}

function p0PromotableBlock(x){
 if(assetTypeOf(x)!=='Block')return false;
 const n=String(x?.name||'').toLowerCase();
 if(/^mcl_core_light_\d+\.png$/.test(n))return false;
 if(['mcl_core_barrier.png','mcl_core_void.png','mcl_core_sugar.png','mcl_core_vine.png','mcl_core_web.png','mcl_dirt_grass_shadow.png','default_ladder.png'].includes(n))return false;
 if(/^mcl_ocean_sea_pickle_\d+_off\.png$/.test(n))return false;
 return true;
}
for(const x of CATALOG){
 if(x.priority==='P1'&&p0PromotableBlock(x))x.priority='P0';
}
const P0_REFERENCE_REQUIRED=[
 'default_acacia_leaves','default_acacia_tree','default_acacia_tree_top','default_acacia_wood','default_cobble','default_dirt','default_gravel','default_ice','default_jungleleaves','default_jungletree','default_jungletree_top','default_junglewood','default_lava_flowing_animated','default_lava_source_animated','default_leaves','default_sand','default_snow','default_stone','default_tree','default_tree_top','default_water_flowing_animated','default_water_source_animated','default_wood','mcl_core_bedrock','mcl_core_grass_block_side_overlay','mcl_core_grass_block_top','mcl_core_grass_side_snowed','mcl_core_leaves_big_oak','mcl_core_leaves_birch','mcl_core_leaves_spruce','mcl_core_log_big_oak','mcl_core_log_big_oak_top','mcl_core_log_birch','mcl_core_log_birch_top','mcl_core_log_spruce','mcl_core_log_spruce_top','mcl_core_planks_big_oak','mcl_core_planks_birch','mcl_core_planks_spruce','default_river_water_flowing_animated','default_river_water_source_animated'
];
if(P0_REFERENCE_REQUIRED.some(k=>!P0_REFERENCE_SUBJECT_EXACT[k]))console.error('P0 reference subject map incomplete');
const __legacyPromptForP0Ref=promptFor;
promptFor=function(x,mode='classic'){
 if(x&&x.priority==='P0'){let text=tintPromptText(p0ReferencePromptFor(x),x);if(isRuntimeTintTexture(x)&&!text.includes('RUNTIME TINT / COLOR MASK LOCK:'))text+='\n\n'+RUNTIME_TINT_PROMPT_LOCK;return {text,family:'P0 · Reference-first'}};
 return __legacyPromptForP0Ref(x,mode);
};
try{creativeP0PromptFor=()=>null}catch{}

// Variant Lab is isolated in js/variant-lab.js.
window.MTSVariantBridge={catalog:()=>CATALOG,active:()=>active,toast,originalBlob,getEdit,putEdit,assetTypeOf,runtimeRoleInfo,prepareVariantTextureBlob,lockEntityAlphaToSource,applyFilter,markChanged:path=>changedPathsFast?.add?.(path)};
// Island Studio is isolated in js/island-studio.js so failures cannot block the catalog.
window.MTSIslandBridge={
 catalog:()=>CATALOG,
 active:()=>active,
 toast,
 decodeBlobToCanvas,
 canvasPngBlob,
 originalBlob,
 assetTypeOf,
 saveRestored:async(path,blob)=>{
   if(!path||!blob)throw new Error('Geri toplanmış UV kaydı eksik');
   await putEdit(path,blob);
   await editWriteQueue.catch(()=>{});
   await applyFilter();
   return true;
 },
 closeDetailSheet,
 ensurePreview3dLoaded:async()=>{if(window.MTSPreview3D)return window.MTSPreview3D;if(!preview3dLoadPromise)preview3dLoadPromise=new Promise((resolve,reject)=>{const s=document.createElement('script');s.src='js/preview3d.js?v=20261006-variant3d1';s.async=true;s.onload=resolve;s.onerror=()=>reject(Error('3D önizleme modülü yüklenemedi'));document.body.appendChild(s)});await preview3dLoadPromise;return window.MTSPreview3D}
};
const uvMap={meta:null,rec:null,orig:null,gen:null,work:null,origSel:null,genSel:null,history:[],target:'gen',handle:'move',view:'overlay',globalX:0,globalY:0,globalMode:false,zoom:1,panX:0,panY:0,panMode:false,pointers:new Map(),pinchDist:0,grid:true,autoTarget:null,autoSource:null,autoPairs:[],contours:true,manualLink:false,manualTarget:null,autoBase:null,autoApplied:false,bgMode:'auto',excludeMode:false,excludedTarget:new Set(),excludedSource:new Set(),manualSource:null,edgePairs:[],selectedTargetSegment:null,selectedSourceSegment:null,edgePickSide:'target',islands:[],islandIndex:-1,islandTemplate:null,islandTemplateMap:null,islandMode:false,objectPick:null,selectedSourceComp:null,selectedTargetComp:null,maskLock:true,nudgeStep:1};

function uvClampSel(s,w,h){s.x=Math.max(0,Math.min(w-1,s.x));s.y=Math.max(0,Math.min(h-1,s.y));s.w=Math.max(1,Math.min(w-s.x,s.w));s.h=Math.max(1,Math.min(h-s.y,s.h));return s}
function uvDrawSelection(kind){const canvas=$(kind==='orig'?'uvOrigCanvas':'uvGenCanvas'),el=$(kind==='orig'?'uvOrigSel':'uvGenSel'),s=uvMap[kind+'Sel'];if(!canvas||!s)return;const wrap=$('uvLiveWrap'),rx=wrap.clientWidth/canvas.width*uvMap.zoom,ry=wrap.clientHeight/canvas.height*uvMap.zoom;el.style.left=(uvMap.panX+s.x*rx)+'px';el.style.top=(uvMap.panY+s.y*ry)+'px';el.style.width=(s.w*rx)+'px';el.style.height=(s.h*ry)+'px'}
function uvStatus(){const a=uvMap.origSel,b=uvMap.genSel;$('uvMapStatus').textContent=uvMap.history.length+' canlı düzeltme · O:'+(a?(a.x+','+a.y+' '+a.w+'×'+a.h):'-')+' · Ü:'+(b?(b.x+','+b.y+' '+b.w+'×'+b.h):'-')}
function uvRenderWork(){uvRenderWorkCanvasOnly();uvSetView(uvMap.view)}
function uvRenderGrid(){const grid=$('uvPixelGrid'),wrap=$('uvLiveWrap'),canvas=$('uvGenCanvas');if(!grid||!canvas)return;const px=wrap.clientWidth/canvas.width*uvMap.zoom,py=wrap.clientHeight/canvas.height*uvMap.zoom,show=uvMap.grid&&Math.min(px,py)>=6;grid.classList.toggle('show',show);if(!show)return;grid.style.transform='translate('+uvMap.panX+'px,'+uvMap.panY+'px)';grid.style.width=(wrap.clientWidth*uvMap.zoom)+'px';grid.style.height=(wrap.clientHeight*uvMap.zoom)+'px';grid.style.backgroundImage='linear-gradient(to right,rgba(255,255,255,.22) 1px,transparent 1px),linear-gradient(to bottom,rgba(255,255,255,.22) 1px,transparent 1px)';grid.style.backgroundSize=px+'px '+py+'px'}
function uvApplyTransform(){const wrap=$('uvLiveWrap'),g=$('uvGenCanvas'),z=uvMap.zoom,gx=(uvMap.globalX||0)*wrap.clientWidth/Math.max(1,g.width)*z,gy=(uvMap.globalY||0)*wrap.clientHeight/Math.max(1,g.height)*z,base='translate('+uvMap.panX+'px,'+uvMap.panY+'px) scale('+z+')',gen='translate('+(uvMap.panX+gx)+'px,'+(uvMap.panY+gy)+'px) scale('+z+')';$('uvOrigCanvas').style.transform=base;$('uvGenCanvas').style.transform=gen;$('uvContourCanvas').style.transform=base;$('uvZoomValue').textContent=Math.round(z*100)+'%';uvRenderGrid();requestAnimationFrame(()=>{uvDrawSelection('orig');uvDrawSelection('gen')})}
function uvSetZoom(z,cx=null,cy=null){const old=uvMap.zoom,nz=Math.max(1,Math.min(8,z)),wrap=$('uvLiveWrap');if(cx==null){cx=wrap.clientWidth/2;cy=wrap.clientHeight/2}const k=nz/old;uvMap.panX=cx-(cx-uvMap.panX)*k;uvMap.panY=cy-(cy-uvMap.panY)*k;uvMap.zoom=nz;if(nz===1){uvMap.panX=0;uvMap.panY=0}uvApplyTransform()}
function uvFocusSelection(){const kind=uvMap.target,s=uvMap[kind+'Sel'],wrap=$('uvLiveWrap'),canvas=$(kind==='orig'?'uvOrigCanvas':'uvGenCanvas');if(!s||!canvas)return;const z=Math.max(2,Math.min(8,Math.min(canvas.width/Math.max(1,s.w),canvas.height/Math.max(1,s.h))*.55));uvMap.zoom=z;const baseW=wrap.clientWidth,baseH=wrap.clientHeight,cx=(s.x+s.w/2)*baseW/canvas.width,cy=(s.y+s.h/2)*baseH/canvas.height;uvMap.panX=baseW/2-cx*z;uvMap.panY=baseH/2-cy*z;uvApplyTransform()}
function uvRenderGlobal(){$('uvGlobalOffset').textContent='X '+uvMap.globalX+' · Y '+uvMap.globalY;uvApplyTransform()}
function uvShiftGlobal(dx,dy){uvMap.globalX+=dx;uvMap.globalY+=dy;uvRenderGlobal()}
function uvTargetWorkRect(sel=uvMap.origSel){
 if(!sel||!uvMap.orig||!uvMap.work)return null;
 const sx=uvMap.work.width/Math.max(1,uvMap.orig.width),sy=uvMap.work.height/Math.max(1,uvMap.orig.height);
 const x=Math.round(sel.x*sx),y=Math.round(sel.y*sy);
 const x2=Math.round((sel.x+sel.w)*sx),y2=Math.round((sel.y+sel.h)*sy);
 return {x,y,w:Math.max(1,x2-x),h:Math.max(1,y2-y),sx,sy}
}
function uvTransformStatus(){const a=uvMap.origSel,b=uvMap.genSel,wr=uvTargetWorkRect(a);if($('uvTransformMeta'))$('uvTransformMeta').textContent=a&&b&&wr?'Hedef '+a.w+'×'+a.h+' → '+wr.w+'×'+wr.h+' · Kaynak '+b.w+'×'+b.h:'Hedef ve kaynak alanını seç'}
function uvResizeSource(dw,dh){const s=uvMap.genSel,c=$('uvGenCanvas');if(!s||!c)return;s.w=Math.max(1,Math.min(c.width-s.x,s.w+dw));s.h=Math.max(1,Math.min(c.height-s.y,s.h+dh));uvDrawSelection('gen');uvTransformStatus();uvStatus()}
function uvApplyTargetMask(g,rect,origSel){
 if(!uvMap.orig||!uvMap.work||!rect||!origSel)return;
 if(!uvMap.autoTarget)uvAnalyzeSmart();
 const a=uvMap.autoTarget;if(!a?.mask)return;
 const im=g.getImageData(rect.x,rect.y,rect.w,rect.h),d=im.data;
 for(let y=0;y<rect.h;y++)for(let x=0;x<rect.w;x++){
   const ox=Math.max(0,Math.min(a.w-1,Math.floor(origSel.x+(x+.5)*origSel.w/rect.w)));
   const oy=Math.max(0,Math.min(a.h-1,Math.floor(origSel.y+(y+.5)*origSel.h/rect.h)));
   d[(y*rect.w+x)*4+3]=a.mask[oy*a.w+ox]?255:0;
 }
 g.putImageData(im,rect.x,rect.y)
}
function uvBuildFilledSourceCrop(snap,sel){
 const c=document.createElement('canvas');c.width=sel.w;c.height=sel.h;const ctx=c.getContext('2d',{willReadFrequently:true});
 ctx.drawImage(snap,sel.x,sel.y,sel.w,sel.h,0,0,sel.w,sel.h);
 const a=uvMap.autoSource;if(!a?.mask||a.w!==uvMap.work.width||a.h!==uvMap.work.height)return c;
 const n=sel.w*sel.h,nearest=new Int32Array(n);nearest.fill(-1),q=new Int32Array(n);let head=0,tail=0;
 for(let y=0;y<sel.h;y++)for(let x=0;x<sel.w;x++){
   const gx=sel.x+x,gy=sel.y+y;if(gx<0||gy<0||gx>=a.w||gy>=a.h)continue;
   const p=y*sel.w+x;if(a.mask[gy*a.w+gx]){nearest[p]=p;q[tail++]=p}
 }
 if(!tail)return c;
 while(head<tail){
   const p=q[head++],x=p%sel.w,y=(p/sel.w)|0,seed=nearest[p];
   if(x>0&&nearest[p-1]<0){nearest[p-1]=seed;q[tail++]=p-1}
   if(x<sel.w-1&&nearest[p+1]<0){nearest[p+1]=seed;q[tail++]=p+1}
   if(y>0&&nearest[p-sel.w]<0){nearest[p-sel.w]=seed;q[tail++]=p-sel.w}
   if(y<sel.h-1&&nearest[p+sel.w]<0){nearest[p+sel.w]=seed;q[tail++]=p+sel.w}
 }
 const im=ctx.getImageData(0,0,sel.w,sel.h),d=im.data;
 for(let p=0;p<n;p++){
   const x=p%sel.w,y=(p/sel.w)|0,gx=sel.x+x,gy=sel.y+y,on=gx>=0&&gy>=0&&gx<a.w&&gy<a.h&&a.mask[gy*a.w+gx];
   if(on||nearest[p]<0)continue;const si=nearest[p]*4,di=p*4;d[di]=d[si];d[di+1]=d[si+1];d[di+2]=d[si+2];d[di+3]=255
 }
 ctx.putImageData(im,0,0);return c
}
function uvApplyCurrentTransform(fit=false,lockMask=false){
 if(!uvMap.origSel||!uvMap.genSel||!uvMap.work)return;
 const before=uvMap.work.getContext('2d').getImageData(0,0,uvMap.work.width,uvMap.work.height),p={orig:{...uvMap.origSel},gen:{...uvMap.genSel}},dst=uvTargetWorkRect(p.orig);
 if(!dst)return;
 const snap=document.createElement('canvas');snap.width=uvMap.work.width;snap.height=uvMap.work.height;snap.getContext('2d').putImageData(before,0,0);
 uvMap.history.push(before);
 const g=uvMap.work.getContext('2d'),source=lockMask?uvBuildFilledSourceCrop(snap,p.gen):snap;
 const movingObject=lockMask&&!!uvMap.selectedSourceComp&&!!uvMap.selectedTargetComp;
 if(movingObject)g.clearRect(p.gen.x,p.gen.y,p.gen.w,p.gen.h);
 g.clearRect(dst.x,dst.y,dst.w,dst.h);g.imageSmoothingEnabled=true;g.imageSmoothingQuality='high';
 if(lockMask)g.drawImage(source,0,0,source.width,source.height,dst.x,dst.y,dst.w,dst.h);
 else g.drawImage(source,p.gen.x,p.gen.y,p.gen.w,p.gen.h,dst.x,dst.y,dst.w,dst.h);
 if(lockMask)uvApplyTargetMask(g,dst,p.orig);
 uvMap.autoSource=null;uvMap.autoPairs=[];uvMap.autoBase=null;uvMap.autoApplied=false;
 if(movingObject){uvMap.selectedSourceComp=null;uvMap.selectedTargetComp=null;uvMap.objectPick=null;uvUpdateObjectPickUi()}
 uvRenderWork();uvTransformStatus();uvStatus();if(lockMask)uvAnalyzeSmart();else uvRefreshContours();
 toast(lockMask?'Parça hedefe oturtuldu · orijinal UV maskesi kilitlendi':fit?'Parça hedef boyuta oturtuldu':'Parça canlı uygulandı')
}

function uvDrawObjectBoxes(cv,analysis,prefix,selected){
 const ctx=cv.getContext('2d'),sx=cv.width/Math.max(1,analysis.w),sy=cv.height/Math.max(1,analysis.h);
 ctx.save();ctx.font='bold 11px system-ui';ctx.textBaseline='top';
 for(const c of analysis.components||[]){
   const x=c.bbox.x*sx,y=c.bbox.y*sy,w=c.bbox.w*sx,h=c.bbox.h*sy,isSel=selected?.id===c.id;
   ctx.lineWidth=isSel?3:1;ctx.strokeStyle=prefix==='O'?(isSel?'#d9ff9d':'rgba(143,209,79,.85)'):(isSel?'#fff0a6':'rgba(255,190,80,.9)');
   ctx.strokeRect(x+.5,y+.5,w,h);
   const label=prefix+(c.id+1),tw=ctx.measureText(label).width+6;ctx.fillStyle='rgba(0,0,0,.72)';ctx.fillRect(x,y,tw,15);ctx.fillStyle='#fff';ctx.fillText(label,x+3,y+2)
 }
 ctx.restore()
}
function uvRefreshContours(){
 const cv=$('uvContourCanvas');if(!cv||!uvMap.orig||!uvMap.work)return;
 cv.width=uvMap.work.width;cv.height=uvMap.work.height;cv.style.display=uvMap.contours?'':'none';
 if(!uvMap.contours||!uvMap.autoTarget||!uvMap.autoSource){cv.getContext('2d').clearRect(0,0,cv.width,cv.height);return}
 const view=uvMap.view,showTarget=view==='orig'||view==='overlay'||view==='work'||view==='lines',showSource=view==='gen'||view==='overlay'||view==='lines';
 window.MTSUvWarp?.draw?.(cv,uvMap.autoTarget,uvMap.autoSource,uvMap.autoPairs||[],{showTarget,showSource,excludedTarget:uvMap.excludedTarget,excludedSource:uvMap.excludedSource,segmentPairs:uvMap.edgePairs,selectedTargetSegment:uvMap.selectedTargetSegment,selectedSourceSegment:uvMap.selectedSourceSegment});
 if(showTarget)uvDrawObjectBoxes(cv,uvMap.autoTarget,'O',uvMap.selectedTargetComp);
 if(showSource)uvDrawObjectBoxes(cv,uvMap.autoSource,'Ü',uvMap.selectedSourceComp);
 uvApplyTransform();
}
function uvAnalysisPoint(analysis,e){const wrap=$('uvLiveWrap'),r=wrap.getBoundingClientRect(),bx=(e.clientX-r.left-uvMap.panX)/uvMap.zoom,by=(e.clientY-r.top-uvMap.panY)/uvMap.zoom;return{x:Math.max(0,Math.min(analysis.w-1,Math.floor(bx*analysis.w/wrap.clientWidth))),y:Math.max(0,Math.min(analysis.h-1,Math.floor(by*analysis.h/wrap.clientHeight)))}}
function uvManualLinkPick(e){
 if(!uvMap.manualLink&&!uvMap.excludeMode)return false;
 if(!uvMap.autoTarget||!uvMap.autoSource)if(!uvAnalyzeSmart())return true;
 if(uvMap.excludeMode)return false;
 const analysis=uvMap.edgePickSide==='target'?uvMap.autoTarget:uvMap.autoSource,p=uvAnalysisPoint(analysis,e);
 const hit=window.MTSUvWarp.nearestSegment?.(analysis,p.x,p.y,null,Math.max(2,Math.min(analysis.w,analysis.h)*.09));
 if(!hit){$('uvAutoMeta').textContent=(uvMap.edgePickSide==='target'?'Orijinal':'Eklenen')+' kenara daha yakın dokun';return true}
 if(uvMap.edgePickSide==='target'){
   uvMap.selectedTargetSegment=hit;uvMap.edgePickSide='source';uvSetView('lines');$('uvAutoMeta').textContent='Orijinal kenar seçildi · şimdi Eklenen karşılığını seç';
 }else{
   uvMap.selectedSourceSegment=hit;$('uvConfirmEdgeMatch').style.display='';$('uvAutoMeta').textContent='İki kenar seçildi · beyaz vurguları kontrol et ve Eşle';
 }
 uvRefreshContours();return true
}
function uvComponentAt(analysis,e){
 if(!analysis)return null;const p=uvAnalysisPoint(analysis,e);
 const inside=(analysis.components||[]).filter(c=>p.x>=c.bbox.x&&p.x<c.bbox.x+c.bbox.w&&p.y>=c.bbox.y&&p.y<c.bbox.y+c.bbox.h).sort((a,b)=>a.area-b.area);
 return inside[0]||window.MTSUvWarp?.nearest?.(analysis,p.x,p.y,null,Math.max(3,Math.min(analysis.w,analysis.h)*.08))||null
}
function uvUpdateObjectPickUi(){
 const src=$('uvPickGenerated'),tar=$('uvPickOriginal'),meta=$('uvObjectMeta');
 src?.classList.toggle('primary',uvMap.objectPick==='source');tar?.classList.toggle('primary',uvMap.objectPick==='target');
 if(meta){
   const s=uvMap.selectedSourceComp,t=uvMap.selectedTargetComp;
   meta.textContent=(s?'Ü #'+(s.id+1)+' '+s.bbox.w+'×'+s.bbox.h:'Ü seçilmedi')+' · '+(t?'O #'+(t.id+1)+' '+t.bbox.w+'×'+t.bbox.h:'O seçilmedi')
 }
}
function uvSetObjectPick(kind){
 if(!uvMap.autoTarget||!uvMap.autoSource)if(!uvAnalyzeSmart())return;
 uvMap.objectPick=uvMap.objectPick===kind?null:kind;uvMap.panMode=false;uvMap.manualLink=false;uvMap.excludeMode=false;
 $('uvPanToggle')?.classList.remove('primary');$('uvLiveWrap')?.classList.remove('panMode');
 uvSetView('overlay');uvUpdateObjectPickUi();uvRefreshContours();
 if(uvMap.objectPick)toast(uvMap.objectPick==='source'?'Üretilen parçaya dokun':'Orijinal hedef parçaya dokun')
}
function uvManualObjectPick(e){
 if(!uvMap.objectPick)return false;
 if(!uvMap.autoTarget||!uvMap.autoSource)if(!uvAnalyzeSmart())return true;
 const kind=uvMap.objectPick,analysis=kind==='source'?uvMap.autoSource:uvMap.autoTarget,comp=uvComponentAt(analysis,e);
 if(!comp){toast('Bir nesnenin içine veya kenarına dokun');return true}
 if(kind==='source'){
   uvMap.selectedSourceComp=comp;uvMap.genSel={x:comp.bbox.x,y:comp.bbox.y,w:comp.bbox.w,h:comp.bbox.h};uvMap.target='gen';uvMap.objectPick='target';
   $('uvGenSel').style.display='block';uvDrawSelection('gen');toast('Kaynak seçildi · şimdi orijinal hedefe dokun')
 }else{
   uvMap.selectedTargetComp=comp;uvMap.origSel={x:comp.bbox.x,y:comp.bbox.y,w:comp.bbox.w,h:comp.bbox.h};uvMap.target='orig';uvMap.objectPick=null;
   $('uvOrigSel').style.display='block';uvDrawSelection('orig');toast('Hedef seçildi · Oturt + Maske ile uygula')
 }
 uvTransformStatus();uvStatus();uvUpdateObjectPickUi();uvRefreshContours();return true
}
function uvClearObjectPick(){
 uvMap.objectPick=null;uvMap.selectedSourceComp=null;uvMap.selectedTargetComp=null;uvUpdateObjectPickUi();uvRefreshContours()
}

function uvAnalyzeSmart(){
 if(!window.MTSUvWarp||!uvMap.orig||!uvMap.work)return false;
 try{
  uvMap.autoTarget=window.MTSUvWarp.analyze(uvMap.orig,{bgMode:'auto',role:'target'});
  uvMap.autoSource=window.MTSUvWarp.analyze(uvMap.work,{bgMode:uvMap.bgMode||'auto',role:'source'});
  uvMap.autoPairs=[];
  const tb=uvMap.autoTarget.bg||{},sb=uvMap.autoSource.bg||{};
  $('uvAutoMeta').textContent='O '+uvMap.autoTarget.components.length+' nesne ['+(tb.mode||'auto')+'] · Ü '+uvMap.autoSource.components.length+' nesne ['+(sb.mode||'auto')+']';
  uvRefreshContours();uvUpdateObjectPickUi();return true;
 }catch(err){console.error('UV analyze',err);toast('Sınır analizi başarısız');return false}
}
function uvAutoMatchSmart(){
 if(!uvMap.autoTarget||!uvMap.autoSource)if(!uvAnalyzeSmart())return false;
 const manual=(uvMap.autoPairs||[]).filter(p=>p.manual),usedS=new Set(manual.map(p=>p.source.id)),usedT=new Set(manual.map(p=>p.target.id));
 const auto=window.MTSUvWarp.match(uvMap.autoTarget,uvMap.autoSource,{usedSource:usedS,excludedTarget:new Set([...uvMap.excludedTarget,...usedT]),excludedSource:uvMap.excludedSource});
 uvMap.autoPairs=[...manual,...auto];
 if(!uvMap.autoBase){const ctx=uvMap.work.getContext('2d');uvMap.autoBase=ctx.getImageData(0,0,uvMap.work.width,uvMap.work.height)}
 uvMap.autoApplied=false;
 $('uvAutoMeta').textContent='Manuel '+manual.length+' · güvenli oto '+auto.length+' · elenen '+(uvMap.excludedTarget.size+uvMap.excludedSource.size);
 uvRefreshContours();return uvMap.autoPairs.length>0;
}
function uvAutoWarpSmart(){
 if(!uvMap.edgePairs.length&&!uvAutoMatchSmart())return;
 if(!uvMap.autoTarget||!uvMap.autoSource)if(!uvAnalyzeSmart())return;
 const g=uvMap.work.getContext('2d');
 if(!uvMap.autoBase)uvMap.autoBase=g.getImageData(0,0,uvMap.work.width,uvMap.work.height);
 if(!uvMap.autoApplied)uvMap.history.push(g.getImageData(0,0,uvMap.work.width,uvMap.work.height));
 const base=document.createElement('canvas');base.width=uvMap.work.width;base.height=uvMap.work.height;base.getContext('2d').putImageData(uvMap.autoBase,0,0);
 const topo=window.MTSUvWarp.nativeTopologyMatch?.(base,uvMap.orig);
 if(topo?.match&&window.MTSUvWarp.exactUvSnap){
   const snapped=window.MTSUvWarp.exactUvSnap(base,uvMap.orig).canvas;
   uvMap.work.width=snapped.width;uvMap.work.height=snapped.height;uvMap.work.getContext('2d').drawImage(snapped,0,0);uvMap.autoApplied=true;
   uvMap.autoSource=window.MTSUvWarp.analyze(uvMap.work,{bgMode:'alpha',role:'source',strictAlpha:true});
   uvRenderWork();uvRefreshContours();uvStatus();if($('uvSaveHint'))$('uvSaveHint').textContent='Exact UV Snap · native grid birebir · '+topo.scale+'×';toast('UV sınırı piksel-perfect olarak kilitlendi');return;
 }
 const sourceAnalysis=window.MTSUvWarp.analyze(base,{bgMode:'alpha',role:'source',strictAlpha:true});
 let warped=window.MTSUvWarp.smoothWarp?window.MTSUvWarp.smoothWarp(base,uvMap.autoTarget,sourceAnalysis,uvMap.autoPairs,uvMap.edgePairs):(window.MTSUvWarp.warp)(base,uvMap.autoTarget,sourceAnalysis,uvMap.autoPairs);
 if(uvMap.edgePairs.length&&window.MTSUvWarp.snapAlphaToTarget)warped=window.MTSUvWarp.snapAlphaToTarget(warped,uvMap.autoTarget,uvMap.edgePairs);
 uvMap.work.width=warped.width;uvMap.work.height=warped.height;uvMap.work.getContext('2d').drawImage(warped,0,0);uvMap.autoApplied=true;
 uvMap.autoSource=window.MTSUvWarp.analyze(uvMap.work,{bgMode:'alpha',role:'source',strictAlpha:true});
 const err=window.MTSUvWarp.edgeError?.(uvMap.autoTarget,uvMap.autoSource,uvMap.edgePairs)||{mean:0,max:0};
 uvRenderWork();uvRefreshContours();uvStatus();if($('uvSaveHint'))$('uvSaveHint').textContent='Kenar hatası: ort '+err.mean.toFixed(2)+' px · max '+err.max.toFixed(2)+' px';toast(err.mean<=.75?'Kenarlar piksel hassasiyetinde hizalandı':'Kenar hatası '+err.mean.toFixed(2)+' px');
}

function uvSetView(mode){uvMap.view=mode;const o=$('uvOrigCanvas'),g=$('uvGenCanvas'),wrap=$('uvLiveWrap'),range=$('uvOverlayRange'),v=Number(range.value)/100;wrap.classList.toggle('linesOnly',mode==='lines');document.querySelectorAll('[data-uvview]').forEach(b=>b.classList.toggle('primary',b.dataset.uvview===mode));if(mode==='orig'){o.style.opacity='1';g.style.opacity='0'}else if(mode==='gen'){o.style.opacity='0';g.style.opacity='1';const ctx=g.getContext('2d');g.width=uvMap.gen.width;g.height=uvMap.gen.height;ctx.drawImage(uvMap.gen,0,0)}else if(mode==='work'){o.style.opacity='0';g.style.opacity='1';uvRenderWorkCanvasOnly()}else if(mode==='lines'){o.style.opacity='0';g.style.opacity='0'}else{o.style.opacity='1';g.style.opacity=String(v);uvRenderWorkCanvasOnly()}requestAnimationFrame(()=>{uvRenderGlobal();uvDrawSelection('orig');uvDrawSelection('gen');uvRefreshContours()})}
function uvRenderWorkCanvasOnly(){if(!uvMap.work)return;const d=$('uvGenCanvas');d.width=uvMap.work.width;d.height=uvMap.work.height;d.getContext('2d').drawImage(uvMap.work,0,0)}
function uvPoint(e){const canvas=$('uvGenCanvas'),wrap=$('uvLiveWrap'),r=wrap.getBoundingClientRect(),bx=(e.clientX-r.left-uvMap.panX)/uvMap.zoom,by=(e.clientY-r.top-uvMap.panY)/uvMap.zoom;return{x:Math.max(0,Math.min(canvas.width-1,Math.floor(bx*canvas.width/wrap.clientWidth))),y:Math.max(0,Math.min(canvas.height-1,Math.floor(by*canvas.height/wrap.clientHeight)))}}
function bindUvWorkspace(){const wrap=$('uvLiveWrap');let start=null,pid=null;wrap.addEventListener('pointerdown',e=>{if(uvManualObjectPick(e)){e.preventDefault();return}if(uvManualLinkPick(e)){e.preventDefault();return}if(uvMap.panMode||uvMap.pointers.size){return}if(e.target.closest('.uvSelection'))return;pid=e.pointerId;wrap.setPointerCapture?.(pid);start=uvPoint(e);uvMap.handle='move';if(uvMap.islandMode){uvMap.target='orig';uvMap.origSel={x:start.x,y:start.y,w:1,h:1};$('uvOrigSel').style.display='block';$('uvGenSel').style.display='none';uvDrawSelection('orig')}else{uvMap.target='gen';uvMap.genSel={x:start.x,y:start.y,w:1,h:1};uvMap.origSel={...uvMap.genSel};uvDrawSelection('orig');uvDrawSelection('gen')}e.preventDefault()});wrap.addEventListener('pointermove',e=>{if(e.pointerId!==pid||!start)return;const p=uvPoint(e),x=Math.min(start.x,p.x),y=Math.min(start.y,p.y),sel={x,y,w:Math.abs(p.x-start.x)+1,h:Math.abs(p.y-start.y)+1};if(uvMap.islandMode){uvMap.origSel={...sel};$('uvOrigSel').style.display='block';uvDrawSelection('orig')}else{uvMap.genSel={...sel};const sx=uvMap.orig.width/Math.max(1,uvMap.work.width),sy=uvMap.orig.height/Math.max(1,uvMap.work.height);uvMap.origSel=uvClampSel({x:Math.round(sel.x*sx),y:Math.round(sel.y*sy),w:Math.max(1,Math.round(sel.w*sx)),h:Math.max(1,Math.round(sel.h*sy))},uvMap.orig.width,uvMap.orig.height);uvDrawSelection('orig');uvDrawSelection('gen')}uvTransformStatus();uvStatus();e.preventDefault()});const end=e=>{if(e.pointerId===pid){pid=null;start=null}};wrap.addEventListener('pointerup',end);wrap.addEventListener('pointercancel',end)}
async function openUvMapper(){const x=variantSelectedMeta(),rec=variantList()[variantSelectedIndex];if(!x||!rec)return;const ob=await originalBlob(x.path),oc=await decodeBlobToCanvas(ob),gc=await decodeBlobToCanvas(rec.blob),wc=document.createElement('canvas');wc.width=gc.width;wc.height=gc.height;wc.getContext('2d').drawImage(gc,0,0);uvMap.meta=x;uvMap.rec=rec;uvMap.orig=oc;uvMap.gen=gc;uvMap.work=wc;uvMap.history=[];uvMap.target='gen';uvMap.handle='move';uvMap.globalX=0;uvMap.globalY=0;uvMap.globalMode=false;uvMap.zoom=1;uvMap.panX=uvMap.panY=0;uvMap.panMode=false;uvMap.pointers.clear();uvMap.grid=true;uvMap.autoTarget=null;uvMap.autoSource=null;uvMap.autoPairs=[];uvMap.contours=true;uvMap.manualLink=false;uvMap.manualTarget=null;uvMap.autoBase=null;uvMap.autoApplied=false;uvMap.bgMode=$('uvBgMode')?.value||'auto';uvMap.excludeMode=false;uvMap.excludedTarget.clear();uvMap.excludedSource.clear();uvMap.manualSource=null;uvMap.islandMode=false;uvMap.objectPick=null;uvMap.selectedSourceComp=null;uvMap.selectedTargetComp=null;uvMap.maskLock=true;uvMap.nudgeStep=1;const d=$('uvOrigCanvas');d.width=oc.width;d.height=oc.height;d.getContext('2d').drawImage(oc,0,0);const base={x:0,y:0,w:Math.max(1,Math.floor(oc.width/8)),h:Math.max(1,Math.floor(oc.height/8))};uvMap.origSel={...base};const rsx=wc.width/Math.max(1,oc.width),rsy=wc.height/Math.max(1,oc.height);uvMap.genSel={x:0,y:0,w:Math.max(1,Math.round(base.w*rsx)),h:Math.max(1,Math.round(base.h*rsy))};$('uvMapMeta').textContent=x.name;uvIslandLoad();$('uvMapper').classList.add('open');if($('uvManualTools'))$('uvManualTools').open=true;$('uvOrigSel').style.display='none';$('uvGenSel').style.display='none';uvRenderWork();uvSetView('overlay');uvSetZoom(1);uvSetHandle('gen','move');uvStatus();uvUpdateObjectPickUi();setTimeout(()=>{uvAnalyzeSmart();$('uvContourToggle').classList.toggle('primary',uvMap.contours)},0)}
function uvSetHandle(kind,handle){uvMap.target=kind;uvMap.handle=handle;document.querySelectorAll('.uvHandle,.uvMoveCenter').forEach(x=>x.classList.remove('active'));const root=$(kind==='orig'?'uvOrigSel':'uvGenSel'),h=root?.querySelector('[data-corner="'+handle+'"]');h?.classList.add('active');$('uvTargetToggle').textContent='Joystick: '+(kind==='orig'?'Hedef':'Kaynak')+' · '+(handle==='move'?'Taşı':handle.toUpperCase())}
function uvMoveTarget(dx,dy){const kind=uvMap.target,s=uvMap[kind+'Sel'],canvas=$(kind==='orig'?'uvOrigCanvas':'uvGenCanvas');if(!s||!canvas)return;const right=s.x+s.w-1,bottom=s.y+s.h-1,h=uvMap.handle;if(h==='move'){s.x+=dx;s.y+=dy}else if(h==='tl'){const nx=Math.max(0,Math.min(right,s.x+dx)),ny=Math.max(0,Math.min(bottom,s.y+dy));s.w=right-nx+1;s.h=bottom-ny+1;s.x=nx;s.y=ny}else if(h==='tr'){const nr=Math.max(s.x,Math.min(canvas.width-1,right+dx)),ny=Math.max(0,Math.min(bottom,s.y+dy));s.w=nr-s.x+1;s.h=bottom-ny+1;s.y=ny}else if(h==='bl'){const nx=Math.max(0,Math.min(right,s.x+dx)),nb=Math.max(s.y,Math.min(canvas.height-1,bottom+dy));s.w=right-nx+1;s.h=nb-s.y+1;s.x=nx}else if(h==='br'){const nr=Math.max(s.x,Math.min(canvas.width-1,right+dx)),nb=Math.max(s.y,Math.min(canvas.height-1,bottom+dy));s.w=nr-s.x+1;s.h=nb-s.y+1}uvClampSel(s,canvas.width,canvas.height);uvDrawSelection(kind);uvStatus()}

document.querySelectorAll('[data-uvsize]').forEach(b=>b.onclick=()=>{const p=b.dataset.uvsize.split(',').map(Number);uvResizeSource(p[0],p[1])});
$('uvFitTarget').onclick=()=>uvApplyCurrentTransform(true,true);
$('uvPickGenerated').onclick=()=>uvSetObjectPick('source');
$('uvPickOriginal').onclick=()=>uvSetObjectPick('target');
$('uvApplyMaskedFit').onclick=()=>uvApplyCurrentTransform(true,true);
$('uvClearObjectPick').onclick=()=>uvClearObjectPick();
$('uvPreview3dLive').onclick=async()=>{if(!uvMap.meta||!uvMap.work)return;try{const p=await ensurePreview3dLoaded(),workBlob=await canvasPngBlob(uvMap.work),origBlob=await originalBlob(uvMap.meta.path),live=[{blob:origBlob,name:'Orijinal',system:true},{blob:workBlob,name:'Canlı UV',system:true}];await p?.openVariant?.(uvMap.meta,workBlob,'Canlı UV',live,1)}catch(err){console.error(err);toast(err?.message||'3D karşılaştırma açılamadı')}};



$('uvBgMode').onchange=e=>{uvMap.bgMode=e.target.value;uvMap.autoTarget=null;uvMap.autoSource=null;uvMap.autoPairs=[];uvAnalyzeSmart()};
$('uvDetectIslands').onclick=()=>uvAnalyzeSmart();

$('uvManualLink').onclick=()=>{uvMap.manualLink=!uvMap.manualLink;uvMap.excludeMode=false;uvMap.edgePickSide='target';uvMap.selectedTargetSegment=null;uvMap.selectedSourceSegment=null;$('uvConfirmEdgeMatch').style.display='none';uvMap.panMode=false;uvMap.globalMode=false;uvMap.pointers.clear();$('uvPanToggle').classList.remove('primary');$('uvLiveWrap').classList.remove('panMode');$('uvExcludeContour').classList.remove('primary');$('uvManualLink').classList.toggle('primary',uvMap.manualLink);$('uvManualLink').textContent=uvMap.manualLink?'Kenar Eşle: İptal':'Kenar Eşle';if(uvMap.manualLink){if(!uvMap.autoTarget||!uvMap.autoSource)uvAnalyzeSmart();uvSetView('lines');$('uvAutoMeta').textContent='1/2 · Orijinal (yeşil) kenarı seç'}else uvRefreshContours()};
$('uvConfirmEdgeMatch').onclick=()=>{if(!uvMap.selectedTargetSegment||!uvMap.selectedSourceSegment)return;uvMap.edgePairs.push({targetSegment:uvMap.selectedTargetSegment,sourceSegment:uvMap.selectedSourceSegment,manual:true});uvMap.selectedTargetSegment=null;uvMap.selectedSourceSegment=null;uvMap.edgePickSide='target';$('uvConfirmEdgeMatch').style.display='none';uvRefreshContours();$('uvAutoMeta').textContent='K'+uvMap.edgePairs.length+' kaydedildi · sonraki Orijinal kenarı seç';toast('Kenar çifti eşlendi')};
$('uvExcludeContour').onclick=()=>{uvMap.excludeMode=!uvMap.excludeMode;uvMap.manualLink=false;uvMap.manualSource=null;$('uvManualLink').classList.remove('primary');$('uvManualLink').textContent='Manuel Eşle';$('uvExcludeContour').classList.toggle('primary',uvMap.excludeMode);$('uvExcludeContour').textContent=uvMap.excludeMode?'Eleme: İptal':'Kenar Ele';if(uvMap.excludeMode){uvMap.panMode=false;uvMap.pointers.clear();$('uvPanToggle').classList.remove('primary');$('uvAutoMeta').textContent='Orijinal veya Üretilen görünümünde elenecek sınıra dokun'}};
$('uvClearMatches').onclick=()=>{uvMap.autoPairs=[];uvMap.manualSource=null;uvMap.edgePairs=[];uvMap.selectedTargetSegment=null;uvMap.selectedSourceSegment=null;$('uvConfirmEdgeMatch').style.display='none';uvMap.excludedTarget.clear();uvMap.excludedSource.clear();uvMap.autoBase=null;uvMap.autoApplied=false;uvRefreshContours();$('uvAutoMeta').textContent='Eşlemeler ve elemeler temizlendi'};

$('uvAutoMatch').onclick=()=>uvAutoMatchSmart();
$('uvAutoWarp').onclick=()=>uvAutoWarpSmart();
$('uvContourToggle').onclick=()=>{uvMap.contours=!uvMap.contours;$('uvContourToggle').classList.toggle('primary',uvMap.contours);uvRefreshContours()};

$('uvZoomIn').onclick=()=>uvSetZoom(uvMap.zoom*1.5);
$('uvZoomOut').onclick=()=>uvSetZoom(uvMap.zoom/1.5);
$('uvZoomReset').onclick=()=>{uvMap.panX=uvMap.panY=0;uvSetZoom(1)};
$('uvZoomFocus').onclick=uvFocusSelection;
$('uvPanToggle').onclick=()=>{uvMap.panMode=!uvMap.panMode;$('uvPanToggle').classList.toggle('primary',uvMap.panMode);$('uvLiveWrap').classList.toggle('panMode',uvMap.panMode)};
$('uvGridToggle').onclick=()=>{uvMap.grid=!uvMap.grid;$('uvGridToggle').classList.toggle('primary',uvMap.grid);uvRenderGrid()};

$('uvMapClose').onclick=()=>$('uvMapper').classList.remove('open');
document.querySelectorAll('[data-uvview]').forEach(b=>b.onclick=()=>uvSetView(b.dataset.uvview));
$('uvOverlayRange').oninput=e=>{$('uvOverlayValue').textContent=e.target.value+'%';if(uvMap.view==='overlay')$('uvGenCanvas').style.opacity=String(Number(e.target.value)/100)};

document.querySelectorAll('[data-uvshift]').forEach(b=>b.onclick=()=>{const p=b.dataset.uvshift.split(',').map(Number);uvShiftGlobal(p[0],p[1])});
$('uvGlobalReset').onclick=()=>{uvMap.globalX=uvMap.globalY=0;uvRenderGlobal()};
$('uvGlobalApply').onclick=()=>{if(!uvMap.work||(!uvMap.globalX&&!uvMap.globalY))return;const before=uvMap.work.getContext('2d').getImageData(0,0,uvMap.work.width,uvMap.work.height),tmp=document.createElement('canvas');tmp.width=uvMap.work.width;tmp.height=uvMap.work.height;tmp.getContext('2d').drawImage(uvMap.work,uvMap.globalX,uvMap.globalY);uvMap.history.push(before);uvMap.work.getContext('2d').clearRect(0,0,uvMap.work.width,uvMap.work.height);uvMap.work.getContext('2d').drawImage(tmp,0,0);uvMap.globalX=uvMap.globalY=0;uvRenderWork();uvStatus();toast('Global kaydırma canlı çalışmaya uygulandı')};

$('uvAddPair').onclick=()=>uvApplyCurrentTransform(false,true);
$('uvUndoPair').onclick=()=>{const prev=uvMap.history.pop();if(!prev)return;uvMap.work.getContext('2d').putImageData(prev,0,0);uvMap.autoSource=null;uvMap.autoPairs=[];uvMap.autoBase=null;uvMap.autoApplied=false;uvMap.selectedSourceComp=null;uvMap.selectedTargetComp=null;uvRenderWork();uvAnalyzeSmart();uvRefreshContours();uvUpdateObjectPickUi();uvStatus()};
$('uvTargetToggle').onclick=()=>{if(uvMap.globalMode){uvMap.globalMode=false;uvSetHandle('gen','move')}else if(uvMap.target==='gen'){uvMap.globalMode=false;uvSetHandle('orig','move')}else{uvMap.globalMode=true;$('uvTargetToggle').textContent='Joystick: Tüm resim'}};
function bindModularIslandLauncher(){const b=$('detailIslandStudio');if(!b)return;b.onclick=()=>{const x=active;if(!x||assetTypeOf(x)!=='Entity')return toast('Ada yalnız Entity için');const path=x.path;closeDetailSheet();if(window.MTSIslandStudio?.open)window.MTSIslandStudio.open(path);else toast('Ada modülü yüklenemedi')}}
bindModularIslandLauncher();
document.querySelectorAll('[data-uvstep]').forEach(b=>b.onclick=()=>{uvMap.nudgeStep=Math.max(1,Number(b.dataset.uvstep)||1);document.querySelectorAll('[data-uvstep]').forEach(x=>x.classList.toggle('primary',x===b));toast('Joystick adımı '+uvMap.nudgeStep+' px')});
$('uvApplyFix').onclick=async()=>{if(!uvMap.meta||!uvMap.rec)return;const blob=await canvasPngBlob(uvMap.work),list=variantUserList();list.push({blob,name:(uvMap.rec.name||'varyant').replace(/\.png$/i,'')+'_UV_FIXED.png',enabled:true,url:null,addedAt:Date.now(),rawAlpha:true,uvFixed:true});variantSelectedIndex=variantSources.length+list.length-1;$('uvMapper').classList.remove('open');window.MTSVariantLab?.render?.();toast('Düzeltilmiş UV varyanta kaydedildi')};
const manualTools=$('uvManualTools');
if(manualTools)manualTools.addEventListener('toggle',()=>{const show=manualTools.open;$('uvOrigSel').style.display=show?'block':'none';$('uvGenSel').style.display=show?'block':'none';if(show){uvDrawSelection('orig');uvDrawSelection('gen')}});
bindUvWorkspace();
function bindUvPanGestures(){const wrap=$('uvLiveWrap'),pts=()=>[...uvMap.pointers.values()];wrap.addEventListener('pointerdown',e=>{if(!uvMap.panMode&&uvMap.pointers.size===0)return;if(e.target.closest('.uvSelection')&&!uvMap.panMode)return;wrap.setPointerCapture?.(e.pointerId);uvMap.pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});if(uvMap.pointers.size===2){const p=pts();uvMap.pinchDist=Math.hypot(p[1].x-p[0].x,p[1].y-p[0].y)};e.preventDefault()},true);wrap.addEventListener('pointermove',e=>{if(!uvMap.pointers.has(e.pointerId))return;const old=uvMap.pointers.get(e.pointerId);uvMap.pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});const p=pts();if(p.length===1&&uvMap.panMode){uvMap.panX+=e.clientX-old.x;uvMap.panY+=e.clientY-old.y;uvApplyTransform()}else if(p.length>=2){const d=Math.hypot(p[1].x-p[0].x,p[1].y-p[0].y),r=wrap.getBoundingClientRect(),cx=(p[0].x+p[1].x)/2-r.left,cy=(p[0].y+p[1].y)/2-r.top;if(uvMap.pinchDist)uvSetZoom(uvMap.zoom*d/uvMap.pinchDist,cx,cy);uvMap.pinchDist=d}e.preventDefault()},true);const end=e=>{uvMap.pointers.delete(e.pointerId);if(uvMap.pointers.size<2)uvMap.pinchDist=0};wrap.addEventListener('pointerup',end,true);wrap.addEventListener('pointercancel',end,true)}
bindUvPanGestures();
document.querySelectorAll('#uvOrigSel [data-corner],#uvGenSel [data-corner]').forEach(h=>{let pid=null,last=null;h.addEventListener('pointerdown',e=>{e.preventDefault();e.stopPropagation();pid=e.pointerId;last={x:e.clientX,y:e.clientY};h.setPointerCapture?.(pid);uvSetHandle(h.closest('#uvOrigSel')?'orig':'gen',h.dataset.corner)});h.addEventListener('pointermove',e=>{if(e.pointerId!==pid||!last)return;e.preventDefault();e.stopPropagation();const kind=uvMap.target,canvas=$(kind==='orig'?'uvOrigCanvas':'uvGenCanvas'),r=canvas.getBoundingClientRect(),dx=Math.round((e.clientX-last.x)*canvas.width/r.width),dy=Math.round((e.clientY-last.y)*canvas.height/r.height);if(dx||dy){uvMoveTarget(dx,dy);last={x:e.clientX,y:e.clientY}}});const end=e=>{if(e.pointerId===pid){pid=null;last=null;e.stopPropagation()}};h.addEventListener('pointerup',end);h.addEventListener('pointercancel',end)});
{const joy=$('uvJoystick'),stick=$('uvStick');let pid=null,jx=0,jy=0,timer=0,last=0;const move=e=>{if(e.pointerId!==pid)return;const r=joy.getBoundingClientRect(),cx=r.left+r.width/2,cy=r.top+r.height/2,lim=r.width*.32,dx=e.clientX-cx,dy=e.clientY-cy,d=Math.hypot(dx,dy)||1,k=Math.min(1,lim/d),px=dx*k,py=dy*k;jx=px/lim;jy=py/lim;stick.style.transform='translate('+px+'px,'+py+'px)';e.preventDefault();e.stopPropagation()};const loop=t=>{if(pid===null){timer=0;return}if(t-last>85){const dx=Math.abs(jx)>.28?Math.sign(jx):0,dy=Math.abs(jy)>.28?Math.sign(jy):0;if(dx||dy){const step=Math.max(1,uvMap.nudgeStep||1);if(uvMap.globalMode)uvShiftGlobal(dx*step,dy*step);else uvMoveTarget(dx*step,dy*step)}last=t}timer=requestAnimationFrame(loop)};joy.addEventListener('pointerdown',e=>{pid=e.pointerId;joy.setPointerCapture?.(pid);move(e);if(!timer)timer=requestAnimationFrame(loop)});joy.addEventListener('pointermove',move);const end=e=>{if(e.pointerId!==pid)return;pid=null;jx=jy=0;stick.style.transform='translate(0,0)';if(timer){cancelAnimationFrame(timer);timer=0}};joy.addEventListener('pointerup',end);joy.addEventListener('pointercancel',end)}

const openVariant=(meta)=>window.MTSVariantLab?window.MTSVariantLab.open(meta):toast('Varyant Lab modülü yüklenemedi');
$('openVariantLab').onclick=()=>openVariant(active||null);$('detailVariantLab').onclick=()=>openVariant(active);


document.querySelector('.tileTools').addEventListener('click',async e=>{const b=e.target.closest('[data-tile]');if(b){tileN=Number(b.dataset.tile);if(active&&active.w!==active.h&&tileN>1){toast('Tile görünümü kare texture için');tileN=1}await updateTilePreview();return}if(e.target.id==='tileSource'){if(!active)return;const edit=await getEdit(active.path);if(!edit){tileEdited=false;toast('Bu texture henüz düzenlenmedi')}else tileEdited=!tileEdited;$('tileSource').textContent=tileEdited?'Yeni':'Orijinal';await updateTilePreview()}});
$('mobHqPrompt').onclick=()=>copyMobPrompt('hq');
$('mobRefPrompt').onclick=()=>copyMobPrompt('ref');
$('mobFinalPrompt').onclick=()=>copyMobPrompt('final');
$('copyPrompt').onclick=async()=>{
 if(!active)return;
 const text=active.priority==='P0'?p0ReferencePromptFor(active):$('promptText').value;
 try{await navigator.clipboard.writeText(text)}catch{const ta=document.createElement('textarea');ta.value=text;document.body.appendChild(ta);ta.select();document.execCommand('copy');ta.remove()}
 toast(active.priority==='P0'?'Ref prompt kopyalandı':'Prompt kopyalandı');
};
$('savePrompt').onclick=async()=>{
 if(!active)return;
 if(active.priority==='P0'){
   try{await navigator.clipboard.writeText(p0ProductionPromptFor(active))}catch{const ta=document.createElement('textarea');ta.value=p0ProductionPromptFor(active);document.body.appendChild(ta);ta.select();document.execCommand('copy');ta.remove()}
   toast('Üretim promptu kopyalandı');return;
 }
 PROMPT_OVERRIDES.set(active.id,$('promptText').value);savePromptOverrides();renderActivePrompt();toast("Prompt bu texture ID'sine kaydedildi");
};
$('singlePromptJson').onclick=()=>{if(!active)return;const suffix=promptViewMode==='creative'?'_creative_prompt.json':'_prompt.json';downloadJson(promptEntry(active,promptViewMode),active.id+suffix)};
$('promptJson').onclick=()=>{$('promptJsonPreview').value='';$('promptManager').classList.add('open')};
$('exportProjectBackup').onclick=exportProjectBackup;$('importProjectBackup').onclick=()=>$('fileProjectBackup').click();$('fileProjectBackup').onchange=async e=>{try{if(e.target.files[0])await importProjectBackup(e.target.files[0])}catch(err){alert('Proje yedeği açılamadı: '+err.message)}e.target.value=''};
$('closePromptMgr').onclick=()=>$('promptManager').classList.remove('open');
$('promptManager').onclick=e=>{if(e.target===$('promptManager'))$('promptManager').classList.remove('open')};
$('importPromptJson').onclick=()=>$('filePromptJson').click();
$('filePromptJson').onchange=async e=>{const f=e.target.files[0];if(!f)return;try{applyPromptJsonObject(JSON.parse(await f.text()))}catch(err){alert('Prompt JSON hatası: '+err.message)}e.target.value=''};
$('applyPromptJsonText').onclick=()=>{try{applyPromptJsonObject(JSON.parse($('promptJsonPreview').value))}catch(err){alert('Prompt JSON hatası: '+err.message)}};
$('exportAllPrompts').onclick=()=>downloadJson({version:1,generated_at:new Date().toISOString(),prompts:CATALOG.map(promptEntry)},'mineclonia_all_prompts.json');
$('exportP0Prompts').onclick=()=>downloadJson({version:1,priority:'P0',mode:'classic',prompts:CATALOG.filter(x=>x.priority==='P0').map(x=>promptEntry(x,'classic'))},'mineclonia_P0_prompts.json');
$('clearPromptOverrides').onclick=()=>{if(!confirm('JSON/manuel prompt değişiklikleri sıfırlansın mı?'))return;PROMPT_OVERRIDES.clear();savePromptOverrides();toast('Özel promptlar sıfırlandı');if(active)openDetail(active)};
async function resetStoredEditsByPriorities(priorities){
 const wanted=new Set(priorities),paths=CATALOG.filter(x=>wanted.has(x.priority)).map(x=>x.path);
 if(!paths.length)return;
 if(!confirm(`${priorities.join(', ')} için kayıtlı texture değişiklikleri silinsin mi? Promptlar korunacak.`))return;
 setSaveState(`${priorities.join(', ')} kayıtları temizleniyor…`,'warn');
 try{
   if(storageMode==='indexeddb'&&dbp){
     await new Promise((res,rej)=>{const tx=dbp.transaction(STORE,'readwrite'),st=tx.objectStore(STORE);for(const path of paths)st.delete(path);tx.oncomplete=res;tx.onabort=()=>rej(tx.error);tx.onerror=()=>rej(tx.error)});
   }
   if(scaledDbp){
     await new Promise((res,rej)=>{const tx=scaledDbp.transaction(SCALED_STORE,'readwrite'),st=tx.objectStore(SCALED_STORE);for(const path of paths)for(const size of [64,128,256,512])st.delete(scaledMemKey(path,size));tx.oncomplete=res;tx.onabort=()=>rej(tx.error);tx.onerror=()=>rej(tx.error)}).catch(err=>console.warn('Scaled cache toplu silinemedi',err));
   }
   for(const path of paths){
     hotEdits.delete(path);memoryEdits.delete(path);changedPathsFast.delete(path);pendingChangedPaths.delete(path);revoke(path);
     try{localStorage.removeItem('mts:'+path)}catch(_){}
     for(const size of [64,128,192,256,512])memoryScaled.delete(scaledMemKey(path,size));
   }
   await applyFilter();updateStatFast();
   setSaveState('Kayıt temizliği tamamlandı','ok');toast(`${priorities.join(', ')} temizlendi`);
 }catch(err){console.error('priority reset',err);setSaveState('Kayıt temizliği hatası','bad');alert('Kayıtlar temizlenemedi: '+(err?.message||err))}
}
$('priorityResetBtns').onclick=e=>{const b=e.target.closest('[data-reset-priority]');if(b)resetStoredEditsByPriorities([b.dataset.resetPriority])};
$('resetFuturePriorities').onclick=()=>resetStoredEditsByPriorities(['P2','P3','P4','P5','P6']);
$('copyPromptSchema').onclick=async()=>{const sample={prompts:[{path:CATALOG[0].path,prompt:'Yeni prompt metni'},{id:CATALOG[1].id,prompt:'İkinci prompt'}]};const t=JSON.stringify(sample,null,2);try{await navigator.clipboard.writeText(t);toast('JSON şeması kopyalandı')}catch{$('promptJsonPreview').value=t}};


const BACKGROUND_RESOLUTION = 256;
const SCALED_DB='MinecloniaTextureStudioScaled';
const SCALED_STORE='scaled';
let scaledDbp=null;
const memoryScaled=new Map();
const scaleQueue=[];
const scaleQueued=new Set();
let scaleRunning=false;

function scaledMemKey(path,res){return res+'|'+path}
async function initScaledStorage(){
  if(!('indexedDB' in window)) return;
  try{
    scaledDbp = await new Promise((res,rej)=>{
      let settled=false;
      const r=indexedDB.open(SCALED_DB,1);
      const finish=(fn,value)=>{if(settled)return;settled=true;clearTimeout(timer);fn(value)};
      const timer=setTimeout(()=>{settled=true;rej(Error('Scaled IndexedDB açılışı zaman aşımına uğradı'))},2500);
      r.onupgradeneeded=()=>{ if(!r.result.objectStoreNames.contains(SCALED_STORE)) r.result.createObjectStore(SCALED_STORE,{keyPath:'key'}); };
      r.onsuccess=()=>{if(settled){try{r.result.close()}catch(_){};return}finish(res,r.result)};
      r.onerror=()=>finish(rej,r.error||Error('Scaled IndexedDB açılamadı'));
      r.onblocked=()=>finish(rej,Error('Scaled IndexedDB blocked'));
    });
  }catch(e){ console.warn('scaled storage unavailable',e); scaledDbp=null; }
}
async function putScaled(path,res,blob){
  const key = scaledMemKey(path,res);
  if(scaledDbp){
    try{
      await new Promise((resolve,reject)=>{
        const tx=scaledDbp.transaction(SCALED_STORE,'readwrite');
        tx.objectStore(SCALED_STORE).put({key,path,res,blob,updatedAt:Date.now()});
        tx.oncomplete=resolve; tx.onerror=()=>reject(tx.error);
      });
      return;
    }catch(e){ console.warn('putScaled failed',e); }
  }
  memoryScaled.set(key,{key,path,res,blob,updatedAt:Date.now()});
}
async function getScaled(path,res){
  const key = scaledMemKey(path,res);
  if(scaledDbp){
    try{
      return await new Promise((resolve,reject)=>{
        const r=scaledDbp.transaction(SCALED_STORE).objectStore(SCALED_STORE).get(key);
        r.onsuccess=()=>resolve(r.result||null); r.onerror=()=>reject(r.error);
      });
    }catch(e){ console.warn('getScaled failed',e); }
  }
  return memoryScaled.get(key)||null;
}
async function delScaledPath(path){
  const keys=[64,128,192,256,512].map(res=>scaledMemKey(path,res));
  if(scaledDbp){
    try{
      await new Promise((resolve,reject)=>{
        const tx=scaledDbp.transaction(SCALED_STORE,'readwrite');
        const st=tx.objectStore(SCALED_STORE); keys.forEach(k=>st.delete(k));
        tx.oncomplete=resolve; tx.onerror=()=>reject(tx.error);
      });
    }catch(e){ console.warn('delScaledPath failed',e); }
  }
  keys.forEach(k=>memoryScaled.delete(k));
}
const SOURCE_TEXEL_BASE=16;
function targetTextureDimensions(meta,targetRes){
 const baseW=Math.max(1,Number(meta?.w)||SOURCE_TEXEL_BASE);
 const baseH=Math.max(1,Number(meta?.h)||SOURCE_TEXEL_BASE);
 const scale=Math.max(1,targetRes)/SOURCE_TEXEL_BASE;
 return {width:Math.max(1,Math.round(baseW*scale)),height:Math.max(1,Math.round(baseH*scale))};
}
async function resizeTextureBlobToDimensions(blob,dw,dh){
 const c=await decodeBlobToCanvas(blob),sw=c.width,sh=c.height;
 if(sw===dw&&sh===dh)return blob;
 const src=c.getContext('2d',{willReadFrequently:true}).getImageData(0,0,sw,sh);
 const resized=lanczosResizeImageData(src,sw,sh,dw,dh);
 const out=document.createElement('canvas');out.width=dw;out.height=dh;out.getContext('2d').putImageData(resized,0,0);
 return await canvasPngBlob(out)
}
async function normalizeTextureBlobTo(blob,meta,targetRes){
 const c=await decodeBlobToCanvas(blob),sw=c.width,sh=c.height;
 const target=targetTextureDimensions(meta,targetRes);
 const baseW=Math.max(1,Number(meta?.w)||sw),baseH=Math.max(1,Number(meta?.h)||sh);
 const ratio=baseW/baseH;
 const maxW=Math.min(sw,target.width),maxH=Math.min(sh,target.height);
 let dw=Math.max(1,Math.floor(Math.min(maxW,maxH*ratio)));
 let dh=Math.max(1,Math.round(dw/ratio));
 if(dh>maxH){dh=Math.max(1,Math.floor(maxH));dw=Math.max(1,Math.round(dh*ratio))}
 if(sw===dw&&sh===dh)return blob;
 return await resizeTextureBlobToDimensions(blob,dw,dh)
}
async function normalizeTextureBlob(blob,meta,targetRes=TARGET_RESOLUTION){
 return await normalizeTextureBlobTo(blob,meta,targetRes)
}
function queueScaled(path, blob, meta, res=BACKGROUND_RESOLUTION){
  const qk=scaledMemKey(path,res);
  if(scaleQueued.has(qk)) return;
  scaleQueued.add(qk);
  scaleQueue.push({path,blob,meta,res,qk});
  if(!scaleRunning) setTimeout(processScaleQueue,0);
}
async function processScaleQueue(){
  if(scaleRunning) return;
  scaleRunning=true;
  try{
    while(scaleQueue.length){
      const job=scaleQueue.shift();
      try{
        const existing=await getScaled(job.path,job.res);
        if(!existing || !(await blobsEqual(existing.blob, await normalizeTextureBlobTo(job.blob,job.meta,job.res)))){
          const scaled=await normalizeTextureBlobTo(job.blob,job.meta,job.res);
          await putScaled(job.path,job.res,scaled);
        }
      }catch(err){ console.warn('scale job failed',job.path,err); }
      finally{ scaleQueued.delete(job.qk); }
      await new Promise(r=>setTimeout(r,0));
    }
  } finally { scaleRunning=false; }
}
async function warmScaledForExisting(res=BACKGROUND_RESOLUTION){
  const edits=await allEdits();
  for(const e of edits){
    const meta=CATALOG.find(x=>x.path===e.path); if(!meta) continue;
    const cached=await getScaled(e.path,res); if(cached) continue;
    queueScaled(e.path,e.blob,meta,res);
  }
}
async function putEdit(path,blob){
 if(storageMode==='indexeddb'&&dbp){try{await new Promise((res,rej)=>{const tx=dbp.transaction(STORE,'readwrite');tx.objectStore(STORE).put({path,blob,updatedAt:Date.now()});tx.oncomplete=res;tx.onerror=()=>rej(tx.error)});revoke(path);return}catch(e){console.warn(e);storageMode='local'}}
 if(storageMode==='local'){await localPut(path,blob)}else memoryEdits.set(path,{path,blob,updatedAt:Date.now()});revoke(path)
}
async function delEdit(path){
 if(storageMode==='indexeddb'&&dbp){try{await new Promise((res,rej)=>{const tx=dbp.transaction(STORE,'readwrite');tx.objectStore(STORE).delete(path);tx.oncomplete=res;tx.onerror=()=>rej(tx.error)})}catch(e){storageMode='local'}}
 if(storageMode==='local'){try{localStorage.removeItem('mts:'+path)}catch(e){storageMode='memory'}}else memoryEdits.delete(path);
 await delScaledPath(path); revoke(path)
}
async function importPng(file,seam=false){
  if(!active||!file)return;
  toast('Texture kaydediliyor…');
  let b=file;
  if(seam)b=await imageBlobTransform(b,true);
  await putEdit(active.path,b);
  queueScaled(active.path,b,active,BACKGROUND_RESOLUTION);
  if(TARGET_RESOLUTION!==BACKGROUND_RESOLUTION) queueScaled(active.path,b,active,TARGET_RESOLUTION);
  toast((seam?'Seam dönüşü':'Yeni texture')+' kaydedildi · 256px kopya arka planda hazırlanıyor');
  await openDetail(active); await applyFilter();
}
async function importZip(file){
 const z=await JSZip.loadAsync(file);let changed=0,same=0,ambiguous=0,processed=0;
 const pngs=Object.entries(z.files).filter(([path,f])=>!f.dir&&path.toLowerCase().endsWith('.png'));
 setSaveState(`ZIP içe aktarılıyor • 0/${pngs.length}`,'warn');
 for(const [path,f] of pngs){
   const meta=catalogMatchForZipPath(path);if(!meta){ambiguous++;continue}
   let blob=await f.async('blob');
   blob=await prepareStoredEditBlob(blob,meta);
   try{
     if(await textureMatchesOriginal(blob,meta)){await delEdit(meta.path);same++;processed++;continue}
   }catch(err){console.warn(err)}
   await putEdit(meta.path,blob);
   queueScaled(meta.path,blob,meta,BACKGROUND_RESOLUTION);
   if(TARGET_RESOLUTION!==BACKGROUND_RESOLUTION) queueScaled(meta.path,blob,meta,TARGET_RESOLUTION);
   changed++;processed++;
   if(processed===1||processed===pngs.length||processed%20===0){setSaveState(`ZIP içe aktarılıyor • ${processed}/${pngs.length}`,'warn');await new Promise(requestAnimationFrame)}
 }
 toast(`${changed} değişiklik içe aktarıldı • ${same} birebir orijinal yok sayıldı${ambiguous?` • ${ambiguous} eşleşmedi`:''}`);
 setSaveState('İçe aktarma tamamlandı','ok');applyFilter()
}
async function importProjectBackup(file){
 const z=await JSZip.loadAsync(file);const mf=z.file('Mineclonia_Texture_Studio_Backup/manifest.json')||z.file('manifest.json');
 if(!mf)throw new Error('Geçerli proje yedeği değil');const m=JSON.parse(await mf.async('string'));
 if(m.format!=='mineclonia-texture-studio-backup')throw new Error('Yedek formatı tanınmadı');if([64,128,256,512].includes(m.targetResolution)){TARGET_RESOLUTION=m.targetResolution;if($('resolution'))$('resolution').value=String(TARGET_RESOLUTION)}
 let ok=0,missing=0;for(const e of (m.edits||[])){const x=CATALOG.find(v=>v.id===e.id)||CATALOG.find(v=>v.path===e.path);const f=z.file('Mineclonia_Texture_Studio_Backup/'+e.file)||z.file(e.file);if(!x||!f){missing++;continue}const blob=await f.async('blob');await putEdit(x.path,blob);queueScaled(x.path,blob,x,BACKGROUND_RESOLUTION);if(TARGET_RESOLUTION!==BACKGROUND_RESOLUTION)queueScaled(x.path,blob,x,TARGET_RESOLUTION);ok++;}
 let pc=0;if(m.promptOverrides&&typeof m.promptOverrides==='object'){for(const [id,prompt] of Object.entries(m.promptOverrides)){if(CATALOG.some(x=>x.id===id)&&typeof prompt==='string'){PROMPT_OVERRIDES.set(id,prompt);pc++;}}savePromptOverrides();}
 await applyFilter();toast(`${ok} düzenleme, ${pc} prompt geri yüklendi${missing?`, ${missing} eşleşmedi`:''}`)
}
async function exportPack(){
 const btn=$('exportPack');
 const originalLabel=btn.textContent;
 btn.disabled=true;
 btn.textContent='Hazırlanıyor…';
 setSaveState('Texturepack hazırlanıyor…','warn');
 try{
   btn.textContent='Değişiklikler doğrulanıyor…';
   await changedHydrationPromise.catch(()=>{});
   await editWriteQueue.catch(()=>{});
   const edits=(await allEdits()).filter(e=>changedPathsFast.has(e.path)&&CATALOG.some(x=>x.path===e.path));
   if(!edits.length){toast('Değiştirilmiş texture yok');return}
   const z=new JSZip();const root=z.folder('Mineclonia_Dark_Realism');
   root.file('texture_pack.conf','name = mineclonia_dark_realism\ntitle = Mineclonia Dark Realism\ndescription = Only user-modified Mineclonia textures. Original relative texture paths are preserved.\n');
   let done=0,scaledCount=0,nativeCount=0;
   for(const e of edits){
     const meta=CATALOG.find(x=>x.path===e.path);
     if(!meta)continue;
     const before=await decodeBlobToCanvas(e.blob);
     const outBlob=await prepareImportedTextureBlob(e.blob,meta,TARGET_RESOLUTION);
     const after=await decodeBlobToCanvas(outBlob);
     if(after.width!==before.width||after.height!==before.height)scaledCount++; else nativeCount++;
     root.file(e.path,outBlob,{compression:'STORE'});
     done++;
     if(done===1||done===edits.length||done%25===0){
       const pct=Math.round(done/edits.length*70);
       btn.textContent=`Paketleniyor %${pct}`;
       setSaveState(`Texturepack: ${done}/${edits.length}`,'warn');
       $('stat').textContent=`Export: ${done}/${edits.length} • ${storageLabel()}`;
       await new Promise(requestAnimationFrame);
     }
   }
   const manifest={format:'mineclonia-dark-realism-delta',version:4,createdAt:new Date().toISOString(),count:edits.length,targetResolution:TARGET_RESOLUTION,resolutionModel:'16px-source-density',scaleFactor:TARGET_RESOLUTION/SOURCE_TEXEL_BASE,scaledToTargetCount:scaledCount,nativeOrAlreadyWithinTargetCount:nativeCount,paths:edits.map(e=>e.path)};
   root.file('changed_textures.json',JSON.stringify(manifest,null,2),{compression:'STORE'});
   btn.textContent='ZIP %70';
   setSaveState('ZIP oluşturuluyor…','warn');
   const out=await z.generateAsync({type:'blob',compression:'STORE'},meta=>{
     const pct=70+Math.round((meta.percent||0)*.30);
     btn.textContent=`ZIP %${Math.min(100,pct)}`;
     setSaveState(`ZIP oluşturuluyor • %${Math.min(100,pct)}`,'warn');
   });
   btn.textContent='İndiriliyor…';
   dl(out,'Mineclonia_Dark_Realism_delta.zip');
   setSaveState('Texturepack hazır','ok');
   toast(`${edits.length} texture export edildi${nativeCount?` · ${nativeCount} dosya kayıtlı doğal çözünürlüğünde`:''}`);
   await applyFilter();
 }catch(err){
   console.error('Texturepack export failed',err);
   setSaveState('Texturepack export hatası','bad');
   alert('Texturepack ZIP oluşturulamadı: '+(err?.message||err));
 }finally{
   btn.disabled=false;
   btn.textContent=originalLabel;
 }
}



// --- V5 durable serialized save engine ---
let editWriteQueue = Promise.resolve();
const hotEdits = new Map();
function setSaveState(msg,kind=''){
  const el=$('saveState'); if(!el)return;
  el.textContent=msg;
  el.style.color=kind==='ok'?'#8ee39a':kind==='bad'?'#ff8a8a':kind==='warn'?'#ffd479':'';
}
async function durableDbPut(path,blob,verification='changed'){
  if(storageMode!=='indexeddb'||!dbp) throw new Error('IndexedDB kullanılamıyor');
  await new Promise((res,rej)=>{
    const tx=dbp.transaction(STORE,'readwrite');
    tx.objectStore(STORE).put({path,blob,updatedAt:Date.now(),verification});
    tx.oncomplete=()=>res();
    tx.onabort=()=>rej(tx.error||new Error('Kayıt transaction iptal edildi'));
    tx.onerror=()=>rej(tx.error||new Error('Kayıt transaction hatası'));
  });
}
async function durableDbGet(path){
  if(storageMode!=='indexeddb'||!dbp) return null;
  return await new Promise((res,rej)=>{
    const tx=dbp.transaction(STORE,'readonly');
    const r=tx.objectStore(STORE).get(path);
    r.onsuccess=()=>res(r.result||null);
    r.onerror=()=>rej(r.error||new Error('Kayıt doğrulanamadı'));
  });
}
async function robustPersist(path,blob,verification='changed'){
  hotEdits.set(path,{path,blob,updatedAt:Date.now()});
  revoke(path);
  setSaveState('Kaydediliyor…','warn');
  if(storageMode==='indexeddb'&&dbp){
    await durableDbPut(path,blob,verification);
    const check=await durableDbGet(path);
    if(!check || !check.blob || check.blob.size!==blob.size) throw new Error('Kayıt geri okuma doğrulaması başarısız');
    hotEdits.set(path,check);
    setSaveState('Kaydedildi • kalıcı','ok');
    return;
  }
  // localStorage is unsafe for large PNGs. Use it only when it actually succeeds.
  if(storageMode==='local'){
    try{
      const data=await blobToDataURL(blob);
      localStorage.setItem('mts:'+path,JSON.stringify({data,updatedAt:Date.now(),verification}));
      const raw=localStorage.getItem('mts:'+path);
      if(!raw) throw new Error('localStorage geri okuma başarısız');
      setSaveState('Kaydedildi • yerel fallback','warn');
      return;
    }catch(e){
      console.warn('local fallback failed',e);
      storageMode='memory';
    }
  }
  memoryEdits.set(path,{path,blob,updatedAt:Date.now(),verification});
  setSaveState('Sadece oturumda • yedek al','bad');
}
async function putEdit(path,blob){
  editWriteQueue=editWriteQueue.then(()=>robustPersist(path,blob));
  return await editWriteQueue;
}
async function getEdit(path){
  if(hotEdits.has(path)) return hotEdits.get(path);
  if(storageMode==='indexeddb'&&dbp){
    try{const v=await durableDbGet(path); if(v){hotEdits.set(path,v); return v}}catch(e){console.warn(e)}
  }
  if(storageMode==='local'){
    try{const s=localStorage.getItem('mts:'+path); if(s){const o=JSON.parse(s);const v={path,blob:dataURLToBlob(o.data),updatedAt:o.updatedAt,verification:o.verification||'unknown'};hotEdits.set(path,v);return v}}catch(e){console.warn(e)}
  }
  return memoryEdits.get(path)||null;
}
async function delEdit(path){
  editWriteQueue=editWriteQueue.then(async()=>{
    setSaveState('Siliniyor…','warn');
    hotEdits.delete(path); memoryEdits.delete(path);
    if(storageMode==='indexeddb'&&dbp){
      await new Promise((res,rej)=>{const tx=dbp.transaction(STORE,'readwrite');tx.objectStore(STORE).delete(path);tx.oncomplete=res;tx.onabort=()=>rej(tx.error);tx.onerror=()=>rej(tx.error)});
    }
    try{localStorage.removeItem('mts:'+path)}catch(_){}
    await delScaledPath(path); revoke(path);
    setSaveState(storageMode==='indexeddb'?'Kaydedildi • kalıcı':storageMode==='local'?'Kaydedildi • yerel fallback':'Sadece oturumda • yedek al',storageMode==='indexeddb'?'ok':storageMode==='local'?'warn':'bad');
  });
  return await editWriteQueue;
}
async function allEdits(){
  const outByPath=new Map();
  if(storageMode==='indexeddb'&&dbp){
    try{
      const arr=await new Promise((res,rej)=>{const r=dbp.transaction(STORE).objectStore(STORE).getAll();r.onsuccess=()=>res(r.result||[]);r.onerror=()=>rej(r.error)});
      for(const v of arr) outByPath.set(v.path,v);
    }catch(e){console.warn('allEdits db',e)}
  } else if(storageMode==='local'){
    try{for(let i=0;i<localStorage.length;i++){const k=localStorage.key(i);if(k&&k.startsWith('mts:')){const o=JSON.parse(localStorage.getItem(k));outByPath.set(k.slice(4),{path:k.slice(4),blob:dataURLToBlob(o.data),updatedAt:o.updatedAt,verification:o.verification||'unknown'})}}}catch(e){console.warn(e)}
  }
  for(const [k,v] of memoryEdits) if(!outByPath.has(k)) outByPath.set(k,v);
  for(const [k,v] of hotEdits) outByPath.set(k,v);
  return [...outByPath.values()];
}
async function importPng(file,seam=false){
  if(!active||!file)return;
  const target={...active}; // lock destination before any await
  setSaveState('Dosya hazırlanıyor…','warn');
  let b=file;
  if(seam)b=await imageBlobTransform(b,true);
  await putEdit(target.path,b);
  queueScaled(target.path,b,target,BACKGROUND_RESOLUTION);
  if(TARGET_RESOLUTION!==BACKGROUND_RESOLUTION) queueScaled(target.path,b,target,TARGET_RESOLUTION);
  toast((seam?'Seam dönüşü':'Yeni texture')+' kaydedildi');
  if(active&&active.path===target.path) await openDetail(target);
  await applyFilter();
}
window.addEventListener('pagehide',()=>{
  if(scaleQueue.length||scaleRunning) console.warn('Arka plan ölçek kuyruğu kapanırken tamamlanmamış olabilir');
});



// --- V5.1 instant thumbnail + reliable background persistence ---
const changedPathsFast = new Set();
const pendingChangedPaths = new Set();
const cardRefsFast = new Map();
function revoke(path){
  for(const [key,u] of [...urlCache.entries()]){
    if(key==='e:'+path||key.endsWith(':e:'+path)){
      try{URL.revokeObjectURL(u)}catch(_){}
      urlCache.delete(key);
    }
  }
}
function setFastEditUrl(path,blob){
  revoke(path);
  const u=URL.createObjectURL(blob);
  urlCache.set('e:'+path,u);
  return u;
}
function updateCardFast(path,url){
  const ref=cardRefsFast.get(path);
  if(ref){
    previewUrl(path,true,THUMB_MAX_EDGE).then(u=>{if(cardRefsFast.get(path)===ref)ref.img.src=u}).catch(()=>{ref.img.src=url});
    if(!ref.card.querySelector('.changed')){
      const d=document.createElement('span'); d.className='changed'; ref.card.appendChild(d);
    }
  }
}
function installPersistedEditFast(edit,{markChanged=false}={}){
  if(!edit?.path||!edit.blob)return;
  const rec={path:edit.path,blob:edit.blob,updatedAt:edit.updatedAt||Date.now(),verification:edit.verification||'unknown'};
  hotEdits.set(edit.path,rec);
  if(markChanged){changedPathsFast.add(edit.path);pendingChangedPaths.delete(edit.path)}
  else if(!changedPathsFast.has(edit.path))pendingChangedPaths.add(edit.path);
  const url=setFastEditUrl(edit.path,edit.blob);
  const ref=cardRefsFast.get(edit.path);
  if(ref)previewUrl(edit.path,true,THUMB_MAX_EDGE).then(u=>{if(cardRefsFast.get(edit.path)===ref)ref.img.src=u}).catch(()=>{ref.img.src=url});
  if(markChanged)updateCardFast(edit.path,url);
}
function updateStatFast(){
  if(!$('stat'))return;
  const pending=pendingChangedPaths.size;
  $('stat').textContent=`${filtered.length}/${CATALOG.length} • ${changedPathsFast.size} değişti${pending?` • ${pending} doğrulanıyor`:''} • ${storageLabel()}`;
}
async function persistBlobOnly(path,blob,verification='changed'){
  setSaveState('Kaydediliyor…','warn');
  if(storageMode==='indexeddb'&&dbp){
    try{
      await durableDbPut(path,blob,verification);
      const check=await durableDbGet(path);
      if(!check||!check.blob||check.blob.size!==blob.size) throw new Error('Kayıt doğrulaması başarısız');
      hotEdits.set(path,check);
      setSaveState('Kaydedildi • kalıcı','ok');
      return;
    }catch(e){ console.warn('IndexedDB save failed',e); storageMode='local'; }
  }
  if(storageMode==='local'){
    try{
      const data=await blobToDataURL(blob);
      localStorage.setItem('mts:'+path,JSON.stringify({data,updatedAt:Date.now(),verification}));
      if(!localStorage.getItem('mts:'+path)) throw new Error('localStorage doğrulama başarısız');
      setSaveState('Kaydedildi • yerel fallback','warn');
      return;
    }catch(e){ console.warn('local save failed',e); storageMode='memory'; }
  }
  memoryEdits.set(path,{path,blob,updatedAt:Date.now(),verification});
  setSaveState('Sadece oturumda • yedek al','bad');
}
function queuePersistFast(path,blob,verification='changed'){
  editWriteQueue=editWriteQueue.catch(()=>{}).then(()=>persistBlobOnly(path,blob,verification)).catch(e=>{
    console.error('save queue',e); setSaveState('Kayıt hatası • yedek al','bad');
  });
  return editWriteQueue;
}
async function putEdit(path,blob){
  const rec={path,blob,updatedAt:Date.now()};
  await invalidateDerivedCaches(path);
  hotEdits.set(path,rec); changedPathsFast.add(path); pendingChangedPaths.delete(path);
  const u=setFastEditUrl(path,blob); updateCardFast(path,u); updateStatFast();
  queuePersistFast(path,blob,'changed');
  rebuildEditThumbnail(path,blob);
  return rec;
}
async function applyFilter(){
  const q=$('search').value.trim().toLowerCase(),cat=$('category').value,p=activePriority();
  filtered=CATALOG.filter(x=>(p==='ALL'||x.priority===p)&&categoryMatches(x,cat)&&(!q||x.path.toLowerCase().includes(q))&&(!changedOnly||changedPathsFast.has(x.path)));
  page=0; render();
}
async function render(){
 const token=++renderToken,start=page*PAGE_SIZE,arr=filtered.slice(start,start+PAGE_SIZE);
 $('grid').innerHTML=''; cardRefsFast.clear(); updateStatFast();
 $('pageInfo').textContent=`${Math.min(page+1,Math.max(1,Math.ceil(filtered.length/PAGE_SIZE)))} / ${Math.max(1,Math.ceil(filtered.length/PAGE_SIZE))}`;
 if(!arr.length){$('grid').innerHTML='<div class="empty" style="grid-column:1/-1">Bu filtrede texture yok.</div>';return}
 const cards=[];
 for(const x of arr){
   const b=document.createElement('button'); b.className='card';
   b.innerHTML=`<img loading="lazy" decoding="async"><span class="badge" style="color:${priorityColor(x.priority)}">${x.priority}</span>${changedPathsFast.has(x.path)?'<span class="changed"></span>':''}`;
   b.title=x.path; b.onclick=()=>openDetail(x); $('grid').appendChild(b);
   const img=b.querySelector('img'); cardRefsFast.set(x.path,{card:b,img}); cards.push([x,img]);
 }
 const loadOne=async([x,img])=>{if(token!==renderToken)return;try{
   if(hotEdits.has(x.path))img.src=await previewUrl(x.path,true,THUMB_MAX_EDGE);
   else{img.src=upstreamTextureUrl(x);img.decoding='async';}
 }catch(e){console.warn(x.path,e)}};
 // Above-the-fold cards start together instead of waiting for six-item batches.
 await Promise.all(cards.slice(0,Math.min(12,cards.length)).map(loadOne));
 if(token!==renderToken)return;
 let cursor=12;const workers=Array.from({length:Math.min(12,Math.max(0,cards.length-cursor))},async()=>{while(token===renderToken){const i=cursor++;if(i>=cards.length)return;await loadOne(cards[i])}});
 Promise.allSettled(workers);
}
async function importPng(file,seam=false){
  if(!active||!file)return;
  const target={...active};
  setSaveState(`Dosya hazırlanıyor • 16px→${TARGET_RESOLUTION}px ölçek…`,'warn');
  let b=await prepareStoredEditBlob(file,target);
  if(seam)b=await imageBlobTransform(b,true);
  if(await textureMatchesOriginal(b,target)){
    await delEdit(target.path);
    toast('Dosya orijinalle birebir aynı • değişiklik sayılmadı');
    return;
  }
  const rec={path:target.path,blob:b,updatedAt:Date.now()};
  hotEdits.set(target.path,rec); changedPathsFast.add(target.path); pendingChangedPaths.delete(target.path);
  const u=setFastEditUrl(target.path,b);
  updateCardFast(target.path,u); updateStatFast();
  if(active&&active.path===target.path){
    $('editImg').src=u; $('editImg').style.opacity=1; $('compare').value=50; updateCompare(); tileEdited=true; $('tileSource').textContent='Yeni';
  }
  toast((seam?'Seam dönüşü':'Yeni texture')+` • 16px→${TARGET_RESOLUTION}px ölçek`+(assetTypeOf(target)==='Entity'?' • kaynak alpha kilitli':''));
  queuePersistFast(target.path,b,'changed');
  queueScaled(target.path,b,target,BACKGROUND_RESOLUTION);
  if(TARGET_RESOLUTION!==BACKGROUND_RESOLUTION) queueScaled(target.path,b,target,TARGET_RESOLUTION);
}
async function delEdit(path){
  hotEdits.delete(path); memoryEdits.delete(path); changedPathsFast.delete(path); pendingChangedPaths.delete(path); revoke(path);
  editWriteQueue=editWriteQueue.catch(()=>{}).then(async()=>{
    setSaveState('Siliniyor…','warn');
    if(storageMode==='indexeddb'&&dbp){await new Promise((res,rej)=>{const tx=dbp.transaction(STORE,'readwrite');tx.objectStore(STORE).delete(path);tx.oncomplete=res;tx.onabort=()=>rej(tx.error);tx.onerror=()=>rej(tx.error)})}
    try{localStorage.removeItem('mts:'+path)}catch(_){}
    await delScaledPath(path);
    setSaveState(storageMode==='indexeddb'?'Kaydedildi • kalıcı':storageMode==='local'?'Kaydedildi • yerel fallback':'Sadece oturumda • yedek al',storageMode==='indexeddb'?'ok':storageMode==='local'?'warn':'bad');
  });
  await editWriteQueue; await applyFilter();
}
let changedHydrationPromise=Promise.resolve({complete:true,total:0,same:0});

async function markPersistedVerification(path,verification){
  const current=hotEdits.get(path)||await getEdit(path);
  if(!current?.blob)return;
  const rec={...current,verification,updatedAt:current.updatedAt||Date.now()};
  hotEdits.set(path,rec);
  if(storageMode==='indexeddb'&&dbp){
    try{await durableDbPut(path,rec.blob,verification)}catch(err){console.warn('Doğrulama durumu kaydedilemedi',path,err)}
  }else if(storageMode==='local'){
    try{
      const key='mts:'+path,raw=localStorage.getItem(key);
      if(raw){const o=JSON.parse(raw);o.verification=verification;localStorage.setItem(key,JSON.stringify(o))}
    }catch(err){console.warn('Yerel doğrulama durumu kaydedilemedi',path,err)}
  }else{memoryEdits.set(path,rec)}
}

async function deletePersistedEditQuiet(path){
  hotEdits.delete(path);memoryEdits.delete(path);changedPathsFast.delete(path);pendingChangedPaths.delete(path);revoke(path);
  if(storageMode==='indexeddb'&&dbp){
    try{await new Promise((res,rej)=>{const tx=dbp.transaction(STORE,'readwrite');tx.objectStore(STORE).delete(path);tx.oncomplete=res;tx.onabort=()=>rej(tx.error);tx.onerror=()=>rej(tx.error)})}catch(err){console.warn('Eski edit kaydı silinemedi',path,err)}
  }
  try{localStorage.removeItem('mts:'+path)}catch(_){}
  await delScaledPath(path);
}

const VERIFY_CONCURRENCY=8;
async function hydrateChangedPathsFast(seedEdits=null){
  const edits=(seedEdits||await allEdits()).filter(e=>CATALOG.some(x=>x.path===e.path));
  const unknown=edits.filter(e=>(e.verification||'unknown')!=='changed');
  for(const e of edits){
    if((e.verification||'unknown')==='changed'){changedPathsFast.add(e.path);pendingChangedPaths.delete(e.path)}
    else if(!changedPathsFast.has(e.path))pendingChangedPaths.add(e.path);
  }
  updateStatFast();
  let cursor=0,processed=0,same=0,changed=0,failed=0;
  async function worker(){
    while(true){
      const index=cursor++;if(index>=unknown.length)return;
      const e=unknown[index],meta=CATALOG.find(x=>x.path===e.path);if(!meta)continue;
      try{
        if(await textureMatchesOriginal(e.blob,meta,{throwOnError:true})){
          same++;await deletePersistedEditQuiet(e.path);
          const ref=cardRefsFast.get(e.path);
          if(ref){ref.card.querySelector('.changed')?.remove();try{ref.img.src=await blobUrl(e.path,false)}catch(loadErr){console.warn('Orijinal thumbnail yenilenemedi',e.path,loadErr)}}
        }else{
          changed++;pendingChangedPaths.delete(e.path);changedPathsFast.add(e.path);
          await markPersistedVerification(e.path,'changed');
          const ref=cardRefsFast.get(e.path);
          if(ref&&!ref.card.querySelector('.changed')){const d=document.createElement('span');d.className='changed';ref.card.appendChild(d)}
        }
      }catch(err){
        failed++;pendingChangedPaths.add(e.path);changedPathsFast.delete(e.path);
        console.warn('Değişiklik doğrulanamadı',e.path,err);
      }
      processed++;
      if(processed===1||processed===unknown.length||processed%20===0){updateStatFast();await new Promise(requestAnimationFrame)}
    }
  }
  await Promise.all(Array.from({length:Math.min(VERIFY_CONCURRENCY,Math.max(1,unknown.length))},()=>worker()));
  updateStatFast();
  if(same)console.info(`${same} sahte/eski edit kaydı temizlendi`);
  return {complete:failed===0,total:unknown.length,same,changed,failed,skippedKnown:edits.length-unknown.length};
}
let storageBootPromise=null;
async function bootstrapStorageInBackground(){
  try{
    if(!storageBootPromise)storageBootPromise=initStorage();
    await storageBootPromise;
    setSaveState(storageMode==='indexeddb'?'Hazır • kalıcı kayıt':storageMode==='local'?'Hazır • yerel fallback':'Hazır • sadece oturum',storageMode==='indexeddb'?'ok':storageMode==='local'?'warn':'bad');
    initScaledStorage().catch(err=>console.warn('scaled storage init',err));
    const edits=await allEdits();
    for(const e of edits){
      if(!CATALOG.some(x=>x.path===e.path))continue;
      installPersistedEditFast(e,{markChanged:(e.verification||'unknown')==='changed'});
    }
    updateStatFast();
    await applyFilter();
    changedHydrationPromise=hydrateChangedPathsFast(edits)
      .then(async result=>{await applyFilter();return result})
      .catch(err=>{console.warn('background changed-state hydration',err);return {complete:false,total:edits.length,same:0,failed:edits.length}});
  }catch(e){
    console.warn('storage bootstrap',e);
    storageMode='memory';
    setSaveState('Hazır • sadece oturum','bad');
  }
}

let preview3dLoadPromise=null;
function open3dPreviewLazy(){
 if(!active)return;
 if(window.MTSPreview3D)return window.MTSPreview3D.open(active);
 if(!preview3dLoadPromise)preview3dLoadPromise=new Promise((resolve,reject)=>{
  const s=document.createElement('script');s.src='js/preview3d.js?v=20261006-variant3d1';s.async=true;
  s.onload=resolve;s.onerror=()=>reject(Error('3D önizleme modülü yüklenemedi'));document.body.appendChild(s)
 });
 toast('3D önizleme hazırlanıyor…');
 return preview3dLoadPromise.then(()=>window.MTSPreview3D?.open(active)).catch(err=>{console.error(err);toast(err.message)})
}

async function init(){
  loadPromptOverrides();
  $('stat').textContent='Arayüz hazır';
  setSaveState('Kayıt açılıyor…','warn');
  storageBootPromise=initStorage();
  await buildFilters();
  await Promise.race([storageBootPromise,new Promise(r=>setTimeout(r,900))]);
  if(storageMode==='indexeddb')setSaveState('Hazır • kalıcı kayıt','ok');
  else if(storageMode==='local')setSaveState('Hazır • yerel fallback','warn');
  else setSaveState('Kayıt hazırlanıyor…','warn');
  await new Promise(requestAnimationFrame);
  if(navigator.storage?.persist){try{navigator.storage.persist()}catch(e){}}

  $('resolution').value=String(TARGET_RESOLUTION);
  $('resolution').onchange=e=>{TARGET_RESOLUTION=Number(e.target.value)||256;try{localStorage.setItem(RESOLUTION_KEY,String(TARGET_RESOLUTION))}catch(_){}toast('Temel 16px ölçeği → '+TARGET_RESOLUTION+'px')};
  $('search').oninput=()=>applyFilter();$('category').onchange=()=>applyFilter();
  $('changedOnly').onclick=()=>{changedOnly=!changedOnly;$('changedOnly').classList.toggle('primary',changedOnly);applyFilter()};
  $('promptedOnly').onclick=()=>{promptedOnly=!promptedOnly;$('promptedOnly').classList.toggle('primary',promptedOnly);applyFilter()};
  $('prev').onclick=()=>{if(page>0){page--;render()}};$('next').onclick=()=>{if((page+1)*PAGE_SIZE<filtered.length){page++;render()}};
  bindDetailSheetEvents();
  $('open3dPreview').onclick=open3dPreviewLazy;
  $('compare').oninput=updateCompare;
  $('preview').onclick=()=>{const v=Number($('compare').value);$('compare').value=v<50?100:0;updateCompare()};
  $('downloadOriginal').onclick=async()=>dl(await originalBlob(active.path),active.name);
  $('downloadEdited').onclick=async()=>{const e=await getEdit(active.path);if(!e)return toast('Henüz yeni sürüm yok');dl(e.blob,active.name)};
  $('uploadEdited').onclick=()=>$('fileEdited').click();$('fileEdited').onchange=e=>importPng(e.target.files[0],false);
  $('seamExport').onclick=async()=>{const b=await displayBlob(active.path);dl(await imageBlobTransform(b,true),active.name.replace(/\.png$/,'_SEAM_EDIT.png'));toast('Kenarlar merkeze taşındı')};
  $('seamImport').onclick=()=>$('fileSeam').click();$('fileSeam').onchange=e=>importPng(e.target.files[0],true);
  $('animToggle').onclick=()=>{if(!active||!isAnimatedStrip(active))return;animPlaying=!animPlaying;$('animToggle').textContent=animPlaying?'Durdur':'Oynat'};
  $('exportAtlas').onclick=async()=>{if(!active||!isAnimatedStrip(active))return;const blob=await displayBlob(active.path);const atlas=await stripBlobToAtlasBlob(blob,active);dl(atlas,active.name.replace(/\.png$/,'_ATLAS_EDIT.png'));toast('Kare atlas indirildi')};
  $('importAtlas').onclick=()=>{if(active&&isAnimatedStrip(active))$('fileAnimAtlas').click()};
  $('fileAnimAtlas').onchange=async e=>{const f=e.target.files[0];e.target.value='';if(!f||!active||!isAnimatedStrip(active))return;toast('Atlas strip hâline çevriliyor…');const strip=await atlasBlobToStripBlob(f,active);await putEdit(active.path,strip);toast('Atlas geri yüklendi ve strip olarak kaydedildi');await openDetail(active);await applyFilter()};
  $('revert').onclick=async()=>{if(!active)return;await delEdit(active.path);toast('Orijinale dönüldü');await openDetail(active);await applyFilter()};
  $('exportPack').onclick=exportPack;$('importZip').onclick=()=>$('fileZip').click();$('fileZip').onchange=e=>importZip(e.target.files[0]);

  await applyFilter();
  setTimeout(()=>Promise.allSettled([loadBlockReferencePrompts(),AUTHORED_UV_REF_PROMISES.mobs,AUTHORED_UV_REF_PROMISES.armor]).then(()=>{if(active?.priority==='P0')renderActivePrompt()}).catch(console.warn),0);
  bootstrapStorageInBackground();
}
CATALOG_READY.then(()=>init()).catch(e=>{console.error(e);$('stat').textContent='Başlatma sorunu';setSaveState('Arayüz hatası','bad');alert('Başlatma hatası: '+e.message)})


