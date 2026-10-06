(()=>{
 const root=document.getElementById('preview3d');
 const stage=document.getElementById('preview3dStage');
 const scene=document.getElementById('preview3dScene');
 if(!root||!stage||!scene)return;

 let mode='object',rx=-24,ry=38,zoom=1,pointers=new Map(),lastPinch=0;
 const S=150;
 const byName=name=>CATALOG.find(x=>String(x.name||'').toLowerCase()===String(name).toLowerCase())||null;
 const canObject=x=>!!x&&['Block','Functional Block'].includes(assetTypeOf(x));
 const canWorld=x=>!!x&&assetTypeOf(x)==='Block';

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
 function expandLuaFaces(list){
  const a=(list||[]).filter(Boolean);if(!a.length)return null;
  if(a.length===1)return [a[0],a[0],a[0],a[0],a[0],a[0]];
  if(a.length===2)return [a[0],a[1],a[1],a[1],a[1],a[1]];
  if(a.length===3)return [a[0],a[1],a[2],a[2],a[2],a[2]];
  return [a[0],a[1],a[2]||a[0],a[3]||a[2]||a[0],a[4]||a[2]||a[0],a[5]||a[2]||a[0]];
 }
 function luaFaceDef(meta){
  if(!LUA_FACE_INDEX)return null;
  const rows=LUA_FACE_INDEX.get(String(meta?.name||'').toLowerCase());if(!rows?.length)return null;
  const [node,def]=rows[0],faces=expandLuaFaces(def.textures);if(!faces)return null;
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
 async function faceStyle(meta,{overlay=null,tint=false}={}){
  const base=await texUrl(meta);
  const ov=overlay?await texUrl(overlay):'';
  if(ov){
   return {backgroundImage:base?`url("${base}")`:'none',backgroundSize:'100% 100%',overlayTint:true,overlayUrl:ov};
  }
  return {backgroundImage:base?`url("${base}")`:'none',backgroundSize:'100% 100%',overlayTint:false,tint};
 }
 function addFace(cube,cls,transform,style,shade=.08){
  const f=document.createElement('div');f.className='preview3dFace '+cls;f.style.transform=transform;
  f.style.backgroundImage=style.backgroundImage;f.style.backgroundSize=style.backgroundSize||'100% 100%';
  if(style.tint){f.style.backgroundImage=`linear-gradient(rgba(112,166,90,.68),rgba(112,166,90,.68)),${style.backgroundImage}`;f.style.backgroundBlendMode='multiply';}
  if(style.overlayTint&&style.overlayUrl){
   const ov=document.createElement('div');ov.style.cssText='position:absolute;inset:0;background-size:100% 100%;background-repeat:no-repeat;pointer-events:none';
   ov.style.backgroundImage=`linear-gradient(rgba(112,166,90,.72),rgba(112,166,90,.72)),url("${style.overlayUrl}")`;
   ov.style.backgroundBlendMode='multiply';f.appendChild(ov);
  }
  const sh=document.createElement('div');sh.className='preview3dShade';sh.style.opacity=String(shade);f.appendChild(sh);
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
  const {def,faces}=hit,overlays=expandLuaFaces(def.overlays||[]);
  const styles=[];
  for(let i=0;i<6;i++){
   const parts=catalogTextureFromExpr(faces[i]),base=parts[0]||meta,extra=parts[1]||null;
   const overlay=overlays?catalogTextureFromExpr(overlays[i])[0]:null;
   const tint=!!def.palette&&i===0;
   let st=await faceStyle(base,{overlay:overlay||extra,tint});
   if(tint)st.tint=true;styles.push(st);
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
 async function makeCube(meta,size=S){
  if(isGrassPreviewAsset(meta)){const grass=await makeGrassCube(size);if(grass)return grass}
  await loadLuaFaceManifest();
  const fromLua=await makeLuaCube(meta,size);if(fromLua)return fromLua;
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
 function applyView(){scene.style.transform=`rotateX(${rx}deg) rotateY(${ry}deg) scale(${zoom})`;}
 function resetView(){rx=mode==='world'?-34:-24;ry=mode==='world'?42:38;zoom=mode==='world'?.72:1;applyView();}
 async function renderObject(meta){
  scene.innerHTML='';const c=await makeCube(meta,S);scene.appendChild(c);
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
  const w=document.getElementById('preview3dWorld');w.disabled=!canWorld(active);
  document.getElementById('preview3dObject').classList.toggle('primary',mode==='object');
  w.classList.toggle('primary',mode==='world');
  if(mode==='world'&&!canWorld(active))mode='object';
  if(mode==='world')await renderWorld(active);else await renderObject(active);
  resetView();
 }
 async function open(){
  if(!active)return;
  if(!['Block','Functional Block'].includes(assetTypeOf(active))){toast('3D önizleme şu an blok ve fonksiyonel bloklar için');return}
  mode='object';root.classList.add('open');await render();
 }
 function close(){root.classList.remove('open');scene.innerHTML='';pointers.clear();lastPinch=0}
 document.getElementById('preview3dClose').addEventListener('click',close);
 document.getElementById('preview3dReset').addEventListener('click',resetView);
 document.getElementById('preview3dObject').addEventListener('click',async()=>{mode='object';await render()});
 document.getElementById('preview3dWorld').addEventListener('click',async()=>{if(!canWorld(active))return;mode='world';await render()});

 stage.addEventListener('pointerdown',e=>{stage.setPointerCapture?.(e.pointerId);pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});if(pointers.size===2){const a=[...pointers.values()];lastPinch=Math.hypot(a[0].x-a[1].x,a[0].y-a[1].y)}});
 stage.addEventListener('pointermove',e=>{
  const prev=pointers.get(e.pointerId);if(!prev)return;
  pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});
  if(pointers.size===1){ry+=e.clientX-prev.x;rx-=e.clientY-prev.y;rx=Math.max(-85,Math.min(85,rx));applyView();return}
  if(pointers.size===2){const a=[...pointers.values()],d=Math.hypot(a[0].x-a[1].x,a[0].y-a[1].y);if(lastPinch){zoom*=d/lastPinch;zoom=Math.max(.35,Math.min(2.4,zoom));applyView()}lastPinch=d}
 });
 const end=e=>{pointers.delete(e.pointerId);if(pointers.size<2)lastPinch=0};
 stage.addEventListener('pointerup',end);stage.addEventListener('pointercancel',end);
 stage.addEventListener('wheel',e=>{e.preventDefault();zoom*=e.deltaY>0?.9:1.1;zoom=Math.max(.35,Math.min(2.4,zoom));applyView()},{passive:false});
 window.MTSPreview3D={open,close};
})();
