(()=>{
 const root=document.getElementById('preview3d');
 const stage=document.getElementById('preview3dStage');
 const scene=document.getElementById('preview3dScene');
 if(!root||!stage||!scene)return;

 let mode='object',projection='orthographic',rx=-24,ry=38,zoom=1,pointers=new Map(),lastPinch=0,panX=0,panY=0,previewProfileConfig=null,previewBgUrl=null;
 const S=150;
 const byName=name=>CATALOG.find(x=>String(x.name||'').toLowerCase()===String(name).toLowerCase())||null;
 const canObject=x=>!!x&&['Block','Functional Block'].includes(assetTypeOf(x));
 const entityModelFile=x=>{const m=runtimeRoleInfo?.(x)?.model||'';return (String(m).match(/[A-Za-z0-9_.-]+\.b3d/i)||[])[0]||null};
 const entityPreviewRole=x=>String(runtimeRoleInfo?.(x)?.role||'');
 const canEntity=x=>{if(!x||assetTypeOf(x)!=='Entity'||!entityModelFile(x))return false;const r=entityPreviewRole(x);return /^Entity /.test(r)&&!/(Overlay|Layer|Marking|Equipment|Effect|Particle|Template|Mask)/.test(r)};
 const canWorld=x=>!!x&&assetTypeOf(x)==='Block';
 const canSurface=x=>!!x&&assetTypeOf(x)!=='Entity';
 let entityGL=null,variantSession=null,b3dRuntimePromise=null;
 function loadB3DRuntime(){
  if(window.MTSB3DAnimation&&window.MTSB3DPreviewControls)return Promise.resolve();
  if(!b3dRuntimePromise)b3dRuntimePromise=(async()=>{
   for(const src of ['js/b3d-animation.js?v=20261010-head-scale-guard2','js/b3d-preview-controls.js?v=20261010-lua-clips-final3']){
    if(src.includes('b3d-animation.js')&&window.MTSB3DAnimation)continue;
    if(src.includes('b3d-preview-controls.js')&&window.MTSB3DPreviewControls)continue;
    await new Promise((resolve,reject)=>{const el=document.createElement('script');el.src=src;el.onload=resolve;el.onerror=()=>reject(Error('B3D animasyon modülü yüklenemedi: '+src));document.head.appendChild(el)});
   }
  })().catch(err=>{b3dRuntimePromise=null;throw err});
  return b3dRuntimePromise;
 }

 async function loadPreviewProfiles(){
  if(previewProfileConfig)return previewProfileConfig;
  try{
    const [manualRes,generatedRes]=await Promise.all([
      fetch('js/data/preview3d-profiles.json',{cache:'no-cache'}),
      fetch('js/data/preview3d-profiles.generated.json',{cache:'no-cache'})
    ]);
    const manual=manualRes.ok?await manualRes.json():{defaults:{projection:'orthographic'},profiles:[]};
    const generated=generatedRes.ok?await generatedRes.json():{profiles:[]};
    const manualProfiles=[...(manual.profiles||[])];
    const genericManual=manualProfiles.filter(p=>p?.id==='single_texture_cube'||p?.match?.asset_types);
    const specificManual=manualProfiles.filter(p=>!genericManual.includes(p));
    previewProfileConfig={
      defaults:manual.defaults||{projection:'orthographic'},
      specificManual:specificManual.map(p=>({...p,_source:'manual'})),
      generated:(generated.profiles||[]).map(p=>({...p,_source:'generated'})),
      genericManual:genericManual.map(p=>({...p,_source:'fallback'})),
      profiles:[...specificManual,...(generated.profiles||[]),...genericManual]
    };
  }catch{previewProfileConfig={defaults:{projection:'orthographic'},profiles:[]}}
  return previewProfileConfig;
 }
 function profileMatches(profile,meta){
  const m=profile?.match||{},n=String(meta?.name||'').toLowerCase(),type=assetTypeOf(meta);
  if(Array.isArray(m.names)&&m.names.some(x=>String(x).toLowerCase()===n))return true;
  if(Array.isArray(m.asset_types)&&m.asset_types.includes(type))return true;
  if(Array.isArray(m.suffix_pairs)){
    for(const pair of m.suffix_pairs||[])for(const suffix of pair||[])if(n.endsWith(String(suffix).toLowerCase()))return true;
  }
  return false;
 }
 function findCatalogTexture(name){return CATALOG.find(x=>String(x.name||'').toLowerCase()===String(name||'').toLowerCase())||null}
 function pairedLogFaces(meta,profile){
  const n=String(meta?.name||''),low=n.toLowerCase();
  for(const pair of profile?.match?.suffix_pairs||[]){
    const [sideSuffix,topSuffix]=pair;
    const s=String(sideSuffix||'').toLowerCase(),t=String(topSuffix||'').toLowerCase();
    let stem=null;
    if(low.endsWith(s))stem=n.slice(0,n.length-s.length);
    else if(low.endsWith(t))stem=n.slice(0,n.length-t.length);
    if(stem==null)continue;
    const side=findCatalogTexture(stem+sideSuffix)||meta,top=findCatalogTexture(stem+topSuffix)||meta;
    const layer=x=>[{texture:x?.name||'$self'}];
    return {top:layer(top),bottom:layer(top),north:layer(side),south:layer(side),east:layer(side),west:layer(side)};
  }
  return null;
 }
 function exprLayers(expr){
  return (String(expr||'').match(/[A-Za-z0-9_./-]+\.png/g)||[]).map(texture=>({texture}));
 }
 async function directNodeProfile(meta){
  await loadLuaFaceManifest();
  const name=String(meta?.name||'').toLowerCase(),rows=LUA_FACE_INDEX?.get(name)||[];
  if(!rows.length)return null;
  const rank=([node,def])=>{
    const tail=String(node||'').split(':').pop().replace(/_/g,'');
    const stem=name.replace(/\.png$/,'').replace(/^(?:mcl_|default_)/,'').replace(/_/g,'');
    let s=0;
    if(tail&&stem&&(tail.includes(stem)||stem.includes(tail)))s+=20;
    if((def.textures||[]).some(x=>String(x).toLowerCase()===name))s+=50;
    if((def.overlays||[]).some(x=>String(x).toLowerCase()===name))s+=30;
    return s;
  };
  const [node,def]=[...rows].sort((a,b)=>rank(b)-rank(a))[0];
  const tex=expandLuaFaces(def.textures||[]),ovs=expandLuaFaces(def.overlays||[],{sparse:true});
  if(!tex)return null;
  const logical=['top','bottom','east','west','north','south'],faces={};
  for(let i=0;i<6;i++){
    const layers=[...exprLayers(tex[i]),...exprLayers(ovs?.[i]||'')];
    if(def.palette&&def.color&&layers.length)layers[layers.length-1]={...layers[layers.length-1],tint:def.color};
    faces[logical[i]]=layers.length?layers:[{texture:name}];
  }
  return {id:'node:'+node,node,texture_base:def.texture_base||null,geometry:'cube',projection:'orthographic',faces,_source:'node-faces'};
 }
 async function resolvePreviewProfile(meta){
  const cfg=await loadPreviewProfiles();
  let profile=(cfg.specificManual||[]).find(p=>profileMatches(p,meta))||null;
  if(!profile)profile=await directNodeProfile(meta);
  if(!profile)profile=(cfg.generated||[]).find(p=>profileMatches(p,meta))||null;
  if(!profile)profile=(cfg.genericManual||[]).find(p=>profileMatches(p,meta))||null;
  if(!profile)return {id:'fallback',projection:cfg.defaults?.projection||'orthographic',faces:null,background:cfg.defaults?.background||'checker-dark'};
  const out={...cfg.defaults,...profile};
  if(profile.resolver==='paired_log')out.faces=pairedLogFaces(meta,profile);
  projection=out.projection||'orthographic';
  return out;
 }
 async function layerCanvas(layer,meta,overrideBlob,size,profile){
  const texture=layer?.texture||'$self';
  let blob=null;
  if(texture==='$self'||String(texture).toLowerCase()===String(meta?.name||'').toLowerCase())blob=overrideBlob||await displayBlob(meta.path);
  else{
    const ref=findCatalogTexture(texture);
    if(ref)blob=await displayBlob(ref.path);
    else if(profile?.texture_base){
      try{
        const url=`${MINECLONIA_RAW_BASE}/${profile.texture_base}/textures/${encodeURIComponent(texture)}`;
        const res=await fetch(url,{cache:'force-cache'});
        if(res.ok)blob=await res.blob();
      }catch{}
    }
  }
  const cv=document.createElement('canvas');cv.width=cv.height=size;
  if(!blob)return cv;
  const bmp=await createImageBitmap(blob),g=cv.getContext('2d',{willReadFrequently:true});g.imageSmoothingEnabled=false;g.drawImage(bmp,0,0,size,size);bmp.close?.();
  if(layer?.tint){
    const rgb=(String(layer.tint).match(/[0-9a-f]{2}/gi)||['ff','ff','ff']).map(x=>parseInt(x,16));
    const im=g.getImageData(0,0,size,size),d=im.data;
    for(let i=0;i<d.length;i+=4){if(!d[i+3])continue;d[i]=Math.round(d[i]*rgb[0]/255);d[i+1]=Math.round(d[i+1]*rgb[1]/255);d[i+2]=Math.round(d[i+2]/255*rgb[2])}
    g.putImageData(im,0,0);
  }
  return cv;
 }
 async function composeFace(layers,meta,overrideBlob,size=256,profile=null){
  const cv=document.createElement('canvas');cv.width=cv.height=size;const g=cv.getContext('2d');g.imageSmoothingEnabled=false;
  for(const layer of layers||[{texture:'$self'}]){const src=await layerCanvas(layer,meta,overrideBlob,size,profile);g.drawImage(src,0,0)}
  return cv;
 }
 async function buildFaceAtlas(profile,meta,overrideBlob){
  const names=['north','south','east','west','top','bottom'],cell=256,atlas=document.createElement('canvas');atlas.width=cell*3;atlas.height=cell*2;
  const g=atlas.getContext('2d');g.imageSmoothingEnabled=false;
  for(let i=0;i<names.length;i++){
    const face=await composeFace(profile?.faces?.[names[i]]||[{texture:'$self'}],meta,overrideBlob,cell,profile);
    g.drawImage(face,(i%3)*cell,Math.floor(i/3)*cell);
  }
  return atlas;
 }
 async function applyPreviewBackground(profile){
  if(previewBgUrl){try{URL.revokeObjectURL(previewBgUrl)}catch{}previewBgUrl=null}
  stage.style.backgroundImage='';stage.style.backgroundSize='';stage.style.backgroundPosition='';
  if(profile?.background==='dirt'){
    const dirt=findCatalogTexture('default_dirt.png');
    if(dirt){previewBgUrl=URL.createObjectURL(await displayBlob(dirt.path));stage.style.backgroundImage=`linear-gradient(rgba(8,10,12,.38),rgba(8,10,12,.38)),url("${previewBgUrl}")`;stage.style.backgroundSize='auto,96px 96px';stage.style.backgroundPosition='0 0,center';}
  }
 }

 const FACE_SUFFIX_RULES=[
  ['front',/_(?:front_(?:active|on|off)|front_(?:horizontal|vertical)|front)\.png$/],
  ['back',/_(?:back_lit|back)\.png$/],
  ['top',/_top(?:_damaged_\d+)?\.png$/],
  ['bottom',/_bottom\.png$/],
  ['side',/_side\.png$/],
  ['side1',/_side1\.png$/],['side2',/_side2\.png$/],['side3',/_side3\.png$/],['side4',/_side4\.png$/]
 ];
 function faceRole(name){const n=String(name||'').toLowerCase();for(const [role,re] of FACE_SUFFIX_RULES)if(re.test(n))return role;return'plain'}
 function familyKey(name){
  let n=String(name||'').toLowerCase();
  for(const [,re] of FACE_SUFFIX_RULES)if(re.test(n))return n.replace(re,'.png').replace(/\.png$/,'');
  return n.replace(/\.png$/,'');
 }
 function woodFaceIdentity(name){
  const n=String(name||'').toLowerCase().replace(/\.png$/,'');
  let m;
  if((m=n.match(/^default_(acacia|aspen|birch|jungle|jungletree|pine|spruce|dark_oak)?_?tree(_top)?$/))){
   const species=(m[1]||'oak').replace('jungletree','jungle').replace('pine','spruce');
   return {key:'wood:'+species+':natural',role:m[2]?'top':'side'};
  }
  if(n==='default_tree')return {key:'wood:oak:natural',role:'side'};
  if(n==='default_tree_top')return {key:'wood:oak:natural',role:'top'};
  if((m=n.match(/^(?:mcl_)?(?:cherry_blossom_|mangrove_|pale_oak_)?log(?:_(top))?(?:_(stripped))?$/))){
   const species=n.includes('cherry')?'cherry':n.includes('mangrove')?'mangrove':n.includes('pale_oak')?'pale_oak':'oak';
   const stripped=n.includes('stripped')?'stripped':'natural';
   return {key:'wood:'+species+':'+stripped,role:n.includes('_top')?'top':'side'};
  }
  if((m=n.match(/^mcl_stripped_(mangrove|pale_oak)_log_(side|top)$/)))return {key:'wood:'+m[1]+':stripped',role:m[2]};
  if((m=n.match(/^mcl_cherry_blossom_log_(top_)?stripped$/)))return {key:'wood:cherry:stripped',role:m[1]?'top':'side'};
  return null;
 }
 const FACE_FAMILY_INDEX=new Map();
 function buildFaceFamilyIndex(){
  FACE_FAMILY_INDEX.clear();
  for(const x of CATALOG){
   if(!canObject(x))continue;
   const wood=woodFaceIdentity(x.name),key=wood?wood.key:(x.mod+'|'+familyKey(x.name)),role=wood?wood.role:faceRole(x.name);
   let f=FACE_FAMILY_INDEX.get(key);if(!f){f={plain:[],front:[],back:[],top:[],bottom:[],side:[],side1:[],side2:[],side3:[],side4:[]};FACE_FAMILY_INDEX.set(key,f)}
   f[role].push(x);
  }
 }
 function best(list,meta){
  if(!list?.length)return null;
  const n=String(meta?.name||'').toLowerCase();
  const state=n.match(/_(active|on|off|lit)\.png$/)?.[1];
  if(state){const same=list.find(x=>String(x.name||'').toLowerCase().includes('_'+state+'.png'));if(same)return same}
  return list[0];
 }
 let LUA_FACE_MANIFEST=null,LUA_FACE_INDEX=null;
 async function loadLuaFaceManifest(){
  if(LUA_FACE_MANIFEST)return LUA_FACE_MANIFEST;
  try{const r=await fetch('js/data/node-faces.json',{cache:'force-cache'});LUA_FACE_MANIFEST=r.ok?await r.json():{nodes:{}}}catch{LUA_FACE_MANIFEST={nodes:{}}}
  LUA_FACE_INDEX=new Map();
  for(const [node,def] of Object.entries(LUA_FACE_MANIFEST.nodes||{})){
   const refs=[...(def.textures||[]),...(def.overlays||[])].flatMap(v=>String(v||'').match(/[A-Za-z0-9_./-]+\.png/g)||[]);
   for(const name of refs){const key=name.toLowerCase();if(!LUA_FACE_INDEX.has(key))LUA_FACE_INDEX.set(key,[]);LUA_FACE_INDEX.get(key).push([node,def])}
  }
  return LUA_FACE_MANIFEST;
 }
 function expandLuaFaces(list,{sparse=false}={}){
  const a=Array.isArray(list)?list:[];
  if(!a.length)return null;
  if(sparse){
   if(a.length===1)return [a[0],'','','','',''];
   if(a.length===2)return [a[0],a[1],'','','',''];
   if(a.length===3)return [a[0],a[1],a[2],a[2],a[2],a[2]];
   return [a[0]||'',a[1]||'',a[2]||'',a[3]||'',a[4]||'',a[5]||''];
  }
  if(a.length===1)return [a[0],a[0],a[0],a[0],a[0],a[0]];
  if(a.length===2)return [a[0],a[1],a[1],a[1],a[1],a[1]];
  if(a.length===3)return [a[0],a[1],a[2],a[2],a[2],a[2]];
  return [a[0],a[1],a[2]||a[0],a[3]||a[2]||a[0],a[4]||a[2]||a[0],a[5]||a[2]||a[0]];
 }
 function luaFaceDef(meta){
  if(!LUA_FACE_INDEX)return null;
  const name=String(meta?.name||'').toLowerCase(),rows=LUA_FACE_INDEX.get(name);if(!rows?.length)return null;
  const score=([node,def])=>{
   const tex=def.textures||[],first=String(tex[0]||'').toLowerCase(),all=tex.join(' ').toLowerCase();
   let n=0;if(first===name)n+=100;if(first.includes(name))n+=60;
   const nodeTail=String(node||'').split(':').pop().replace(/_/g,'');
   const fileStem=name.replace(/\.png$/,'').replace(/^(?:mcl_|default_)/,'').replace(/_/g,'');
   if(nodeTail&&fileStem&&(nodeTail.includes(fileStem)||fileStem.includes(nodeTail)))n+=25;
   if(all===name)n+=15;if((def.overlays||[]).some(Boolean))n-=5;
   return n;
  };
  const ranked=[...rows].sort((a,b)=>score(b)-score(a)),best=ranked[0];
  if(score(best)<60)return null;
  const [node,def]=best,faces=expandLuaFaces(def.textures);if(!faces)return null;
  return {node,def,faces};
 }
 function catalogTextureFromExpr(expr){
  const names=String(expr||'').match(/[A-Za-z0-9_./-]+\.png/g)||[];
  return names.map(name=>byName(name)).filter(Boolean);
 }
 function faceFamily(meta){
  const name=String(meta?.name||'').toLowerCase();
  if(['mcl_core_grass_block_top.png','mcl_core_grass_block_side_overlay.png','default_dirt.png'].includes(name)){
   const top=byName('mcl_core_grass_block_top.png'),dirt=byName('default_dirt.png'),overlay=byName('mcl_core_grass_block_side_overlay.png');
   return {special:'grass',top,bottom:dirt,side:dirt,front:dirt,back:dirt,left:dirt,right:dirt,overlay};
  }
  if(!FACE_FAMILY_INDEX.size)buildFaceFamilyIndex();
  const wood=woodFaceIdentity(meta.name),f=FACE_FAMILY_INDEX.get(wood?wood.key:(meta.mod+'|'+familyKey(meta.name)));
  if(!f)return {top:meta,bottom:meta,side:meta,front:meta,back:meta,left:meta,right:meta,overlay:null};
  const plain=best(f.plain,meta),side=best(f.side,meta)||best(f.side1,meta)||plain||meta;
  const top=best(f.top,meta)||plain||meta,bottom=best(f.bottom,meta)||plain||top;
  const front=faceRole(meta.name)==='front'?meta:(best(f.front,meta)||side);
  const back=best(f.back,meta)||best(f.side3,meta)||side;
  const left=best(f.side4,meta)||side,right=best(f.side2,meta)||side;
  return {top,bottom,side,front,back,left,right,overlay:null};
 }
 async function texUrl(meta){return meta?await blobUrl(meta.path,true):''}
 async function tintedTextureUrl(meta,color='#8EB971'){
  if(!meta)return '';
  const src=await decodeBlobToCanvas(await displayBlob(meta.path)),g=src.getContext('2d',{willReadFrequently:true});
  const im=g.getImageData(0,0,src.width,src.height),d=im.data;
  const rgb=(String(color).match(/[0-9a-f]{2}/gi)||['8e','b9','71']).map(x=>parseInt(x,16));
  for(let i=0;i<d.length;i+=4){if(!d[i+3])continue;d[i]=Math.round(d[i]*rgb[0]/255);d[i+1]=Math.round(d[i+1]*rgb[1]/255);d[i+2]=Math.round(d[i+2]*rgb[2]/255)}
  g.putImageData(im,0,0);const b=await canvasPngBlob(src);return URL.createObjectURL(b);
 }
 async function faceStyle(meta,{overlay=null,tint=false}={}){
  const base=tint?await tintedTextureUrl(meta):await texUrl(meta);
  const ov=overlay?await texUrl(overlay):'';
  if(ov){
   return {backgroundImage:base?`url("${base}")`:'none',backgroundSize:'100% 100%',overlayTint:true,overlayUrl:ov};
  }
  return {backgroundImage:base?`url("${base}")`:'none',backgroundSize:'100% 100%',overlayTint:false,tint};
 }
 function addFace(cube,cls,transform,style,shade=.08){
  const f=document.createElement('div');f.className='preview3dFace '+cls;f.style.transform=transform;
  f.style.backgroundImage=style.backgroundImage;f.style.backgroundSize=style.backgroundSize||'100% 100%';
  if(shade>0)f.style.filter=`brightness(${Math.max(.55,1-shade)})`;

  if(style.overlayTint&&style.overlayUrl){
   const ov=document.createElement('div');ov.style.cssText='position:absolute;inset:0;background-size:100% 100%;background-repeat:no-repeat;pointer-events:none';
   ov.style.backgroundImage=`url("${style.overlayUrl}")`;
   ov.style.filter='sepia(1) saturate(1.35) hue-rotate(42deg) brightness(.88)';
   f.appendChild(ov);
  }
  cube.appendChild(f);
 }
 function isGrassPreviewAsset(meta){
  const n=String(meta?.name||'').toLowerCase();
  return n==='mcl_core_grass_block_top.png'||n==='mcl_core_grass_block_side_overlay.png';
 }
 async function makeGrassCube(size=S){
  const top=byName('mcl_core_grass_block_top.png'),dirt=byName('default_dirt.png'),overlay=byName('mcl_core_grass_block_side_overlay.png');
  if(!top||!dirt||!overlay)return null;
  const topStyle=await faceStyle(top,{tint:true}),bottomStyle=await faceStyle(dirt);
  const sideStyle=await faceStyle(dirt,{overlay});
  const c=document.createElement('div');c.className='preview3dCube';c.style.setProperty('--s',size+'px');const z=size/2;
  addFace(c,'front',`translateZ(${z}px)`,sideStyle,.08);
  addFace(c,'back',`rotateY(180deg) translateZ(${z}px)`,sideStyle,.22);
  addFace(c,'right',`rotateY(90deg) translateZ(${z}px)`,sideStyle,.16);
  addFace(c,'left',`rotateY(-90deg) translateZ(${z}px)`,sideStyle,.12);
  addFace(c,'top',`rotateX(90deg) translateZ(${z}px)`,topStyle,0);
  addFace(c,'bottom',`rotateX(-90deg) translateZ(${z}px)`,bottomStyle,.30);
  return c;
 }
 async function makeLuaCube(meta,size=S){
  const hit=luaFaceDef(meta);if(!hit)return null;
  const {def,faces}=hit,overlays=expandLuaFaces(def.overlays||[],{sparse:true});
  const styles=[];
  for(let i=0;i<6;i++){
   const parts=catalogTextureFromExpr(faces[i]),base=parts[0]||meta,extra=parts[1]||null;
   const overlay=overlays?catalogTextureFromExpr(overlays[i])[0]:null;
   const baseTint=!!def.palette&&i===0;
   const overlayTint=!!def.palette&&!!overlay;
   let st=await faceStyle(base,{overlay:overlay||extra,tint:baseTint});
   if(baseTint)st.tint=true;
   if((overlay||extra)&&!overlayTint&&extra)st.overlayTint=false;
   styles.push(st);
  }
  const c=document.createElement('div');c.className='preview3dCube';c.style.setProperty('--s',size+'px');const z=size/2;
  addFace(c,'top',`rotateX(90deg) translateZ(${z}px)`,styles[0],0);
  addFace(c,'bottom',`rotateX(-90deg) translateZ(${z}px)`,styles[1],.30);
  addFace(c,'right',`rotateY(90deg) translateZ(${z}px)`,styles[2],.16);
  addFace(c,'left',`rotateY(-90deg) translateZ(${z}px)`,styles[3],.12);
  addFace(c,'back',`rotateY(180deg) translateZ(${z}px)`,styles[4],.22);
  addFace(c,'front',`translateZ(${z}px)`,styles[5],.08);
  return c;
 }
 function doorFamily(meta){
  const n=String(meta?.name||'').toLowerCase().replace(/\.png$/,'');
  let m=n.match(/^mcl_doors_door_(acacia|birch|dark_oak|jungle|spruce|crimson|warped)(?:_(lower|upper|side_lower|side_upper))?$/);
  if(m)return {key:m[1],scheme:'classic'};
  m=n.match(/^mcl_(cherry_blossom|mangrove|pale_oak|bamboo)_door_(bottom|top|bottom_side|top_side|bottom_bottompart|top_toppart|bottom_alt|top_alt)$/);
  if(m)return {key:m[1],scheme:'modern'};
  m=n.match(/^mcl_crimson_(crimson|warped)_door_(bottom|top)$/);
  if(m)return {key:m[1],scheme:'nether'};
  return null;
 }
 function doorPart(f,role){
  const names=f.scheme==='classic'?{
   lower:`mcl_doors_door_${f.key}_lower.png`,upper:`mcl_doors_door_${f.key}_upper.png`,
   sideLower:`mcl_doors_door_${f.key}_side_lower.png`,sideUpper:`mcl_doors_door_${f.key}_side_upper.png`
  }:f.scheme==='modern'?{
   lower:`mcl_${f.key}_door_bottom.png`,upper:`mcl_${f.key}_door_top.png`,
   sideLower:`mcl_${f.key}_door_bottom_side.png`,sideUpper:`mcl_${f.key}_door_top_side.png`
  }:{
   lower:`mcl_crimson_${f.key}_door_bottom.png`,upper:`mcl_crimson_${f.key}_door_top.png`,
   sideLower:`mcl_doors_door_${f.key}_side_lower.png`,sideUpper:`mcl_doors_door_${f.key}_side_upper.png`
  };
  return byName(names[role])||null;
 }
 async function makeDoorHalf(front,side,size,thickness){
  const c=document.createElement('div');c.className='preview3dCube preview3dDoorHalf';
  c.style.setProperty('--s',size+'px');c.style.width=size+'px';c.style.height=size+'px';
  const z=thickness/2,frontStyle=await faceStyle(front),sideStyle=await faceStyle(side||front);
  const topStyle=sideStyle;
  addFace(c,'front',`translateZ(${z}px)`,frontStyle,.04);
  addFace(c,'back',`rotateY(180deg) translateZ(${z}px)`,frontStyle,.16);
  const lr=`width:${thickness}px;left:${(size-thickness)/2}px;`;
  const left=document.createElement('div');left.className='preview3dFace left';left.style.cssText+=lr;left.style.transform=`translateX(${-size/2}px) rotateY(-90deg)`;left.style.backgroundImage=sideStyle.backgroundImage;left.style.backgroundSize='100% 100%';c.appendChild(left);
  const right=left.cloneNode(true);right.className='preview3dFace right';right.style.transform=`translateX(${size/2}px) rotateY(90deg)`;c.appendChild(right);
  const tb=`height:${thickness}px;top:${(size-thickness)/2}px;`;
  const top=document.createElement('div');top.className='preview3dFace top';top.style.cssText+=tb;top.style.transform=`translateY(${-size/2}px) rotateX(90deg)`;top.style.backgroundImage=topStyle.backgroundImage;top.style.backgroundSize='100% 100%';c.appendChild(top);
  const bottom=top.cloneNode(true);bottom.className='preview3dFace bottom';bottom.style.transform=`translateY(${size/2}px) rotateX(-90deg)`;c.appendChild(bottom);
  return c;
 }
 function tallPlantFamily(meta){
  const n=String(meta?.name||'').toLowerCase().replace(/\.png$/,'');
  let m=n.match(/^(mcl_flowers_double_plant_(?:fern|grass|paeonia|rose|syringa))_(bottom|top)$/);
  if(m)return {base:m[1],bottom:byName(m[1]+'_bottom.png'),top:byName(m[1]+'_top.png')};
  return null;
 }
 async function makeCrossPlantPart(meta,size){
  const g=document.createElement('div');g.className='preview3dMultipart preview3dPlantPart';g.style.transformStyle='preserve-3d';
  const st=await faceStyle(meta);
  for(const rot of [45,-45]){
   const p=document.createElement('div');p.className='preview3dFace';p.style.width=size+'px';p.style.height=size+'px';p.style.marginLeft=(-size/2)+'px';p.style.marginTop=(-size/2)+'px';p.style.backgroundImage=st.backgroundImage;p.style.backgroundSize='100% 100%';p.style.backgroundRepeat='no-repeat';p.style.backfaceVisibility='visible';p.style.transform=`rotateY(${rot}deg)`;g.appendChild(p);
  }
  return g;
 }
 async function makeTallPlant(meta,size=S){
  const f=tallPlantFamily(meta);if(!f?.bottom||!f?.top)return null;
  const g=document.createElement('div');g.className='preview3dMultipart preview3dTallPlant';g.style.transformStyle='preserve-3d';
  const lo=await makeCrossPlantPart(f.bottom,size),hi=await makeCrossPlantPart(f.top,size);
  lo.style.transform=`translateY(${size/2}px)`;hi.style.transform=`translateY(${-size/2}px)`;g.append(lo,hi);return g;
 }
 function doubleChestFamily(meta){
  const n=String(meta?.name||'').toLowerCase();
  if(!/^mcl_chests_(?:normal|trapped)(?:_double)?(?:_present)?\.png$/.test(n))return null;
  const type=n.includes('trapped')?'trapped':'normal',present=n.includes('_present')?'_present':'';
  return {single:byName(`mcl_chests_${type}${present}.png`),double:byName(`mcl_chests_${type}_double${present}.png`)};
 }
 async function makeChestBox(meta,w,h,d){
  const st=await faceStyle(meta),g=document.createElement('div');g.className='preview3dMultipart preview3dChest';g.style.transformStyle='preserve-3d';
  const face=(W,H,tr,shade=0)=>{const e=document.createElement('div');e.className='preview3dFace';e.style.width=W+'px';e.style.height=H+'px';e.style.marginLeft=(-W/2)+'px';e.style.marginTop=(-H/2)+'px';e.style.backgroundImage=st.backgroundImage;e.style.backgroundSize='100% 100%';e.style.transform=tr;if(shade)e.style.filter=`brightness(${1-shade})`;g.appendChild(e)};
  face(w,h,`translateZ(${d/2}px)`);face(w,h,`rotateY(180deg) translateZ(${d/2}px)`,.14);
  face(d,h,`translateX(${-w/2}px) rotateY(-90deg)`,.08);face(d,h,`translateX(${w/2}px) rotateY(90deg)`,.12);
  face(w,d,`translateY(${-h/2}px) rotateX(90deg)`);face(w,d,`translateY(${h/2}px) rotateX(-90deg)`,.2);return g;
 }
 async function makeDoubleChest(meta,size=S){
  const f=doubleChestFamily(meta);if(!f)return null;
  const tex=f.double||f.single||meta,w=f.double?size*1.7:size,h=size*.82,d=size*.82;
  return makeChestBox(tex,w,h,d);
 }
 async function makeMultipart(meta,size=S){
  const plant=await makeTallPlant(meta,size);if(plant)return plant;
  const chest=await makeDoubleChest(meta,size);if(chest)return chest;
  const f=doorFamily(meta);if(!f)return null;
  const lower=doorPart(f,'lower'),upper=doorPart(f,'upper');if(!lower||!upper)return null;
  const sideLower=doorPart(f,'sideLower')||lower,sideUpper=doorPart(f,'sideUpper')||upper;
  const group=document.createElement('div');group.className='preview3dMultipart preview3dDoor';group.style.transformStyle='preserve-3d';
  const thickness=Math.max(8,Math.round(size*.18));
  const lo=await makeDoorHalf(lower,sideLower,size,thickness),hi=await makeDoorHalf(upper,sideUpper,size,thickness);
  lo.style.transform=`translateY(${size/2}px)`;hi.style.transform=`translateY(${-size/2}px)`;
  group.append(lo,hi);return group;
 }
 async function makeCube(meta,size=S){
  await loadLuaFaceManifest();
  const fromLua=await makeLuaCube(meta,size);if(fromLua)return fromLua;
  if(isGrassPreviewAsset(meta)){const grass=await makeGrassCube(size);if(grass)return grass}
  const fam=faceFamily(meta);
  const grass=fam.special==='grass';
  const styles={
   top:await faceStyle(fam.top,{tint:grass}),
   bottom:await faceStyle(fam.bottom),
   side:await faceStyle(fam.side,{overlay:fam.overlay,tint:false}),
   front:await faceStyle(fam.front,{overlay:fam.overlay,tint:false}),
   back:await faceStyle(fam.back,{overlay:fam.overlay,tint:false}),
   left:await faceStyle(fam.left||fam.side,{overlay:fam.overlay,tint:false}),
   right:await faceStyle(fam.right||fam.side,{overlay:fam.overlay,tint:false})
  };
  const c=document.createElement('div');c.className='preview3dCube';c.style.setProperty('--s',size+'px');
  const z=size/2;
  addFace(c,'front',`translateZ(${z}px)`,styles.front,.08);
  addFace(c,'back',`rotateY(180deg) translateZ(${z}px)`,styles.back,.22);
  addFace(c,'right',`rotateY(90deg) translateZ(${z}px)`,styles.right||styles.side,.16);
  addFace(c,'left',`rotateY(-90deg) translateZ(${z}px)`,styles.left||styles.side,.12);
  addFace(c,'top',`rotateX(90deg) translateZ(${z}px)`,styles.top,0);
  addFace(c,'bottom',`rotateX(-90deg) translateZ(${z}px)`,styles.bottom,.30);
  return c;
 }

 function b3dCString(view,state,end){let out='';while(state.p<end){const c=view.getUint8(state.p++);if(!c)break;out+=String.fromCharCode(c)}return out}
 function b3dMatrix(pos,scale,q){
  const w=q[0],x=q[1],y=q[2],z=q[3],xx=x*x,yy=y*y,zz=z*z,xy=x*y,xz=x*z,yz=y*z,wx=w*x,wy=w*y,wz=w*z;
  return [(1-2*(yy+zz))*scale[0],(2*(xy+wz))*scale[0],(2*(xz-wy))*scale[0],0,(2*(xy-wz))*scale[1],(1-2*(xx+zz))*scale[1],(2*(yz+wx))*scale[1],0,(2*(xz+wy))*scale[2],(2*(yz-wx))*scale[2],(1-2*(xx+yy))*scale[2],0,pos[0],pos[1],pos[2],1];
 }
 function mul4(a,b){const o=new Array(16).fill(0);for(let c=0;c<4;c++)for(let r=0;r<4;r++)for(let k=0;k<4;k++)o[c*4+r]+=a[k*4+r]*b[c*4+k];return o}
 function transform3(m,x,y,z){return [m[0]*x+m[4]*y+m[8]*z+m[12],m[1]*x+m[5]*y+m[9]*z+m[13],m[2]*x+m[6]*y+m[10]*z+m[14]]}
 const I4=[1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1];
 function parseB3D(buf){
  const v=new DataView(buf),td=new TextDecoder('latin1'),out={p:[],uv:[],idx:[],groups:[]};let pos=0;
  const tag=()=>{const a=new Uint8Array(buf,pos,4);pos+=4;return td.decode(a)},i32=()=>{const n=v.getInt32(pos,true);pos+=4;return n},f32=()=>{const n=v.getFloat32(pos,true);pos+=4;return n};
  function chunks(end,matrix){
   while(pos+8<=end){const t=tag(),size=i32(),ce=Math.min(end,pos+Math.max(0,size));if(ce<pos)break;
    if(t==='NODE'){
     const st={p:pos};b3dCString(v,st,ce);pos=st.p;
     if(pos+40<=ce){const p=[f32(),f32(),f32()],sc=[f32(),f32(),f32()],q=[f32(),f32(),f32(),f32()];chunks(ce,mul4(matrix,b3dMatrix(p,sc,q)))}else pos=ce;
    }else if(t==='MESH'){
     if(pos+4>ce){pos=ce;continue}i32();let verts=null,uvs=null;
     while(pos+8<=ce){const mt=tag(),ms=i32(),me=Math.min(ce,pos+Math.max(0,ms));
      if(mt==='VRTS'&&pos+12<=me){
       const flags=i32(),sets=i32(),sz=i32(),pp=[],tt=[];
       while(pos<me){
        const stride=12+((flags&1)?12:0)+((flags&2)?16:0)+Math.max(0,sets*sz)*4;if(pos+stride>me)break;
        const xyz=transform3(matrix,f32(),f32(),f32());pp.push(...xyz);
        if(flags&1){f32();f32();f32()}if(flags&2){f32();f32();f32();f32()}
        let u=0,w=0;for(let set=0;set<sets;set++)for(let k=0;k<sz;k++){const z=f32();if(set===0&&k===0)u=z;if(set===0&&k===1)w=z}
        tt.push(u,w);
       }verts=pp;uvs=tt;pos=me;
      }else if(mt==='TRIS'&&verts){
       if(pos+4>me){pos=me;continue}const brush=i32(),base=out.p.length/3,start=out.idx.length;out.p.push(...verts);out.uv.push(...uvs);while(pos+12<=me)out.idx.push(base+i32(),base+i32(),base+i32());out.groups.push({brush,start,count:out.idx.length-start});pos=me;
      }else pos=me;
     }pos=ce;
    }else pos=ce;
   }pos=end;
  }
  if(tag()!=='BB3D')throw Error('B3D header bulunamadı');const rootSize=i32(),rootEnd=Math.min(v.byteLength,pos+rootSize);if(pos+4<=rootEnd)i32();chunks(rootEnd,I4);
  if(out.p.length<9||out.idx.length<3)throw Error('B3D mesh/UV bulunamadı');
  let min=[Infinity,Infinity,Infinity],max=[-Infinity,-Infinity,-Infinity];
  for(let i=0;i<out.p.length;i+=3)for(let k=0;k<3;k++){min[k]=Math.min(min[k],out.p[i+k]);max[k]=Math.max(max[k],out.p[i+k])}
  const c=min.map((x,k)=>(x+max[k])/2),span=Math.max(...max.map((x,k)=>x-min[k]))||1,scale=1.55/span;
  for(let i=0;i<out.p.length;i+=3){out.p[i]=(out.p[i]-c[0])*scale;out.p[i+1]=(out.p[i+1]-c[1])*scale;out.p[i+2]=(out.p[i+2]-c[2])*scale}
  return out;
 }
 function entitySkinBrush(model){
  return {'mobs_mc_zombie.b3d':1,'mobs_mc_skeleton.b3d':2,'mobs_mc_witherskeleton.b3d':1,'mobs_mc_horse.b3d':1}[String(model||'').toLowerCase()]??0;
 }
 function skinIndices(mesh,model){
  const brush=entitySkinBrush(model),groups=(mesh.groups||[]).filter(g=>g.brush===brush);
  if(!groups.length)return mesh.idx;
  const out=[];for(const g of groups)for(let i=g.start;i<g.start+g.count;i++)out.push(mesh.idx[i]);return out;
 }
 function glShader(gl,type,src){const sh=gl.createShader(type);gl.shaderSource(sh,src);gl.compileShader(sh);if(!gl.getShaderParameter(sh,gl.COMPILE_STATUS))throw Error(gl.getShaderInfoLog(sh)||'shader');return sh}
 function entityRotation(){const ax=rx*Math.PI/180,ay=ry*Math.PI/180,cx=Math.cos(ax),sx=Math.sin(ax),cy=Math.cos(ay),sy=Math.sin(ay);return new Float32Array([cy,sx*sy,-cx*sy,0,0,cx,sx,0,sy,-sx*cy,cx*cy,0,0,0,0,1])}
 function drawEntityGL(){
  const e=entityGL;if(!e)return;const {gl,canvas}=e,dpr=Math.min(1.5,devicePixelRatio||1),w=Math.max(1,stage.clientWidth),h=Math.max(1,stage.clientHeight),cw=Math.round(w*dpr),ch=Math.round(h*dpr);
  if(canvas.width!==cw||canvas.height!==ch){canvas.width=cw;canvas.height=ch}gl.viewport(0,0,cw,ch);gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);gl.useProgram(e.program);gl.uniformMatrix4fv(e.uRot,false,entityRotation());gl.uniform2f(gl.getUniformLocation(e.program,'pan'),panX*2/Math.max(1,w),-panY*2/Math.max(1,h));if(e.uPerspective)gl.uniform1f(e.uPerspective,projection==='perspective'?.72:0);const asp=w/h;gl.uniform2f(e.uScale,zoom*(asp<1?1:1/asp),zoom*(asp<1?asp:1));gl.drawElements(gl.TRIANGLES,e.count,e.indexType,0);
 }
 async function swapEntityTexture(blob){
  const e=entityGL;if(!e||!blob)return;
  const gl=e.gl,bmp=await createImageBitmap(blob);gl.bindTexture(gl.TEXTURE_2D,e.tex);gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL,1);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,bmp);bmp.close?.();drawEntityGL();
 }
 function renderVariantStrip(){
  const strip=document.getElementById('preview3dVariants');if(!strip)return;strip.innerHTML='';
  const list=variantSession?.variants||[];strip.classList.toggle('show',!!list.length);
  list.forEach((rec,i)=>{const b=document.createElement('button');b.className='preview3dVariant'+(i===variantSession.index?' active':'');b.dataset.i=i;
   const im=document.createElement('img');im.src=rec.url||URL.createObjectURL(rec.blob);if(!rec.url)rec.url=im.src;im.alt=rec.name||('Varyant '+(i+1));
   const s=document.createElement('span');s.textContent=(i+1)+' · '+(rec.name||'varyant');b.append(im,s);strip.appendChild(b)});
 }
 async function selectVariant3D(i){
  if(!variantSession)return;const rec=variantSession.variants[i];if(!rec)return;variantSession.index=i;
  if(canEntity(variantSession.meta))await swapEntityTexture(rec.blob);
  else if(canObject(variantSession.meta)){mode='object';await renderCubeGL(variantSession.meta,rec.blob);resetView()}
  document.getElementById('preview3dMeta').textContent=variantSession.meta.name+' · '+(i+1)+'/'+variantSession.variants.length+' · '+rec.name;renderVariantStrip();
 }
 function cleanupEntityGL(){stage._animationNotice?.remove();stage._animationNotice=null;window.MTSB3DPreviewControls?.destroy();if(!entityGL)return;try{const e=entityGL;e.canvas.remove();e.gl.deleteTexture(e.tex);e.gl.deleteBuffer(e.pb);e.gl.deleteBuffer(e.tb);e.gl.deleteBuffer(e.ib);e.gl.deleteProgram(e.program)}catch{}entityGL=null;scene.style.display=''}
 async function renderEntity(meta,textureBlob=null){
  cleanupEntityGL();scene.innerHTML='';scene.style.display='none';const model=entityModelFile(meta);if(!model)throw Error('Bu entity için Mineclonia mesh eşleşmesi yok');
  const modelUrl=MINECLONIA_RAW_BASE+'/ENTITIES/mobs_mc/models/'+encodeURIComponent(model);
  const [res,blob]=await Promise.all([fetch(modelUrl,{cache:'force-cache'}),textureBlob?Promise.resolve(textureBlob):displayBlob(meta.path)]);if(!res.ok)throw Error('Entity mesh yüklenemedi: '+model);
  const buffer=await res.arrayBuffer();let animation=null;
  try{await loadB3DRuntime();animation=window.MTSB3DAnimation.parse(buffer);if(!animation.animated)animation=null}
  catch(err){console.warn('B3D animation disabled for',model,err);animation=null;const notice=document.createElement('div');notice.className='mts-b3d-animation-error';notice.setAttribute('role','status');notice.style.cssText='padding:8px 12px;font-size:12px;color:#ffd8a8;background:#38251c;border-radius:8px;margin:6px 0';notice.textContent='Animasyon yüklenemedi ('+model+'): '+(err?.message||String(err));stage.parentNode.insertBefore(notice,stage.nextSibling);stage._animationNotice=notice}
  const staticMesh=parseB3D(buffer);
  if(animation){
    const candidate=animation.mesh;
    const sameArray=(a,b,tolerance=0)=>a?.length===b?.length&&a.every((value,i)=>Math.abs(value-b[i])<=tolerance);
    const topologyOK=sameArray(candidate.idx,staticMesh.idx)&&sameArray(candidate.uv,staticMesh.uv,1e-5);
    const positionsOK=sameArray(candidate.p,staticMesh.p,1e-4);
    if(!topologyOK||!positionsOK){
      console.warn('B3D animation mesh differs from static reference; using verified static mesh',model,{topologyOK,positionsOK});
      animation=null;
    }
  }
  const mesh=animation?.mesh||staticMesh,indices=skinIndices(mesh,model),canvas=document.createElement('canvas');canvas.style.cssText='position:absolute;inset:0;width:100%;height:100%;touch-action:none';stage.insertBefore(canvas,stage.firstChild);
  const gl=canvas.getContext('webgl',{alpha:true,antialias:true})||canvas.getContext('experimental-webgl');if(!gl)throw Error('WebGL desteklenmiyor');
  const vs=glShader(gl,gl.VERTEX_SHADER,'attribute vec3 p;attribute vec2 t;uniform mat4 r;uniform vec2 s;uniform vec2 pan;varying vec2 u;void main(){vec4 q=r*vec4(p,1.0);gl_Position=vec4(q.x*s.x+pan.x,q.y*s.y+pan.y,q.z*0.45,1.0);u=t;}');
  const fs=glShader(gl,gl.FRAGMENT_SHADER,'precision mediump float;uniform sampler2D tex;varying vec2 u;void main(){vec4 c=texture2D(tex,u);if(c.a<0.02)discard;gl_FragColor=c;}');
  const program=gl.createProgram();gl.attachShader(program,vs);gl.attachShader(program,fs);gl.linkProgram(program);if(!gl.getProgramParameter(program,gl.LINK_STATUS))throw Error(gl.getProgramInfoLog(program)||'WebGL link');gl.useProgram(program);
  const pb=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,pb);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(mesh.p),animation?gl.DYNAMIC_DRAW:gl.STATIC_DRAW);const pa=gl.getAttribLocation(program,'p');gl.enableVertexAttribArray(pa);gl.vertexAttribPointer(pa,3,gl.FLOAT,false,0,0);
  const tb=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,tb);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(mesh.uv),gl.STATIC_DRAW);const ta=gl.getAttribLocation(program,'t');gl.enableVertexAttribArray(ta);gl.vertexAttribPointer(ta,2,gl.FLOAT,false,0,0);
  const maxIdx=Math.max(...indices),use32=maxIdx>65535&&!!gl.getExtension('OES_element_index_uint'),IndexArray=use32?Uint32Array:Uint16Array,indexType=use32?gl.UNSIGNED_INT:gl.UNSIGNED_SHORT;if(maxIdx>65535&&!use32)throw Error('Entity mesh cihazın WebGL index sınırını aşıyor');
  const ib=gl.createBuffer();gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER,ib);gl.bufferData(gl.ELEMENT_ARRAY_BUFFER,new IndexArray(indices),gl.STATIC_DRAW);
  const tex=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,tex);gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL,1);const bmp=await createImageBitmap(blob);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,bmp);bmp.close?.();gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.NEAREST);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.NEAREST);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);
  gl.enable(gl.DEPTH_TEST);gl.enable(gl.BLEND);gl.blendFunc(gl.SRC_ALPHA,gl.ONE_MINUS_SRC_ALPHA);gl.clearColor(0,0,0,0);
  entityGL={canvas,gl,program,pb,tb,ib,tex,count:indices.length,indexType,uRot:gl.getUniformLocation(program,'r'),uScale:gl.getUniformLocation(program,'s'),animation};drawEntityGL();
  if(animation)window.MTSB3DPreviewControls.attach({animation,model,gl,positionBuffer:pb,redraw:drawEntityGL,stage});
  
 }

 async function alphaInfo(meta){
  try{
    const blob=await displayBlob(meta.path),cv=await decodeBlobToCanvas(blob),g=cv.getContext('2d',{willReadFrequently:true}),d=g.getImageData(0,0,cv.width,cv.height).data;
    let transparent=0,semi=0,total=d.length/4;
    for(let i=3;i<d.length;i+=4){const a=d[i];if(a<250)transparent++;if(a>8&&a<247)semi++}
    return {hasAlpha:transparent>Math.max(2,total*.002),hasSemi:semi>Math.max(2,total*.001)};
  }catch{return {hasAlpha:false,hasSemi:false}}
 }
 async function makeSurface(meta){
  const wrap=document.createElement('div');wrap.className='preview3dSurface';
  const blob=await displayBlob(meta.path),url=URL.createObjectURL(blob);
  const backdrop=document.createElement('div');backdrop.className='preview3dSurfaceBackdrop';
  const front=document.createElement('div');front.className='preview3dSurfaceFace front';front.style.backgroundImage=`url("${url}")`;
  const back=document.createElement('div');back.className='preview3dSurfaceFace back';back.style.backgroundImage=`url("${url}")`;
  const edge=document.createElement('div');edge.className='preview3dSurfaceEdge';
  wrap.append(backdrop,front,back,edge);
  wrap._textureUrl=url;
  return wrap;
 }
 async function renderSurface(meta){
  cleanupEntityGL();scene.style.display='';scene.innerHTML='';
  const surface=await makeSurface(meta);scene.appendChild(surface);
  const ai=await alphaInfo(meta);stage.classList.toggle('alphaAware',ai.hasAlpha||ai.hasSemi);
 }
 function applyView(){if(entityGL){drawEntityGL();return}scene.style.transform=`translate(${panX}px,${panY}px) rotateX(${rx}deg) rotateY(${ry}deg) scale(${zoom})`;}
 function resetView(){panX=0;panY=0;rx=entityGL?-12:(mode==='world'?-34:-24);ry=entityGL?28:(mode==='world'?42:38);zoom=mode==='world'?.72:1;applyView();}

 function cubeRotationMatrix(){
  const ax=rx*Math.PI/180,ay=ry*Math.PI/180,cx=Math.cos(ax),sx=Math.sin(ax),cy=Math.cos(ay),sy=Math.sin(ay);
  return new Float32Array([
    cy, sx*sy, -cx*sy, 0,
    0,  cx,     sx,    0,
    sy,-sx*cy,  cx*cy, 0,
    0,  0,      0,     1
  ]);
 }
 async function renderCubeGL(meta,textureBlob=null){
  cleanupEntityGL();scene.innerHTML='';scene.style.display='none';
  const profile=await resolvePreviewProfile(meta);await applyPreviewBackground(profile);root.dataset.previewProfile=profile?.id||'fallback';
  const atlas=await buildFaceAtlas(profile,meta,textureBlob);
  const canvas=document.createElement('canvas');
  canvas.className='preview3dBlockCanvas';
  canvas.style.cssText='position:absolute;inset:0;width:100%;height:100%;touch-action:none;z-index:2';
  stage.insertBefore(canvas,stage.firstChild);
  const gl=canvas.getContext('webgl',{alpha:true,antialias:true,premultipliedAlpha:false})||canvas.getContext('experimental-webgl');
  if(!gl)throw Error('WebGL desteklenmiyor');

  const vs=glShader(gl,gl.VERTEX_SHADER,
    'attribute vec3 p;attribute vec2 t;uniform mat4 r;uniform vec2 s;uniform vec2 pan;uniform float persp;varying vec2 u;varying float shade;void main(){vec4 q=r*vec4(p,1.0);float w=1.0+persp*max(-0.48,min(0.48,q.z));gl_Position=vec4(q.x*s.x+pan.x,q.y*s.y+pan.y,q.z*0.42,w);u=t;shade=.82+.18*max(0.0,q.z+0.5);}'
  );
  const fs=glShader(gl,gl.FRAGMENT_SHADER,
    'precision mediump float;uniform sampler2D tex;varying vec2 u;varying float shade;void main(){vec4 c=texture2D(tex,u);if(c.a<0.015)discard;gl_FragColor=vec4(c.rgb*shade,c.a);}'
  );
  const program=gl.createProgram();gl.attachShader(program,vs);gl.attachShader(program,fs);gl.linkProgram(program);
  if(!gl.getProgramParameter(program,gl.LINK_STATUS))throw Error(gl.getProgramInfoLog(program)||'WebGL link');gl.useProgram(program);

  // Lua-derived boxes are opt-in for recognized nodes; unknown assets retain the original cube.
  let geometry=null;
  try {
    const lib=await import('./preview3d-nodeboxes.mjs');
    const kind=lib.nodeboxKind(profile,meta);
    if(kind){
      const source=await fetch('js/data/preview3d-nodeboxes.json',{cache:'force-cache'});
      if(source.ok){
        const manifest=await source.json();
        // Isolated fence shows the authoritative central post. Neighbor connections require
        // explicit adjacency data; do not claim guessed four-way connections.
        geometry=lib.nodeboxMesh(manifest.profiles?.[kind],[]);
        if(geometry)root.dataset.previewGeometry=kind;
      }
    }
  }catch(err){console.warn('Source-backed nodebox unavailable; retaining cube',err)}
  if(!geometry)delete root.dataset.previewGeometry;
  const P=geometry?.positions||[
   -1,-1, 1,  1,-1, 1,  1, 1, 1, -1, 1, 1,
    1,-1,-1, -1,-1,-1, -1, 1,-1,  1, 1,-1,
    1,-1, 1,  1,-1,-1,  1, 1,-1,  1, 1, 1,
   -1,-1,-1, -1,-1, 1, -1, 1, 1, -1, 1,-1,
   -1, 1, 1,  1, 1, 1,  1, 1,-1, -1, 1,-1,
   -1,-1,-1,  1,-1,-1,  1,-1, 1, -1,-1, 1
  ].map(v=>v*.5);
  const UV=geometry?.uv||[];
  if(!geometry)for(let f=0;f<6;f++){
    const col=f%3,row=Math.floor(f/3),u0=col/3,u1=(col+1)/3,v0=row/2,v1=(row+1)/2;
    UV.push(u0,v1,u1,v1,u1,v0,u0,v0);
  }
  const I=geometry?.indices||[];
  if(!geometry)for(let f=0;f<6;f++){const o=f*4;I.push(o,o+1,o+2,o,o+2,o+3)}
  const pb=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,pb);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(P),gl.STATIC_DRAW);
  const pa=gl.getAttribLocation(program,'p');gl.enableVertexAttribArray(pa);gl.vertexAttribPointer(pa,3,gl.FLOAT,false,0,0);
  const tb=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,tb);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(UV),gl.STATIC_DRAW);
  const ta=gl.getAttribLocation(program,'t');gl.enableVertexAttribArray(ta);gl.vertexAttribPointer(ta,2,gl.FLOAT,false,0,0);
  const ib=gl.createBuffer();gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER,ib);gl.bufferData(gl.ELEMENT_ARRAY_BUFFER,new Uint16Array(I),gl.STATIC_DRAW);
  const tex=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,tex);gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL,0);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,atlas);
  gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);
  gl.enable(gl.DEPTH_TEST);gl.enable(gl.BLEND);gl.blendFunc(gl.SRC_ALPHA,gl.ONE_MINUS_SRC_ALPHA);gl.disable(gl.CULL_FACE);gl.clearColor(0,0,0,0);
  entityGL={canvas,gl,program,pb,tb,ib,tex,count:I.length,indexType:gl.UNSIGNED_SHORT,uRot:gl.getUniformLocation(program,'r'),uScale:gl.getUniformLocation(program,'s'),uPerspective:gl.getUniformLocation(program,'persp'),isBlockCube:true,profile};
  drawEntityGL();
 }
 async function makeTextureCube(meta,size=S){
  const st=await faceStyle(meta);
  const c=document.createElement('div');c.className='preview3dCube';c.style.setProperty('--s',size+'px');const z=size/2;
  addFace(c,'front',`translateZ(${z}px)`,st,.04);
  addFace(c,'back',`rotateY(180deg) translateZ(${z}px)`,st,.12);
  addFace(c,'right',`rotateY(90deg) translateZ(${z}px)`,st,.09);
  addFace(c,'left',`rotateY(-90deg) translateZ(${z}px)`,st,.07);
  addFace(c,'top',`rotateX(90deg) translateZ(${z}px)`,st,0);
  addFace(c,'bottom',`rotateX(-90deg) translateZ(${z}px)`,st,.16);
  return c;
 }
 async function renderObject(meta){
  if(canObject(meta)){await renderCubeGL(meta);return}
  cleanupEntityGL();scene.style.display='';scene.innerHTML='';const c=await makeCube(meta,S);scene.appendChild(c);
 }
 async function renderWorld(meta){
  scene.innerHTML='';
  const size=72,heights=[[0,0,0,0,0],[0,0,1,0,0],[0,1,1,1,0],[0,0,1,0,0],[0,0,0,0,0]];
  const template=await makeCube(meta,size);
  for(let z=0;z<5;z++)for(let x=0;x<5;x++){const c=template.cloneNode(true),h=heights[z][x];c.style.transform=`translate3d(${(x-2)*size}px,${-h*size}px,${(z-2)*size}px)`;scene.appendChild(c)}
 }
 async function render(){
  if(!active)return;
  document.getElementById('preview3dMeta').textContent=active.name;
  const obj=document.getElementById('preview3dObject'),w=document.getElementById('preview3dWorld'),surfaceBtn=document.getElementById('preview3dSurfaceToggle'),projectionBtn=document.getElementById('preview3dProjection'),entity=canEntity(active),blockObject=canObject(active),surface=canSurface(active),object=surface;
  obj.textContent=entity?'Entity':blockObject?'Obje':'Küp';
  obj.style.display=(entity||blockObject)?'':'none';
  w.disabled=entity||!canWorld(active);w.style.display=entity||!canWorld(active)?'none':'';
  if(surfaceBtn){surfaceBtn.hidden=entity||!surface;surfaceBtn.classList.toggle('active',mode==='surface');surfaceBtn.setAttribute('aria-label',mode==='surface'?'Blok/obje görünümüne geç':'İnce yüzey görünümüne geç')}
  if(projectionBtn){projectionBtn.hidden=entity||!blockObject||mode!=='object';projectionBtn.classList.toggle('perspective',projection==='perspective');projectionBtn.querySelector('span')&&(projectionBtn.querySelector('span').textContent=projection==='perspective'?'Persp':'Ortho');projectionBtn.setAttribute('aria-label','Projection: '+projection)}
  obj.classList.toggle('primary',mode==='object');w.classList.toggle('primary',mode==='world');
  stage.classList.remove('alphaAware');
  if(entity){mode='object';await renderEntity(active);resetView();return}
  cleanupEntityGL();
  if(mode==='surface'&&surface){await renderSurface(active);resetView();return}
  if(mode==='world'&&!canWorld(active))mode=blockObject?'object':'surface';
  if(mode==='world')await renderWorld(active);else if(mode==='object')await renderObject(active);else await renderSurface(active);
  const ai=await alphaInfo(active);stage.classList.toggle('alphaAware',ai.hasAlpha||ai.hasSemi);
  resetView();
 }
 async function open(){
  if(!active)return;
  if(!canObject(active)&&!canEntity(active)&&!canSurface(active)){toast('Bu texture için 3D önizleme yok');return}
  mode=canObject(active)||canEntity(active)?'object':'surface';
  root.classList.add('open');await render();
 }
 function close(){root.classList.remove('open');cleanupEntityGL();for(const n of scene.querySelectorAll('.preview3dSurface')){if(n._textureUrl)try{URL.revokeObjectURL(n._textureUrl)}catch{}}scene.innerHTML='';stage.classList.remove('alphaAware');stage.style.backgroundImage='';stage.style.backgroundSize='';stage.style.backgroundPosition='';if(previewBgUrl){try{URL.revokeObjectURL(previewBgUrl)}catch{}previewBgUrl=null}variantSession=null;renderVariantStrip();pointers.clear();lastPinch=0}
 document.getElementById('preview3dClose').addEventListener('click',close);
 document.getElementById('preview3dReset').addEventListener('click',resetView);
 document.getElementById('preview3dObject').addEventListener('click',async()=>{mode='object';await render()});
 document.getElementById('preview3dWorld').addEventListener('click',async()=>{if(!canWorld(active))return;mode='world';await render()});
 document.getElementById('preview3dSurfaceToggle')?.addEventListener('click',async()=>{if(!active||!canSurface(active))return;mode=mode==='surface'?'object':'surface';await render()});
 document.getElementById('preview3dProjection')?.addEventListener('click',()=>{if(!entityGL?.isBlockCube)return;projection=projection==='orthographic'?'perspective':'orthographic';const b=document.getElementById('preview3dProjection');b?.classList.toggle('perspective',projection==='perspective');const s=b?.querySelector('span');if(s)s.textContent=projection==='perspective'?'Persp':'Ortho';b?.setAttribute('aria-label','Projection: '+projection);drawEntityGL()});

 stage.style.touchAction='none';
 stage.addEventListener('pointerdown',e=>{if(e.pointerType==='touch')e.preventDefault();stage.setPointerCapture?.(e.pointerId);pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});if(pointers.size===2){const a=[...pointers.values()];lastPinch=Math.hypot(a[0].x-a[1].x,a[0].y-a[1].y)}});
 stage.addEventListener('pointermove',e=>{
  if(e.pointerType==='touch')e.preventDefault();
  const prev=pointers.get(e.pointerId);if(!prev)return;
  pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});
  if(pointers.size===1){ry-=e.clientX-prev.x;rx-=e.clientY-prev.y;rx=Math.max(-85,Math.min(85,rx));applyView();return}
  if(pointers.size===2){const a=[...pointers.values()],d=Math.hypot(a[0].x-a[1].x,a[0].y-a[1].y);panX+=e.clientX-prev.x;panY+=e.clientY-prev.y;panX=Math.max(-stage.clientWidth,Math.min(stage.clientWidth,panX));panY=Math.max(-stage.clientHeight,Math.min(stage.clientHeight,panY));if(lastPinch)zoom=Math.max(.35,Math.min(2.4,zoom*d/lastPinch));lastPinch=d;applyView()}
 });
 const end=e=>{pointers.delete(e.pointerId);if(pointers.size<2)lastPinch=0};
 stage.addEventListener('pointerup',end);stage.addEventListener('pointercancel',end);
 stage.addEventListener('wheel',e=>{e.preventDefault();zoom*=e.deltaY>0?.9:1.1;zoom=Math.max(.35,Math.min(2.4,zoom));applyView()},{passive:false});
 async function openVariant(meta,blob,label='Varyant',variants=null,index=0){
  if(!canEntity(meta)&&!canObject(meta))throw Error('Bu asset için 3D varyant önizleme yok');
  variantSession=Array.isArray(variants)&&variants.length?{meta,variants,index:Math.max(0,Math.min(index,variants.length-1))}:null;
  const selectedBlob=variantSession?variantSession.variants[variantSession.index].blob:blob;
  mode='object';root.classList.add('open');document.getElementById('preview3dMeta').textContent=meta.name+' · '+label;
  const obj=document.getElementById('preview3dObject'),w=document.getElementById('preview3dWorld'),s=document.getElementById('preview3dSurfaceToggle'),pb=document.getElementById('preview3dProjection');
  if(canEntity(meta)){
    obj.textContent='Entity';w.style.display='none';if(s)s.hidden=true;if(pb)pb.hidden=true;
    await renderEntity(meta,selectedBlob);
  }else{
    obj.textContent='Obje';obj.style.display='';w.style.display='none';if(s){s.hidden=false;s.classList.remove('active')}if(pb)pb.hidden=false;
    await renderCubeGL(meta,selectedBlob);
    if(pb){pb.classList.toggle('perspective',projection==='perspective');const ps=pb.querySelector('span');if(ps)ps.textContent=projection==='perspective'?'Persp':'Ortho'}
  }
  resetView();renderVariantStrip();
 }
 function canVariant3D(meta){return canEntity(meta)||canObject(meta)}
 document.getElementById('preview3dVariants')?.addEventListener('click',e=>{const b=e.target.closest('[data-i]');if(b)selectVariant3D(Number(b.dataset.i))});
 window.MTSPreview3D={open,close,openVariant,canVariant3D,selectVariant3D};
})();
