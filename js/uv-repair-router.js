(()=>{
'use strict';
function toast(msg){window.MTSVariantBridge?.toast?.(msg)}
async function openPrimary(){
  if(window.MTSVertexUvStudio?.open)return await window.MTSVertexUvStudio.open();
  toast('Vertex UV Studio yüklenemedi');
  return false;
}
async function openIsland(path=null){
  if(window.MTSIslandStudio?.open)return await window.MTSIslandStudio.open(path);
  toast('Ada seçim ekranı yüklenemedi');
  return false;
}
async function openLegacyMapper(){
  if(window.MTSUvMapper?.open)return await window.MTSUvMapper.open();
  toast('Legacy UV mapper yüklenemedi');
  return false;
}
window.MTSUvRepair=Object.freeze({
  primary:'vertex',
  openPrimary,
  openIsland,
  openLegacyMapper
});
})();