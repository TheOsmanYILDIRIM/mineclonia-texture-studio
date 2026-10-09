/* Scoped B3D animation controls for Texture Studio. Loaded only for entity previews. */
(()=>{'use strict';
let control=null,styleLoaded=false;
const nativeClips={
 'mobs_mc_cat.b3d':[['Dur',0,0,1],['Yürü',0,40,110],['Koş',0,40,110],['Otur',50,50,1],['Çömel',61,80,20],['Uyu',137,137,1]],
 'mobs_mc_pig.b3d':[['Dur',0,0,1],['Yürü',0,40,55],['Koş',0,40,55]],
 'mobs_mc_creeper.b3d':[['Dur',0,0,1],['Yürü',0,40,48],['Bak',50,108,25],['Hasar',110,139,25],['Ölüm',140,189,25]],
 'mobs_mc_enderman.b3d':[['Dur',40,80,25],['Yürü',0,40,25],['Saldır',81,120,50],['Blokla yürü',161,200,25]]
};
function ensureCSS(){if(styleLoaded)return;styleLoaded=true;const link=document.createElement('link');link.rel='stylesheet';link.href='css/b3d-animation.css';document.head.appendChild(link)}
function attach({animation,model,gl,positionBuffer,redraw,stage}){
 destroy();if(!animation||!animation.animated||!animation.frames)return null;ensureCSS();
 const host=document.createElement('section');host.className='mts-b3d-anim';host.setAttribute('aria-label','Model animasyonu');
 const limit=animation.frames,known=nativeClips[String(model||'').toLowerCase()]||[];
 const boundaries=[...new Set((animation.keyframes||[]).filter(n=>Number.isFinite(n)&&n>=0&&n<=limit))].sort((a,b)=>a-b);
 const intervals=[];for(let i=0;i<boundaries.length-1&&intervals.length<80;i++){const a=boundaries[i],b=boundaries[i+1];if(b-a>=2)intervals.push(['Kare '+a+'–'+b,a,b,Math.min(animation.fps||25,60)])}
 const clips=[['Tüm kareler',0,limit,Math.min(animation.fps||25,60)],...known.filter(c=>c[1]<=limit).map(c=>[c[0],c[1],Math.min(c[2],limit),c[3]]),...intervals];
 const option=clips.map((c,i)=>'<option value="'+i+'">'+c[0]+'</option>').join('');
 host.innerHTML='<div class="mts-b3d-anim-head"><strong>Animasyon</strong><select aria-label="Animasyon türü" class="mts-anim-clip">'+option+'</select><button type="button" class="mts-anim-play" aria-label="Oynat">▶</button><button type="button" class="mts-anim-reset" aria-label="İlk kareye dön">↶</button></div>'+
 '<div class="mts-b3d-anim-rail"><input class="mts-anim-frame" type="range" min="0" max="'+limit+'" step="1" value="0" aria-label="Kare"/><span class="mts-anim-indicator">0 / '+limit+'</span></div>'+
 '<div class="mts-b3d-anim-foot"><label>Başlangıç <input class="mts-anim-start" type="number" min="0" max="'+limit+'" value="0"/></label><label>Bitiş <input class="mts-anim-end" type="number" min="0" max="'+limit+'" value="'+limit+'"/></label><label>Hız <select class="mts-anim-speed"><option value=".25">¼×</option><option value=".5">½×</option><option value="1" selected>1×</option><option value="1.5">1.5×</option><option value="2">2×</option></select></label></div>';
 stage.parentNode.insertBefore(host,stage.nextSibling);
 const q=s=>host.querySelector(s),clip=q('.mts-anim-clip'),play=q('.mts-anim-play'),reset=q('.mts-anim-reset'),slider=q('.mts-anim-frame'),label=q('.mts-anim-indicator'),start=q('.mts-anim-start'),end=q('.mts-anim-end'),speed=q('.mts-anim-speed');
 let raf=0,playing=false,frame=0,begin=0,finish=limit,last=0,rate=animation.fps||25;
 function apply(f){frame=Math.max(begin,Math.min(finish,f));slider.value=String(Math.round(frame));label.textContent=Math.round(frame)+' / '+limit;const pos=animation.sample(frame);gl.bindBuffer(gl.ARRAY_BUFFER,positionBuffer);gl.bufferSubData(gl.ARRAY_BUFFER,0,pos);redraw()}
 function pause(){playing=false;play.textContent='▶';play.setAttribute('aria-label','Oynat');if(raf)cancelAnimationFrame(raf);raf=0;last=0}
 function step(time){if(!playing)return;if(last){frame+=(time-last)/1000*rate*Number(speed.value);if(frame>finish)frame=begin+(frame-begin)%Math.max(1,finish-begin)}last=time;apply(frame);raf=requestAnimationFrame(step)}
 function toggle(){if(playing){pause();return}if(begin===finish){apply(begin);return}playing=true;play.textContent='Ⅱ';play.setAttribute('aria-label','Duraklat');last=0;raf=requestAnimationFrame(step)}
 function setClip({applyPose=true}={}){pause();const c=clips[Number(clip.value)]||clips[0];begin=c[1];finish=c[2];rate=c[3];start.value=String(begin);end.value=String(finish);slider.min=String(begin);slider.max=String(finish);if(applyPose)apply(begin)}
 function setRange(){pause();begin=Math.max(0,Math.min(limit,Math.round(Number(start.value)||0)));finish=Math.max(begin,Math.min(limit,Math.round(Number(end.value)||0)));start.value=String(begin);end.value=String(finish);slider.min=String(begin);slider.max=String(finish);apply(begin);clip.value='0'}
 clip.addEventListener('change',setClip);play.addEventListener('click',toggle);reset.addEventListener('click',()=>{pause();apply(begin)});slider.addEventListener('input',()=>{pause();apply(Number(slider.value))});start.addEventListener('change',setRange);end.addEventListener('change',setRange);
 control={destroy(){pause();host.remove()},pause};setClip({applyPose:false});return control
}
function destroy(){if(control){control.destroy();control=null}}
window.MTSB3DPreviewControls={attach,destroy};
})();