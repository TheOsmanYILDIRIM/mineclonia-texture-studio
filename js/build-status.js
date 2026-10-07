(()=>{'use strict';
const $=id=>document.getElementById(id);
const BUILD={sha:'BUILD_SHA_PLACEHOLDER',time:'BUILD_TIME_PLACEHOLDER'};
function short(s){return String(s||'').slice(0,7)}
function cacheBust(sha){const u=new URL(location.href);u.searchParams.set('build',short(sha)||Date.now());u.searchParams.set('_',Date.now());location.replace(u.toString())}
async function latestMain(){
 const r=await fetch('https://api.github.com/repos/TheOsmanYILDIRIM/mineclonia-texture-studio/commits/main',{cache:'no-store',headers:{Accept:'application/vnd.github+json'}});
 if(!r.ok)throw Error('GitHub '+r.status);return (await r.json()).sha
}
function init(){
 const badge=$('buildBadge'),check=$('buildCheck');if(!badge||!check)return;
 badge.textContent='Build '+short(BUILD.sha);badge.title=BUILD.sha+' · '+BUILD.time;
 let pending=null;
 check.onclick=async()=>{
  if(pending){cacheBust(pending);return}
  check.disabled=true;check.textContent='Kontrol…';
  try{const latest=await latestMain();if(short(latest)!==short(BUILD.sha)){pending=latest;check.textContent='Yeni '+short(latest)+' · Yenile';check.disabled=false;badge.classList.add('stale')}
  else{check.textContent='Güncel ✓';badge.classList.remove('stale');setTimeout(()=>{check.textContent='Güncellemeyi kontrol et'},1800);check.disabled=false}}
  catch(e){console.warn(e);check.textContent='Kontrol başarısız';setTimeout(()=>{check.textContent='Güncellemeyi kontrol et';check.disabled=false},1800)}
 };
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
window.MTSBuildStatus={BUILD,cacheBust};
})();