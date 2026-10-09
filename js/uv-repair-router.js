(()=>{
'use strict';
function toast(msg){window.MTSVariantBridge?.toast?.(msg)}
async function openPrimary(){
  if(window.MTSVertexUvStudio?.open)return await window.MTSVertexUvStudio.open();
  toast('Vertex UV Studio yüklenemedi');
  return false;
}
let regionEditorPromise=null;
async function openIsland(path=null){
  try{
    if(!regionEditorPromise)regionEditorPromise=import(new URL('js/island-region-studio.mjs?v=20261009-nodefix1',document.baseURI).href).catch(e=>{regionEditorPromise=null;throw e});
    const editor=await regionEditorPromise;
    return await editor.open(path);
  }catch(e){console.error('Regional UV editor',e);toast('Bölgesel UV editörü açılamadı');return false}
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