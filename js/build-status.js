(()=>{'use strict';
const $=id=>document.getElementById(id);
const BUILD={sha:'BUILD_SHA_PLACEHOLDER',time:'BUILD_TIME_PLACEHOLDER'};
const short=s=>String(s||'').slice(0,7);
async function deployedBuild(){
 const url='js/build-status.js?probe='+Date.now(),r=await fetch(url,{cache:'no-store'});if(!r.ok)throw Error('Pages '+r.status);
 const txt=await r.text(),m=txt.match(/sha:'([0-9a-f]{40})'/i);return m?.[1]||null
}
async function hardReload(sha){
 try{if('caches'in window){for(const k of await caches.keys())await caches.delete(k)}if(navigator.serviceWorker){for(const reg of await navigator.serviceWorker.getRegistrations())await reg.unregister()}}catch(e){console.warn('cache cleanup',e)}
 const u=new URL('latest.html',location.href);u.searchParams.set('build',String(sha));u.searchParams.set('_',Date.now());location.replace(u.toString())
}
function init(){
 const badge=$('buildBadge'),check=$('buildCheck');if(!badge||!check)return;
 badge.textContent='Build '+short(BUILD.sha);badge.title=BUILD.sha+' · '+BUILD.time;
 let pending=null;
 check.onclick=async()=>{
   if(pending){check.disabled=true;check.textContent='Yenileniyor…';await hardReload(pending);return}
   check.disabled=true;check.textContent='Pages kontrol…';
   try{const live=await deployedBuild();
     if(live&&short(live)!==short(BUILD.sha)){pending=live;badge.classList.add('stale');check.textContent='Hazır '+short(live)+' · Yenile';check.disabled=false}
     else{badge.classList.remove('stale');check.textContent='Güncel ✓';setTimeout(()=>{check.textContent='Güncellemeyi kontrol et'},1600);check.disabled=false}
   }catch(e){console.warn(e);check.textContent='Kontrol başarısız';setTimeout(()=>{check.textContent='Güncellemeyi kontrol et';check.disabled=false},1800)}
 };
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
window.MTSBuildStatus={BUILD,hardReload};
})();