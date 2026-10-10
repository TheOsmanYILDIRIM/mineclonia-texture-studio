/* Scoped B3D animation controls for Texture Studio. Loaded only for entity previews. */
(()=>{'use strict';
let control=null,styleLoaded=false;
const clipNames={stand:'Bekleme',walk:'Yürüme',run:'Koşma',jump:'Zıplama',attack:'Saldırı',die:'Ölüm',death:'Ölüm',hurt:'Hasar',sit:'Oturma',sleep:'Uyuma',fly:'Uçuş',swim:'Yüzme',shoot:'Ateş',punch:'Vurma',look:'Bakış',idle:'Bekleme'};
let manifestPromise=null;
function getManifest(){
 if(!manifestPromise)manifestPromise=fetch('js/data/b3d-animation-clips.json',{cache:'force-cache'}).then(r=>{if(!r.ok)throw Error('B3D Lua klip kataloğu yüklenemedi');return r.json()}).catch(err=>{manifestPromise=null;throw err});
 return manifestPromise;
}
function clipLabel(c){const name=clipNames[c.name]||c.name.replace(/_/g,' ');return (c.form==='child'?'Yavru · ':'Yetişkin · ')+(c.state==='block'?'Blok taşıma · ':c.state==='normal'?'Normal · ':c.state==='alternate'?'Diğer Lua tanımı · ':'')+name+' ('+c.start+'–'+c.end+')'}
function ensureCSS(){if(styleLoaded)return;styleLoaded=true;const link=document.createElement('link');link.rel='stylesheet';link.href='css/b3d-animation.css';document.head.appendChild(link)}
function attach({animation,model,gl,positionBuffer,redraw,stage}){
 destroy();if(!animation||!animation.animated||!animation.frames)return null;ensureCSS();
 const host=document.createElement('section');host.className='mts-b3d-anim';host.setAttribute('aria-label','Model animasyonu');
 const limit=animation.frames;
 const clips=[['Kareleri incele',0,0,Math.min(animation.fps||25,60)]];
 const option='<option value="0">Kareleri incele</option>';
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
 control={destroy(){pause();host.remove()},pause};setClip({applyPose:false});
 const instance=control;
 getManifest().then(data=>{
   if(control!==instance)return;
   const entry=data.models?.[String(model||'').toLowerCase()];
   const sourced=(entry?.clips||[]).filter(c=>Number.isInteger(c.start)&&Number.isInteger(c.end)&&c.start>=0&&c.end>=c.start&&c.start<=limit);
   clips.length=0;
   for(const c of sourced)clips.push([clipLabel(c),c.start,Math.min(c.end,limit),Number.isFinite(c.speed)&&c.speed>0?c.speed:Math.min(animation.fps||25,60)]);
   // Raw timeline is an explicitly chosen diagnostic, never the default playback.
   clips.push(['Tüm kareler (ham inceleme)',0,limit,Math.min(animation.fps||25,60)]);
   clip.replaceChildren(...clips.map((c,i)=>new Option(c[0],String(i))));
   clip.value='0';setClip();
 }).catch(err=>{if(control!==instance)return;console.warn('B3D Lua clip manifest unavailable',err);
   clips.length=0;clips.push(['Tüm kareler (ham inceleme)',0,limit,Math.min(animation.fps||25,60)]);
   clip.replaceChildren(new Option(clips[0][0],'0'));clip.value='0';setClip();
 });
 return control
}
function destroy(){if(control){control.destroy();control=null}}
window.MTSB3DPreviewControls={attach,destroy};
})();