(()=>{
'use strict';
const api=()=>window.MTSUvBridge||{};
const $=id=>document.getElementById(id);
const uvMap={meta:null,rec:null,orig:null,gen:null,work:null,origSel:null,genSel:null,history:[],target:'gen',handle:'move',view:'overlay',globalX:0,globalY:0,globalMode:false,zoom:1,panX:0,panY:0,panMode:false,pointers:new Map(),pinchDist:0,grid:true,autoTarget:null,autoSource:null,autoPairs:[],contours:true,manualLink:false,manualTarget:null,autoBase:null,autoApplied:false,bgMode:'auto',excludeMode:false,excludedTarget:new Set(),excludedSource:new Set(),manualSource:null,edgePairs:[],selectedTargetSegment:null,selectedSourceSegment:null,edgePickSide:'target',islands:[],islandIndex:-1,islandTemplate:null,islandTemplateMap:null,islandMode:false};

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
function uvTransformStatus(){const a=uvMap.origSel,b=uvMap.genSel;if($('uvTransformMeta'))$('uvTransformMeta').textContent=a&&b?'Hedef '+a.w+'×'+a.h+' · Kaynak '+b.w+'×'+b.h:'Hedef ve kaynak alanını seç'}
function uvResizeSource(dw,dh){const s=uvMap.genSel,c=$('uvGenCanvas');if(!s||!c)return;s.w=Math.max(1,Math.min(c.width-s.x,s.w+dw));s.h=Math.max(1,Math.min(c.height-s.y,s.h+dh));uvDrawSelection('gen');uvTransformStatus();uvStatus()}
function uvApplyCurrentTransform(fit=false){if(!uvMap.origSel||!uvMap.genSel||!uvMap.work)return;const before=uvMap.work.getContext('2d').getImageData(0,0,uvMap.work.width,uvMap.work.height),p={orig:{...uvMap.origSel},gen:{...uvMap.genSel}},snap=document.createElement('canvas');snap.width=uvMap.work.width;snap.height=uvMap.work.height;snap.getContext('2d').putImageData(before,0,0);uvMap.history.push(before);const g=uvMap.work.getContext('2d');g.clearRect(p.orig.x,p.orig.y,p.orig.w,p.orig.h);g.imageSmoothingEnabled=true;g.imageSmoothingQuality='high';g.drawImage(snap,p.gen.x,p.gen.y,p.gen.w,p.gen.h,p.orig.x,p.orig.y,p.orig.w,p.orig.h);uvRenderWork();uvTransformStatus();uvStatus();api().toast(fit?'Parça hedef boyuta oturtuldu':'Parça canlı uygulandı')}

function uvRefreshContours(){
 const cv=$('uvContourCanvas');if(!cv||!uvMap.orig||!uvMap.work)return;
 cv.width=uvMap.work.width;cv.height=uvMap.work.height;cv.style.display=uvMap.contours?'':'none';
 if(!uvMap.contours||!uvMap.autoTarget||!uvMap.autoSource){cv.getContext('2d').clearRect(0,0,cv.width,cv.height);return}
 const view=uvMap.view,showTarget=view==='orig'||view==='overlay'||view==='work'||view==='lines',showSource=view==='gen'||view==='overlay'||view==='lines';
 window.MTSUvWarp?.draw?.(cv,uvMap.autoTarget,uvMap.autoSource,uvMap.autoPairs||[],{showTarget,showSource,excludedTarget:uvMap.excludedTarget,excludedSource:uvMap.excludedSource,segmentPairs:uvMap.edgePairs,selectedTargetSegment:uvMap.selectedTargetSegment,selectedSourceSegment:uvMap.selectedSourceSegment});
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
function uvAnalyzeSmart(){
 if(!window.MTSUvWarp||!uvMap.orig||!uvMap.work)return false;
 try{
  uvMap.autoTarget=window.MTSUvWarp.analyze(uvMap.orig,{bgMode:'alpha',role:'target',strictAlpha:true});
  uvMap.autoSource=window.MTSUvWarp.analyze(uvMap.work,{bgMode:'alpha',role:'source',strictAlpha:true});
  uvMap.autoPairs=[];
  const tb=uvMap.autoTarget.bg,sb=uvMap.autoSource.bg;
  $('uvAutoMeta').textContent='Alpha · O '+uvMap.autoTarget.components.length+' ada ('+tb.transparent+' boş) · Ü '+uvMap.autoSource.components.length+' ada ('+sb.transparent+' boş)';
  uvRefreshContours();return true;
 }catch(err){console.error('UV analyze',err);api().toast('Sınır analizi başarısız');return false}
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
   uvRenderWork();uvRefreshContours();uvStatus();if($('uvSaveHint'))$('uvSaveHint').textContent='Exact UV Snap · native grid birebir · '+topo.scale+'×';api().toast('UV sınırı piksel-perfect olarak kilitlendi');return;
 }
 const sourceAnalysis=window.MTSUvWarp.analyze(base,{bgMode:'alpha',role:'source',strictAlpha:true});
 let warped=window.MTSUvWarp.smoothWarp?window.MTSUvWarp.smoothWarp(base,uvMap.autoTarget,sourceAnalysis,uvMap.autoPairs,uvMap.edgePairs):(window.MTSUvWarp.warp)(base,uvMap.autoTarget,sourceAnalysis,uvMap.autoPairs);
 if(uvMap.edgePairs.length&&window.MTSUvWarp.snapAlphaToTarget)warped=window.MTSUvWarp.snapAlphaToTarget(warped,uvMap.autoTarget,uvMap.edgePairs);
 uvMap.work.width=warped.width;uvMap.work.height=warped.height;uvMap.work.getContext('2d').drawImage(warped,0,0);uvMap.autoApplied=true;
 uvMap.autoSource=window.MTSUvWarp.analyze(uvMap.work,{bgMode:'alpha',role:'source',strictAlpha:true});
 const err=window.MTSUvWarp.edgeError?.(uvMap.autoTarget,uvMap.autoSource,uvMap.edgePairs)||{mean:0,max:0};
 uvRenderWork();uvRefreshContours();uvStatus();if($('uvSaveHint'))$('uvSaveHint').textContent='Kenar hatası: ort '+err.mean.toFixed(2)+' px · max '+err.max.toFixed(2)+' px';api().toast(err.mean<=.75?'Kenarlar piksel hassasiyetinde hizalandı':'Kenar hatası '+err.mean.toFixed(2)+' px');
}

function uvSetView(mode){uvMap.view=mode;const o=$('uvOrigCanvas'),g=$('uvGenCanvas'),wrap=$('uvLiveWrap'),range=$('uvOverlayRange'),v=Number(range.value)/100;wrap.classList.toggle('linesOnly',mode==='lines');document.querySelectorAll('[data-uvview]').forEach(b=>b.classList.toggle('primary',b.dataset.uvview===mode));if(mode==='orig'){o.style.opacity='1';g.style.opacity='0'}else if(mode==='gen'){o.style.opacity='0';g.style.opacity='1';const ctx=g.getContext('2d');g.width=uvMap.gen.width;g.height=uvMap.gen.height;ctx.drawImage(uvMap.gen,0,0)}else if(mode==='work'){o.style.opacity='0';g.style.opacity='1';uvRenderWorkCanvasOnly()}else if(mode==='lines'){o.style.opacity='0';g.style.opacity='0'}else{o.style.opacity='1';g.style.opacity=String(v);uvRenderWorkCanvasOnly()}requestAnimationFrame(()=>{uvRenderGlobal();uvDrawSelection('orig');uvDrawSelection('gen');uvRefreshContours()})}
function uvRenderWorkCanvasOnly(){if(!uvMap.work)return;const d=$('uvGenCanvas');d.width=uvMap.work.width;d.height=uvMap.work.height;d.getContext('2d').drawImage(uvMap.work,0,0)}
function uvPoint(e){const canvas=$('uvGenCanvas'),wrap=$('uvLiveWrap'),r=wrap.getBoundingClientRect(),bx=(e.clientX-r.left-uvMap.panX)/uvMap.zoom,by=(e.clientY-r.top-uvMap.panY)/uvMap.zoom;return{x:Math.max(0,Math.min(canvas.width-1,Math.floor(bx*canvas.width/wrap.clientWidth))),y:Math.max(0,Math.min(canvas.height-1,Math.floor(by*canvas.height/wrap.clientHeight)))}}
function bindUvWorkspace(){const wrap=$('uvLiveWrap');let start=null,pid=null;wrap.addEventListener('pointerdown',e=>{if(uvManualLinkPick(e)){e.preventDefault();return}if(uvMap.panMode||uvMap.pointers.size){return}if(e.target.closest('.uvSelection'))return;pid=e.pointerId;wrap.setPointerCapture?.(pid);start=uvPoint(e);uvMap.handle='move';if(uvMap.islandMode){uvMap.target='orig';uvMap.origSel={x:start.x,y:start.y,w:1,h:1};$('uvOrigSel').style.display='block';$('uvGenSel').style.display='none';uvDrawSelection('orig')}else{uvMap.target='gen';uvMap.genSel={x:start.x,y:start.y,w:1,h:1};uvMap.origSel={...uvMap.genSel};uvDrawSelection('orig');uvDrawSelection('gen')}e.preventDefault()});wrap.addEventListener('pointermove',e=>{if(e.pointerId!==pid||!start)return;const p=uvPoint(e),x=Math.min(start.x,p.x),y=Math.min(start.y,p.y),sel={x,y,w:Math.abs(p.x-start.x)+1,h:Math.abs(p.y-start.y)+1};if(uvMap.islandMode){uvMap.origSel={...sel};$('uvOrigSel').style.display='block';uvDrawSelection('orig')}else{uvMap.genSel={...sel};uvMap.origSel={...sel};uvDrawSelection('orig');uvDrawSelection('gen')}uvStatus();e.preventDefault()});const end=e=>{if(e.pointerId===pid){pid=null;start=null}};wrap.addEventListener('pointerup',end);wrap.addEventListener('pointercancel',end)}
async function openUvMapper(){const x=api().variantSelectedMeta?.(),rec=api().variantList?.()||[][api().variantSelectedIndex?.()||0];if(!x||!rec)return;const ob=await api().originalBlob(x.path),oc=await api().decodeBlobToCanvas(ob),gc=await api().decodeBlobToCanvas(rec.blob),wc=document.createElement('canvas');wc.width=gc.width;wc.height=gc.height;wc.getContext('2d').drawImage(gc,0,0);uvMap.meta=x;uvMap.rec=rec;uvMap.orig=oc;uvMap.gen=gc;uvMap.work=wc;uvMap.history=[];uvMap.target='gen';uvMap.handle='move';uvMap.globalX=0;uvMap.globalY=0;uvMap.globalMode=false;uvMap.zoom=1;uvMap.panX=uvMap.panY=0;uvMap.panMode=false;uvMap.pointers.clear();uvMap.grid=true;uvMap.autoTarget=null;uvMap.autoSource=null;uvMap.autoPairs=[];uvMap.contours=true;uvMap.manualLink=false;uvMap.manualTarget=null;uvMap.autoBase=null;uvMap.autoApplied=false;uvMap.bgMode=$('uvBgMode')?.value||'auto';uvMap.excludeMode=false;uvMap.excludedTarget.clear();uvMap.excludedSource.clear();uvMap.manualSource=null;uvMap.islandMode=false;const d=$('uvOrigCanvas');d.width=oc.width;d.height=oc.height;d.getContext('2d').drawImage(oc,0,0);const base={x:0,y:0,w:Math.max(1,Math.floor(oc.width/8)),h:Math.max(1,Math.floor(oc.height/8))};uvMap.origSel={...base};uvMap.genSel={...base};$('uvMapMeta').textContent=x.name;uvIslandLoad();$('uvMapper').classList.add('open');if($('uvManualTools'))$('uvManualTools').open=false;$('uvOrigSel').style.display='none';$('uvGenSel').style.display='none';uvRenderWork();uvSetView('work');uvSetZoom(1);uvSetHandle('gen','move');uvStatus();setTimeout(()=>{uvAnalyzeSmart();$('uvContourToggle').classList.toggle('primary',uvMap.contours)},0)}
function uvSetHandle(kind,handle){uvMap.target=kind;uvMap.handle=handle;document.querySelectorAll('.uvHandle,.uvMoveCenter').forEach(x=>x.classList.remove('active'));const root=$(kind==='orig'?'uvOrigSel':'uvGenSel'),h=root?.querySelector('[data-corner="'+handle+'"]');h?.classList.add('active');$('uvTargetToggle').textContent='Joystick: '+(kind==='orig'?'Hedef':'Kaynak')+' · '+(handle==='move'?'Taşı':handle.toUpperCase())}
function uvMoveTarget(dx,dy){const kind=uvMap.target,s=uvMap[kind+'Sel'],canvas=$(kind==='orig'?'uvOrigCanvas':'uvGenCanvas');if(!s||!canvas)return;const right=s.x+s.w-1,bottom=s.y+s.h-1,h=uvMap.handle;if(h==='move'){s.x+=dx;s.y+=dy}else if(h==='tl'){const nx=Math.max(0,Math.min(right,s.x+dx)),ny=Math.max(0,Math.min(bottom,s.y+dy));s.w=right-nx+1;s.h=bottom-ny+1;s.x=nx;s.y=ny}else if(h==='tr'){const nr=Math.max(s.x,Math.min(canvas.width-1,right+dx)),ny=Math.max(0,Math.min(bottom,s.y+dy));s.w=nr-s.x+1;s.h=bottom-ny+1;s.y=ny}else if(h==='bl'){const nx=Math.max(0,Math.min(right,s.x+dx)),nb=Math.max(s.y,Math.min(canvas.height-1,bottom+dy));s.w=right-nx+1;s.h=nb-s.y+1;s.x=nx}else if(h==='br'){const nr=Math.max(s.x,Math.min(canvas.width-1,right+dx)),nb=Math.max(s.y,Math.min(canvas.height-1,bottom+dy));s.w=nr-s.x+1;s.h=nb-s.y+1}uvClampSel(s,canvas.width,canvas.height);uvDrawSelection(kind);uvStatus()}

document.querySelectorAll('[data-uvsize]').forEach(b=>b.onclick=()=>{const p=b.dataset.uvsize.split(',').map(Number);uvResizeSource(p[0],p[1])});
$('uvFitTarget').onclick=()=>uvApplyCurrentTransform(true);
$('uvPreview3dLive').onclick=async()=>{if(!uvMap.meta||!uvMap.work)return;try{const p=await api().ensurePreview3dLoaded?.(),workBlob=await api().canvasPngBlob(uvMap.work),origBlob=await api().originalBlob(uvMap.meta.path),live=[{blob:origBlob,name:'Orijinal',system:true},{blob:workBlob,name:'Canlı UV',system:true}];await p?.openVariant?.(uvMap.meta,workBlob,'Canlı UV',live,1)}catch(err){console.error(err);api().toast(err?.message||'3D karşılaştırma açılamadı')}};



$('uvBgMode').onchange=e=>{uvMap.bgMode=e.target.value;uvMap.autoTarget=null;uvMap.autoSource=null;uvMap.autoPairs=[];uvAnalyzeSmart()};
$('uvDetectIslands').onclick=()=>uvAnalyzeSmart();

$('uvManualLink').onclick=()=>{uvMap.manualLink=!uvMap.manualLink;uvMap.excludeMode=false;uvMap.edgePickSide='target';uvMap.selectedTargetSegment=null;uvMap.selectedSourceSegment=null;$('uvConfirmEdgeMatch').style.display='none';uvMap.panMode=false;uvMap.globalMode=false;uvMap.pointers.clear();$('uvPanToggle').classList.remove('primary');$('uvLiveWrap').classList.remove('panMode');$('uvExcludeContour').classList.remove('primary');$('uvManualLink').classList.toggle('primary',uvMap.manualLink);$('uvManualLink').textContent=uvMap.manualLink?'Kenar Eşle: İptal':'Kenar Eşle';if(uvMap.manualLink){if(!uvMap.autoTarget||!uvMap.autoSource)uvAnalyzeSmart();uvSetView('lines');$('uvAutoMeta').textContent='1/2 · Orijinal (yeşil) kenarı seç'}else uvRefreshContours()};
$('uvConfirmEdgeMatch').onclick=()=>{if(!uvMap.selectedTargetSegment||!uvMap.selectedSourceSegment)return;uvMap.edgePairs.push({targetSegment:uvMap.selectedTargetSegment,sourceSegment:uvMap.selectedSourceSegment,manual:true});uvMap.selectedTargetSegment=null;uvMap.selectedSourceSegment=null;uvMap.edgePickSide='target';$('uvConfirmEdgeMatch').style.display='none';uvRefreshContours();$('uvAutoMeta').textContent='K'+uvMap.edgePairs.length+' kaydedildi · sonraki Orijinal kenarı seç';api().toast('Kenar çifti eşlendi')};
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
$('uvGlobalApply').onclick=()=>{if(!uvMap.work||(!uvMap.globalX&&!uvMap.globalY))return;const before=uvMap.work.getContext('2d').getImageData(0,0,uvMap.work.width,uvMap.work.height),tmp=document.createElement('canvas');tmp.width=uvMap.work.width;tmp.height=uvMap.work.height;tmp.getContext('2d').drawImage(uvMap.work,uvMap.globalX,uvMap.globalY);uvMap.history.push(before);uvMap.work.getContext('2d').clearRect(0,0,uvMap.work.width,uvMap.work.height);uvMap.work.getContext('2d').drawImage(tmp,0,0);uvMap.globalX=uvMap.globalY=0;uvRenderWork();uvStatus();api().toast('Global kaydırma canlı çalışmaya uygulandı')};

$('uvAddPair').onclick=()=>uvApplyCurrentTransform(false);
$('uvUndoPair').onclick=()=>{const prev=uvMap.history.pop();if(!prev)return;uvMap.work.getContext('2d').putImageData(prev,0,0);uvMap.autoSource=null;uvMap.autoPairs=[];uvMap.autoBase=null;uvMap.autoApplied=false;uvRenderWork();uvRefreshContours();uvStatus()};
$('uvTargetToggle').onclick=()=>{if(!uvMap.globalMode){uvMap.globalMode=true;$('uvTargetToggle').textContent='Joystick: Tüm resim'}else{uvMap.globalMode=false;uvSetHandle('gen','move')}};
document.querySelectorAll('[data-ih]').forEach(h=>h.addEventListener('pointerdown',e=>{islandStudioSetHandle(h.dataset.ih);e.stopPropagation();e.preventDefault()}));(()=>{const joy=$('islandJoystick'),stick=$('islandStick');if(joy){let pid=null,lastX=0,lastY=0;const reset=()=>{stick.style.transform='translate(0,0)'};joy.addEventListener('pointerdown',e=>{pid=e.pointerId;joy.setPointerCapture?.(pid);lastX=e.clientX;lastY=e.clientY;e.preventDefault()});joy.addEventListener('pointermove',e=>{if(e.pointerId!==pid)return;const r=joy.getBoundingClientRect(),cx=r.left+r.width/2,cy=r.top+r.height/2,dx=e.clientX-cx,dy=e.clientY-cy,rad=Math.max(1,r.width*.34),m=Math.hypot(dx,dy),k=Math.min(1,rad/(m||1));stick.style.transform='translate('+(dx*k)+'px,'+(dy*k)+'px)';const sx=Math.abs(dx)>r.width*.16?Math.sign(dx):0,sy=Math.abs(dy)>r.height*.16?Math.sign(dy):0;if(sx||sy){const now=performance.now();if(now-(joy._lastMove||0)>55){islandStudioMove(sx,sy);joy._lastMove=now}}e.preventDefault()});const end=e=>{if(e.pointerId===pid){pid=null;reset()}};joy.addEventListener('pointerup',end);joy.addEventListener('pointercancel',end)}})();
function bindIslandStudioUi(){
 const detail=$('detailIslandStudio');if(detail)detail.onclick=()=>{if(active&&api().assetTypeOf(active)==='Entity'){closeDetailSheet();islandStudioOpen(active.path)}else api().toast('Ada Editörü entity modelleri için')};
 const close=$('islandStudioClose');if(close)close.onclick=()=>$('islandStudio').classList.remove('open');
 const tex=$('islandStudioTexture');if(tex)tex.onchange=e=>islandStudioChoose(e.target.value);
 document.querySelectorAll('[data-islandtab]').forEach(b=>b.onclick=()=>islandStudioSetTab(b.dataset.islandtab));
 const bind=(id,fn)=>{const el=$(id);if(el)el.onclick=fn};
 bind('islandStudioNew',islandStudioNew);bind('islandStudioAdd',islandStudioAdd);bind('islandStudioPrev',()=>islandStudioCycle(-1));bind('islandStudioNext',()=>islandStudioCycle(1));bind('islandStudioDelete',islandStudioDelete);bind('islandStudioExport',()=>islandStudioBuildTemplate(true));bind('islandStudioImport',()=>$('islandStudioFile')?.click());bind('islandStudioRestore',islandStudioRestore);
 const file=$('islandStudioFile');if(file)file.onchange=e=>islandStudioImport(e.target.files?.[0]);
 document.querySelectorAll('[data-ih]').forEach(h=>h.addEventListener('pointerdown',e=>{islandStudioSetHandle(h.dataset.ih);e.stopPropagation();e.preventDefault()}));
 const joy=$('islandJoystick'),stick=$('islandStick');if(joy&&stick){let pid=null;joy.addEventListener('pointerdown',e=>{pid=e.pointerId;joy.setPointerCapture?.(pid);e.preventDefault()});joy.addEventListener('pointermove',e=>{if(e.pointerId!==pid)return;const r=joy.getBoundingClientRect(),cx=r.left+r.width/2,cy=r.top+r.height/2,dx=e.clientX-cx,dy=e.clientY-cy,rad=Math.max(1,r.width*.34),m=Math.hypot(dx,dy),k=Math.min(1,rad/(m||1));stick.style.transform='translate('+(dx*k)+'px,'+(dy*k)+'px)';const sx=Math.abs(dx)>r.width*.16?Math.sign(dx):0,sy=Math.abs(dy)>r.height*.16?Math.sign(dy):0;if((sx||sy)&&performance.now()-(joy._lastMove||0)>55){islandStudioMove(sx,sy);joy._lastMove=performance.now()}e.preventDefault()});const finish=e=>{if(e.pointerId===pid){pid=null;stick.style.transform='translate(0,0)'}};joy.addEventListener('pointerup',finish);joy.addEventListener('pointercancel',finish)}
 const st=$('islandStudioStage');if(st){let pid=null,start=null;st.addEventListener('pointerdown',e=>{if(islandStudio.tab!=='edit'||e.target.closest('[data-ih]'))return;pid=e.pointerId;st.setPointerCapture?.(pid);start=islandStudioPoint(e);islandStudio.sel={x:start.x,y:start.y,w:1,h:1};islandStudioDrawSel();e.preventDefault()});st.addEventListener('pointermove',e=>{if(e.pointerId!==pid||!start)return;const p=islandStudioPoint(e),x=Math.min(start.x,p.x),y=Math.min(start.y,p.y);islandStudio.sel={x,y,w:Math.abs(p.x-start.x)+1,h:Math.abs(p.y-start.y)+1};islandStudioDrawSel();e.preventDefault()});const finish=e=>{if(e.pointerId===pid){pid=null;start=null}};st.addEventListener('pointerup',finish);st.addEventListener('pointercancel',finish)}
}
bindIslandStudioUi();
$('uvApplyFix').onclick=async()=>{if(!uvMap.meta||!uvMap.rec)return;const blob=await api().canvasPngBlob(uvMap.work);await api().saveUvVariant?.(uvMap.meta,uvMap.rec,blob);$('uvMapper').classList.remove('open');api().toast('Düzeltilmiş UV varyanta kaydedildi')};
const manualTools=$('uvManualTools');
if(manualTools)manualTools.addEventListener('toggle',()=>{const show=manualTools.open;$('uvOrigSel').style.display=show?'block':'none';$('uvGenSel').style.display=show?'block':'none';if(show){uvDrawSelection('orig');uvDrawSelection('gen')}});
bindUvWorkspace();
function bindUvPanGestures(){const wrap=$('uvLiveWrap'),pts=()=>[...uvMap.pointers.values()];wrap.addEventListener('pointerdown',e=>{if(!uvMap.panMode&&uvMap.pointers.size===0)return;if(e.target.closest('.uvSelection')&&!uvMap.panMode)return;wrap.setPointerCapture?.(e.pointerId);uvMap.pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});if(uvMap.pointers.size===2){const p=pts();uvMap.pinchDist=Math.hypot(p[1].x-p[0].x,p[1].y-p[0].y)};e.preventDefault()},true);wrap.addEventListener('pointermove',e=>{if(!uvMap.pointers.has(e.pointerId))return;const old=uvMap.pointers.get(e.pointerId);uvMap.pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});const p=pts();if(p.length===1&&uvMap.panMode){uvMap.panX+=e.clientX-old.x;uvMap.panY+=e.clientY-old.y;uvApplyTransform()}else if(p.length>=2){const d=Math.hypot(p[1].x-p[0].x,p[1].y-p[0].y),r=wrap.getBoundingClientRect(),cx=(p[0].x+p[1].x)/2-r.left,cy=(p[0].y+p[1].y)/2-r.top;if(uvMap.pinchDist)uvSetZoom(uvMap.zoom*d/uvMap.pinchDist,cx,cy);uvMap.pinchDist=d}e.preventDefault()},true);const end=e=>{uvMap.pointers.delete(e.pointerId);if(uvMap.pointers.size<2)uvMap.pinchDist=0};wrap.addEventListener('pointerup',end,true);wrap.addEventListener('pointercancel',end,true)}
bindUvPanGestures();
document.querySelectorAll('#uvOrigSel [data-corner],#uvGenSel [data-corner]').forEach(h=>{let pid=null,last=null;h.addEventListener('pointerdown',e=>{e.preventDefault();e.stopPropagation();pid=e.pointerId;last={x:e.clientX,y:e.clientY};h.setPointerCapture?.(pid);uvSetHandle(h.closest('#uvOrigSel')?'orig':'gen',h.dataset.corner)});h.addEventListener('pointermove',e=>{if(e.pointerId!==pid||!last)return;e.preventDefault();e.stopPropagation();const kind=uvMap.target,canvas=$(kind==='orig'?'uvOrigCanvas':'uvGenCanvas'),r=canvas.getBoundingClientRect(),dx=Math.round((e.clientX-last.x)*canvas.width/r.width),dy=Math.round((e.clientY-last.y)*canvas.height/r.height);if(dx||dy){uvMoveTarget(dx,dy);last={x:e.clientX,y:e.clientY}}});const end=e=>{if(e.pointerId===pid){pid=null;last=null;e.stopPropagation()}};h.addEventListener('pointerup',end);h.addEventListener('pointercancel',end)});
{const joy=$('uvJoystick'),stick=$('uvStick');let pid=null,jx=0,jy=0,timer=0,last=0;const move=e=>{if(e.pointerId!==pid)return;const r=joy.getBoundingClientRect(),cx=r.left+r.width/2,cy=r.top+r.height/2,lim=r.width*.32,dx=e.clientX-cx,dy=e.clientY-cy,d=Math.hypot(dx,dy)||1,k=Math.min(1,lim/d),px=dx*k,py=dy*k;jx=px/lim;jy=py/lim;stick.style.transform='translate('+px+'px,'+py+'px)';e.preventDefault();e.stopPropagation()};const loop=t=>{if(pid===null){timer=0;return}if(t-last>85){const dx=Math.abs(jx)>.28?Math.sign(jx):0,dy=Math.abs(jy)>.28?Math.sign(jy):0;if(dx||dy){if(uvMap.globalMode)uvShiftGlobal(dx,dy);else uvMoveTarget(dx,dy)}last=t}timer=requestAnimationFrame(loop)};joy.addEventListener('pointerdown',e=>{pid=e.pointerId;joy.setPointerCapture?.(pid);move(e);if(!timer)timer=requestAnimationFrame(loop)});joy.addEventListener('pointermove',move);const end=e=>{if(e.pointerId!==pid)return;pid=null;jx=jy=0;stick.style.transform='translate(0,0)';if(timer){cancelAnimationFrame(timer);timer=0}};joy.addEventListener('pointerup',end);joy.addEventListener('pointercancel',end)}

const openVariant=(meta)=>window.MTSVariantLab?window.MTSVariantLab.open(meta):api().toast('Varyant Lab modülü yüklenemedi');
$('openVariantLab').onclick=()=>openVariant(active||null);$('detailVariantLab').onclick=()=>openVariant(active);


document.querySelector('.tileTools').addEventListener('click',async e=>{const b=e.target.closest('[data-tile]');if(b){tileN=Number(b.dataset.tile);if(active&&active.w!==active.h&&tileN>1){api().toast('Tile görünümü kare texture için');tileN=1}await updateTilePreview();return}if(e.target.id==='tileSource'){if(!active)return;const edit=await getEdit(active.path);if(!edit){tileEdited=false;api().toast('Bu texture henüz düzenlenmedi')}else tileEdited=!tileEdited;$('tileSource').textContent=tileEdited?'Yeni':'Orijinal';await updateTilePreview()}});
$('mobHqPrompt').onclick=()=>copyMobPrompt('hq');
$('mobRefPrompt').onclick=()=>copyMobPrompt('ref');
$('mobFinalPrompt').onclick=()=>copyMobPrompt('final');
$('copyPrompt').onclick=async()=>{
 if(!active)return;
 const text=active.priority==='P0'?p0ReferencePromptFor(active):$('promptText').value;
 try{await navigator.clipboard.writeText(text)}catch{const ta=document.createElement('textarea');ta.value=text;document.body.appendChild(ta);ta.select();document.execCommand('copy');ta.remove()}
 api().toast(active.priority==='P0'?'Ref prompt kopyalandı':'Prompt kopyalandı');
};
$('savePrompt').onclick=async()=>{
 if(!active)return;
 if(active.priority==='P0'){
   try{await navigator.clipboard.writeText(p0ProductionPromptFor(active))}catch{const ta=document.createElement('textarea');ta.value=p0ProductionPromptFor(active);document.body.appendChild(ta);ta.select();document.execCommand('copy');ta.remove()}
   api().toast('Üretim promptu kopyalandı');return;
 }
 PROMPT_OVERRIDES.set(active.id,$('promptText').value);savePromptOverrides();renderActivePrompt();api().toast("Prompt bu texture ID'sine kaydedildi");
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
$('clearPromptOverrides').onclick=()=>{if(!confirm('JSON/manuel prompt değişiklikleri sıfırlansın mı?'))return;PROMPT_OVERRIDES.clear();savePromptOverrides();api().toast('Özel promptlar sıfırlandı');if(active)openDetail(active)};
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
     for(const size of [64,128,256,512])memoryScaled.delete(scaledMemKey(path,size));
   }
   await api().applyFilter();updateStatFast();
   setSaveState('Kayıt temizliği tamamlandı','ok');api().toast(`${priorities.join(', ')} temizlendi`);
 }catch(err){console.error('priority reset',err);setSaveState('Kayıt temizliği hatası','bad');alert('Kayıtlar temizlenemedi: '+(err?.message||err))}
}
$('priorityResetBtns').onclick=e=>{const b=e.target.closest('[data-reset-priority]');if(b)resetStoredEditsByPriorities([b.dataset.resetPriority])};
$('resetFuturePriorities').onclick=()=>resetStoredEditsByPriorities(['P2','P3','P4','P5','P6']);
$('copyPromptSchema').onclick=async()=>{const sample={prompts:[{path:CATALOG[0].path,prompt:'Yeni prompt metni'},{id:CATALOG[1].id,prompt:'İkinci prompt'}]};const t=JSON.stringify(sample,null,2);try{await navigator.clipboard.writeText(t);api().toast('JSON şeması kopyalandı')}catch{$('promptJsonPreview').value=t}};


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
  const keys=[64,128,256,512].map(res=>scaledMemKey(path,res));
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
 const c=await api().decodeBlobToCanvas(blob),sw=c.width,sh=c.height;
 if(sw===dw&&sh===dh)return blob;
 const src=c.getContext('2d',{willReadFrequently:true}).getImageData(0,0,sw,sh);
 const resized=lanczosResizeImageData(src,sw,sh,dw,dh);
 const out=document.createElement('canvas');out.width=dw;out.height=dh;out.getContext('2d').putImageData(resized,0,0);
 return await api().canvasPngBlob(out)
}
async function normalizeTextureBlobTo(blob,meta,targetRes){
 const c=await api().decodeBlobToCanvas(blob),sw=c.width,sh=c.height;
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
async function api().putEdit(path,blob){
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
  api().toast('Texture kaydediliyor…');
  let b=file;
  if(seam)b=await imageBlobTransform(b,true);
  await api().putEdit(active.path,b);
  queueScaled(active.path,b,active,BACKGROUND_RESOLUTION);
  if(TARGET_RESOLUTION!==BACKGROUND_RESOLUTION) queueScaled(active.path,b,active,TARGET_RESOLUTION);
  api().toast((seam?'Seam dönüşü':'Yeni texture')+' kaydedildi · 256px kopya arka planda hazırlanıyor');
  await openDetail(active); await api().applyFilter();
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
   await api().putEdit(meta.path,blob);
   queueScaled(meta.path,blob,meta,BACKGROUND_RESOLUTION);
   if(TARGET_RESOLUTION!==BACKGROUND_RESOLUTION) queueScaled(meta.path,blob,meta,TARGET_RESOLUTION);
   changed++;processed++;
   if(processed===1||processed===pngs.length||processed%20===0){setSaveState(`ZIP içe aktarılıyor • ${processed}/${pngs.length}`,'warn');await new Promise(requestAnimationFrame)}
 }
 api().toast(`${changed} değişiklik içe aktarıldı • ${same} birebir orijinal yok sayıldı${ambiguous?` • ${ambiguous} eşleşmedi`:''}`);
 setSaveState('İçe aktarma tamamlandı','ok');api().applyFilter()
}
async function importProjectBackup(file){
 const z=await JSZip.loadAsync(file);const mf=z.file('Mineclonia_Texture_Studio_Backup/manifest.json')||z.file('manifest.json');
 if(!mf)throw new Error('Geçerli proje yedeği değil');const m=JSON.parse(await mf.async('string'));
 if(m.format!=='mineclonia-texture-studio-backup')throw new Error('Yedek formatı tanınmadı');if([64,128,256,512].includes(m.targetResolution)){TARGET_RESOLUTION=m.targetResolution;if($('resolution'))$('resolution').value=String(TARGET_RESOLUTION)}
 let ok=0,missing=0;for(const e of (m.edits||[])){const x=CATALOG.find(v=>v.id===e.id)||CATALOG.find(v=>v.path===e.path);const f=z.file('Mineclonia_Texture_Studio_Backup/'+e.file)||z.file(e.file);if(!x||!f){missing++;continue}const blob=await f.async('blob');await api().putEdit(x.path,blob);queueScaled(x.path,blob,x,BACKGROUND_RESOLUTION);if(TARGET_RESOLUTION!==BACKGROUND_RESOLUTION)queueScaled(x.path,blob,x,TARGET_RESOLUTION);ok++;}
 let pc=0;if(m.promptOverrides&&typeof m.promptOverrides==='object'){for(const [id,prompt] of Object.entries(m.promptOverrides)){if(CATALOG.some(x=>x.id===id)&&typeof prompt==='string'){PROMPT_OVERRIDES.set(id,prompt);pc++;}}savePromptOverrides();}
 await api().applyFilter();api().toast(`${ok} düzenleme, ${pc} prompt geri yüklendi${missing?`, ${missing} eşleşmedi`:''}`)
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
   if(!edits.length){api().toast('Değiştirilmiş texture yok');return}
   const z=new JSZip();const root=z.folder('Mineclonia_Dark_Realism');
   root.file('texture_pack.conf','name = mineclonia_dark_realism\ntitle = Mineclonia Dark Realism\ndescription = Only user-modified Mineclonia textures. Original relative texture paths are preserved.\n');
   let done=0,scaledCount=0,nativeCount=0;
   for(const e of edits){
     const meta=CATALOG.find(x=>x.path===e.path);
     if(!meta)continue;
     const before=await api().decodeBlobToCanvas(e.blob);
     const outBlob=await prepareImportedTextureBlob(e.blob,meta,TARGET_RESOLUTION);
     const after=await api().decodeBlobToCanvas(outBlob);
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
   api().toast(`${edits.length} texture export edildi${nativeCount?` · ${nativeCount} dosya kayıtlı doğal çözünürlüğünde`:''}`);
   await api().applyFilter();
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
async function api().putEdit(path,blob){
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
  await api().putEdit(target.path,b);
  queueScaled(target.path,b,target,BACKGROUND_RESOLUTION);
  if(TARGET_RESOLUTION!==BACKGROUND_RESOLUTION) queueScaled(target.path,b,target,TARGET_RESOLUTION);
  api().toast((seam?'Seam dönüşü':'Yeni texture')+' kaydedildi');
  if(active&&active.path===target.path) await openDetail(target);
  await api().applyFilter();
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
async function api().putEdit(path,blob){
  const rec={path,blob,updatedAt:Date.now()};
  hotEdits.set(path,rec); changedPathsFast.add(path); pendingChangedPaths.delete(path);
  const u=setFastEditUrl(path,blob); updateCardFast(path,u); updateStatFast();
  queuePersistFast(path,blob,'changed');
  return rec;
}
async function api().applyFilter(){
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
 for(let i=0;i<cards.length;i+=6){
   if(token!==renderToken)return;
   await Promise.all(cards.slice(i,i+6).map(async([x,img])=>{try{img.src=await previewUrl(x.path,true,THUMB_MAX_EDGE)}catch(e){console.warn(x.path,e)}}));
   await new Promise(requestAnimationFrame);
 }
}
async function importPng(file,seam=false){
  if(!active||!file)return;
  const target={...active};
  setSaveState(`Dosya hazırlanıyor • 16px→${TARGET_RESOLUTION}px ölçek…`,'warn');
  let b=await prepareStoredEditBlob(file,target);
  if(seam)b=await imageBlobTransform(b,true);
  if(await textureMatchesOriginal(b,target)){
    await delEdit(target.path);
    api().toast('Dosya orijinalle birebir aynı • değişiklik sayılmadı');
    return;
  }
  const rec={path:target.path,blob:b,updatedAt:Date.now()};
  hotEdits.set(target.path,rec); changedPathsFast.add(target.path); pendingChangedPaths.delete(target.path);
  const u=setFastEditUrl(target.path,b);
  updateCardFast(target.path,u); updateStatFast();
  if(active&&active.path===target.path){
    $('editImg').src=u; $('editImg').style.opacity=1; $('compare').value=50; updateCompare(); tileEdited=true; $('tileSource').textContent='Yeni';
  }
  api().toast((seam?'Seam dönüşü':'Yeni texture')+` • 16px→${TARGET_RESOLUTION}px ölçek`+(api().assetTypeOf(target)==='Entity'?' • kaynak alpha kilitli':''));
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
  await editWriteQueue; await api().applyFilter();
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
async function bootstrapStorageInBackground(){
  try{
    await initStorage();
    setSaveState(storageMode==='indexeddb'?'Hazır • kalıcı kayıt':storageMode==='local'?'Hazır • yerel fallback':'Hazır • sadece oturum',storageMode==='indexeddb'?'ok':storageMode==='local'?'warn':'bad');
    initScaledStorage().catch(err=>console.warn('scaled storage init',err));
    const edits=await allEdits();
    for(const e of edits){
      if(!CATALOG.some(x=>x.path===e.path))continue;
      installPersistedEditFast(e,{markChanged:(e.verification||'unknown')==='changed'});
    }
    updateStatFast();
    await api().applyFilter();
    changedHydrationPromise=hydrateChangedPathsFast(edits)
      .then(async result=>{await api().applyFilter();return result})
      .catch(err=>{console.warn('background changed-state hydration',err);return {complete:false,total:edits.length,same:0,failed:edits.length}});
  }catch(e){
    console.warn('storage bootstrap',e);
    storageMode='memory';
    setSaveState('Hazır • sadece oturum','bad');
  }
}


window.MTSUvMapper={open:openUvMapper};
})();
