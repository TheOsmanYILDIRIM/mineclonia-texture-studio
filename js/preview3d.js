(()=>{
 const root=document.getElementById('preview3d');
 const stage=document.getElementById('preview3dStage');
 const scene=document.getElementById('preview3dScene');
 const openBtn=document.getElementById('open3dPreview');
 if(!root||!stage||!scene||!openBtn)return;

 let mode='object',rx=-24,ry=38,zoom=1,pointers=new Map(),lastPinch=0;
 const S=150;
 const byName=name=>CATALOG.find(x=>String(x.name||'').toLowerCase()===String(name).toLowerCase())||null;
 const canWorld=x=>!!x&&assetTypeOf(x)==='Block';

 function familyKey(name){
  return String(name||'').toLowerCase().replace(/\.png$/,'')
   .replace(/_(?:front_(?:on|off)|front|back|top|bottom|side|lit|unlit)$/,'');
 }
 function faceFamily(meta){
  const name=String(meta?.name||'').toLowerCase();
  if(['mcl_core_grass_block_top.png','mcl_core_grass_block_side_overlay.png','default_dirt.png'].includes(name)){
   const top=byName('mcl_core_grass_block_top.png'), dirt=byName('default_dirt.png'), overlay=byName('mcl_core_grass_block_side_overlay.png');
   return {special:'grass',top,bottom:dirt,side:dirt,front:dirt,back:dirt,overlay};
  }
  const key=familyKey(name),siblings=CATALOG.filter(x=>x.mod===meta.mod&&familyKey(x.name)===key);
  const pick=(...tokens)=>siblings.find(x=>tokens.some(t=>new RegExp('_'+t+'(?:_|\\.)').test(String(x.name).toLowerCase())))||null;
  const top=pick('top')||meta,bottom=pick('bottom')||pick('top')||meta,side=pick('side')||meta,front=pick('front_on','front','side')||side,back=pick('back','side')||side;
  return {top,bottom,side,front,back,overlay:null};
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
 async function makeCube(meta,size=S){
  const fam=faceFamily(meta);
  const grass=fam.special==='grass';
  const styles={
   top:await faceStyle(fam.top,{tint:grass}),
   bottom:await faceStyle(fam.bottom),
   side:await faceStyle(fam.side,{overlay:fam.overlay,tint:false}),
   front:await faceStyle(fam.front,{overlay:fam.overlay,tint:false}),
   back:await faceStyle(fam.back,{overlay:fam.overlay,tint:false})
  };
  const c=document.createElement('div');c.className='preview3dCube';c.style.setProperty('--s',size+'px');
  const z=size/2;
  addFace(c,'front',`translateZ(${z}px)`,styles.front,.08);
  addFace(c,'back',`rotateY(180deg) translateZ(${z}px)`,styles.back,.22);
  addFace(c,'right',`rotateY(90deg) translateZ(${z}px)`,styles.side,.16);
  addFace(c,'left',`rotateY(-90deg) translateZ(${z}px)`,styles.side,.12);
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
  const size=72,heights=[
   [0,0,0,0,0],
   [0,0,1,0,0],
   [0,1,1,1,0],
   [0,0,1,0,0],
   [0,0,0,0,0]
  ];
  const jobs=[];
  for(let z=0;z<5;z++)for(let x=0;x<5;x++){
   jobs.push((async()=>{const c=await makeCube(meta,size);const h=heights[z][x];c.style.transform=`translate3d(${(x-2)*size}px,${-h*size}px,${(z-2)*size}px)`;scene.appendChild(c)})());
  }
  await Promise.all(jobs);
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
 openBtn.addEventListener('click',open);
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
})();
