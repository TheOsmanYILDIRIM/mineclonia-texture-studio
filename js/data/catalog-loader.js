const CATALOG_META={c:["ITEMS","ENTITIES","ENVIRONMENT","PLAYER","HUD","CORE","menu","screenshot.png","MAPGEN","HELP"],m:["mcl_core","mclx_core","mobs_mc","mcl_beds","mcl_chests","mcl_crafting_table","mcl_deepslate","mcl_doors","mcl_farming","mcl_fences","mcl_flowers","mcl_furnaces","mcl_ocean","mcl_panes","mcl_tools","mcl_torches","mcl_wool","mcl_boats","mcl_minecarts","mcl_moon","REDSTONE","mcl_anvils","mcl_armor","mcl_bamboo","mcl_barrels","mcl_blackstone","mcl_blast_furnace","mcl_bows","mcl_brewing","mcl_buckets","mcl_campfires","mcl_cherry_blossom","mcl_copper","mcl_crimson","mcl_dripstone","mcl_enchanting","mcl_end","mcl_fire","mcl_grindstone","mcl_hoppers","mcl_lanterns","mcl_lush_caves","mcl_mangrove","mcl_mobitems","mcl_mobspawners","mcl_mud","mcl_mushrooms","mcl_nether","mcl_pale_oak","mcl_portals","mcl_powder_snow","mcl_raw_ores","mcl_shields","mcl_smoker","mcl_stairs","mcl_stonecutter","mcl_throwing","mcl_tnt","mcl_totems","mcl_tridents","mcl_walls","mclx_fences","mclx_stairs","mcl_player","mcl_charges","mcl_paintings","mcl_lightning","mcl_base_textures","mcl_experience","mcl_hbarmor","mcl_inventory","mcl_offhand","mcl_amethyst","mcl_armor_stand","mcl_banners","mcl_beacons","mcl_beehives","mcl_bells","mcl_bone_meal","mcl_books","mcl_cake","mcl_candles","mcl_cartography_table","mcl_cauldrons","mcl_cocoas","mcl_colorblocks","mcl_composters","mcl_conduits","mcl_dyes","mcl_fireworks","mcl_fishing","mcl_fletching_table","mcl_flowerpots","mcl_heads","mcl_honey","mcl_itemframes","mcl_jukebox","mcl_lectern","mcl_lightning_rods","mcl_loom","mcl_maps","mcl_potions","mcl_pottery_sherds","mcl_sculk","mcl_smithing_table","mcl_sponges","mcl_spyglass","mcl_sus_nodes","mcl_sus_stew","mcl_trial_spawners","mcl_vaults","mcl_hunger","mcl_explosions","mcl_raids","mcl_weather","hudbars","mcl_bossbars","mcl_formspec","mcl_clock","mcl_compass","mcl_criticals","mcl_skins","header.png","icon.png","overlay.1.png","overlay.2.png","overlay.3.png","overlay.4.png","overlay.5.png","overlay.png","","awards","mcl_achievements","mcl_signs","screwdriver","mcl_villages","mcl_mobs","doc","mcl_craftguide","mcl_doc_basics","mcl_credits","mcl_biome_dispatch","mcl_levelgen"],p:["P0","P1","P2","P3","P4","P5","P6"]};
const CATALOG_TECH_FILES=["terrain","stone","wood","ores","plants","crops","liquids","animated","passive","hostile","boss","npc","player","armor","vehicles","items","tools-tech","weapons","food-tech","materials","workstations","containers","doors","redstone-tech","hud","gui","icons","overlays","particles","effects","sky","environment","maps","debug","other"];
let CATALOG=[];
let NODE_TAG_INDEX=new Map();
function staticAssetTags(x){
 const n=String(x.name||'').toLowerCase(),q=(x.category+'/'+x.mod+'/'+x.name).toLowerCase(),t=new Set([
  'priority:'+String(x.priority||'').toLowerCase(),'asset:'+String(x.category||'').toLowerCase(),'mod:'+String(x.mod||'').toLowerCase()
 ]);
 if(x.animated)t.add('animated');
 const faceRules=[['front',/_(?:front_(?:active|on|off)|front_(?:horizontal|vertical)|front)\.png$/],['back',/_(?:back_lit|back)\.png$/],['top',/_top(?:_damaged_\d+)?\.png$/],['bottom',/_bottom\.png$/],['side',/_side\.png$/],['side1',/_side1\.png$/],['side2',/_side2\.png$/],['side3',/_side3\.png$/],['side4',/_side4\.png$/]];
 for(const [role,re] of faceRules)if(re.test(n)){t.add('face');t.add('face:'+role);t.add('family:'+n.replace(re,''));break}
 if(n.includes('overlay'))t.add('overlay');if(n.includes('palette'))t.add('palette');
 if(/(?:grass_block_top|grass_block_side_overlay|papyrus|leaves|redstone.*dust|banner_base|leather_desat|collar)/.test(n))t.add('runtime-tint');
 if(/(?:ore|mineral|diamond|emerald|lapis)/.test(q))t.add('ore');
 for(const tag of NODE_TAG_INDEX.get(n)||[])t.add(tag);
 if(x.w!==x.h)t.add('non-square');if(x.w>16||x.h>16)t.add('atlas-or-hires');
 return [...t].sort();
}
let NODE_TAGS_READY=null;
function loadNodeTagsInBackground(){
 if(NODE_TAGS_READY)return NODE_TAGS_READY;
 NODE_TAGS_READY=fetch('js/data/node-faces.json',{cache:'force-cache'}).then(r=>r.ok?r.json():null).then(j=>{
  NODE_TAG_INDEX=new Map();
  for(const [node,def] of Object.entries(j?.nodes||{})){
   for(const expr of [...(def.textures||[]),...(def.overlays||[])]){
    const composite=String(expr||'').includes('^');
    for(const m of String(expr||'').matchAll(/[A-Za-z0-9_./-]+\.png/g)){
     const key=m[0].toLowerCase(),tags=NODE_TAG_INDEX.get(key)||[];
     tags.push('lua:node','node:'+node);if(composite)tags.push('composite');if((def.overlays||[]).length)tags.push('node-overlay');if(def.palette)tags.push('runtime-tint');
     NODE_TAG_INDEX.set(key,tags);
    }
   }
  }
  for(const x of CATALOG){
   const extra=NODE_TAG_INDEX.get(String(x.name||'').toLowerCase())||[];
   if(extra.length)x.tags=[...new Set([...(x.tags||[]),...extra])].sort();
  }
  return NODE_TAG_INDEX;
 }).catch(()=>{NODE_TAG_INDEX=new Map()});
 return NODE_TAGS_READY;
}
const CATALOG_READY=Promise.all(CATALOG_TECH_FILES.map(async id=>{
 const r=await fetch('js/data/catalog/'+id+'.json',{cache:'force-cache'});
 if(!r.ok)throw new Error('catalog '+id+' '+r.status);
 return await r.json();
})).then(parts=>{
 const rows=parts.flat();rows.sort((a,b)=>a[6]-b[6]);
 CATALOG=rows.map(r=>{const category=CATALOG_META.c[r[0]],mod=CATALOG_META.m[r[1]],priority=CATALOG_META.p[r[2]],name=r[8];return {path:category+'/'+mod+'/'+name,name,category,mod,priority,w:r[3],h:r[4],animated:!!r[5],rank:r[6],id:'tex_'+r[7],tags:staticAssetTags({category,mod,priority,w:r[3],h:r[4],animated:!!r[5],name})}});
 const defer=()=>loadNodeTagsInBackground();
 if(typeof requestIdleCallback==='function')requestIdleCallback(defer,{timeout:2500});else setTimeout(defer,1200);
 return CATALOG;
});
