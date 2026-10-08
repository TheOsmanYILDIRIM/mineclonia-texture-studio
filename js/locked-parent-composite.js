(()=>{
'use strict';
const $=id=>document.getElementById(id);
let target=null,parent=null,source=null,generated=null,mask=null,painting=false,erase=false,dirty=false;
const bridge=()=>window.MTSVariantBridge;
const canvas=()=> $('lockedCompositeCanvas');
function decode(blob){return createImageBitmap(blob)}
function drawInto(ctx,img,w,h){ctx.clearRect(0,0,w,h);ctx.drawImage(img,0,0,w,h)}
function refresh(){
 if(!parent||!generated||!mask)return;
 const c=canvas(),ctx=c.getContext('2d',{willReadFrequently:true}),w=c.width,h=c.height;
 const p=document.createElement('canvas'),g=document.createElement('canvas');
 p.width=g.width=w;p.height=g.height=h;
 drawInto(p.getContext('2d'),parent,w,h);drawInto(g.getContext('2d'),generated,w,h);
 const base=p.getContext('2d').getImageData(0,0,w,h),ore=g.getContext('2d').getImageData(0,0,w,h);
 for(let i=0;i<mask.length;i++)if(mask[i]){
  const k=i*4;
  if(ore.data[k+3]===0)continue;
  for(let j=0;j<4;j++)base.data[k+j]=ore.data[k+j];
 }
 ctx.putImageData(base,0,0);
 // Selection visualization is an overlay, never saved into the composite.
 const overlay=$('lockedCompositeOverlay'),oc=overlay.getContext('2d');
 oc.clearRect(0,0,w,h);
 const img=oc.createImageData(w,h);
 for(let i=0;i<mask.length;i++)if(mask[i]){let k=i*4;img.data[k]=40;img.data[k+1]=200;img.data[k+2]=255;img.data[k+3]=65}
 oc.putImageData(img,0,0);
 $('lockedCompositeCount').textContent=mask.reduce((a,b)=>a+b,0)+' / '+mask.length+' mineral pikseli';
}
async function open(meta){
 const d=bridge()?.materialReferenceDependency?.(meta);
 if(!d?.refs?.length||!/_ore\.png$/i.test(meta.name||''))return bridge()?.toast?.('Yalnız parent bağımlılığı tanımlı cevherlerde kullanılabilir');
 target=meta;
 const base=d.refs[0],existing=await bridge().getEdit(base.path);
 parent=await decode(existing?.blob||await bridge().originalBlob(base.path));
 const c=canvas();c.width=parent.width;c.height=parent.height;
 const overlay=$('lockedCompositeOverlay');overlay.width=c.width;overlay.height=c.height;
 mask=new Uint8Array(c.width*c.height);generated=null;dirty=false;
 $('lockedCompositeTitle').textContent=meta.name+' · '+base.name;
 $('lockedCompositeFile').value='';
 $('lockedComposite').hidden=false;
 const ctx=c.getContext('2d');drawInto(ctx,parent,c.width,c.height);
 overlay.getContext('2d').clearRect(0,0,c.width,c.height);
 $('lockedCompositeCount').textContent='Mineral seçimi bekleniyor';
}
async function load(file){
 if(!file||!parent)return;
 const bmp=await decode(file);
 generated=bmp;mask.fill(0);dirty=false;refresh();
}
function paint(e){
 if(!generated||!mask)return;
 const c=canvas(),rect=c.getBoundingClientRect(),x=Math.floor((e.clientX-rect.left)*c.width/rect.width),y=Math.floor((e.clientY-rect.top)*c.height/rect.height);
 const radius=Math.max(1,Number($('lockedCompositeBrush').value)||8)*c.width/256;
 for(let yy=Math.max(0,Math.floor(y-radius));yy<=Math.min(c.height-1,Math.ceil(y+radius));yy++)
 for(let xx=Math.max(0,Math.floor(x-radius));xx<=Math.min(c.width-1,Math.ceil(x+radius));xx++)
 if((xx-x)**2+(yy-y)**2<=radius*radius)mask[yy*c.width+xx]=erase?0:1;
 dirty=true;refresh();
}
async function save(){
 if(!target||!generated||!mask?.some(Boolean))return bridge()?.toast?.('Önce mineral alanlarını boya');
 const c=canvas();
 const blob=await new Promise(resolve=>c.toBlob(resolve,'image/png'));
 if(!blob)return bridge()?.toast?.('PNG oluşturulamadı');
 await bridge().putEdit(target.path,blob);
 bridge().markChanged?.(target.path);
 bridge()?.toast?.('Locked Parent Composite kaydedildi');
 $('lockedComposite').hidden=true;
 bridge().applyFilter?.();
}
function bind(){
 const c=canvas();
 c.addEventListener('pointerdown',e=>{if(!generated)return;painting=true;c.setPointerCapture(e.pointerId);paint(e)});
 c.addEventListener('pointermove',e=>{if(painting)paint(e)});
 for(const ev of ['pointerup','pointercancel','lostpointercapture'])c.addEventListener(ev,()=>painting=false);
 $('lockedCompositeFile').addEventListener('change',e=>load(e.target.files[0]).catch(console.error));
 $('lockedCompositeErase').addEventListener('change',e=>erase=e.target.checked);
 $('lockedCompositeReset').onclick=()=>{mask?.fill(0);dirty=false;refresh()};
 $('lockedCompositeSave').onclick=()=>save().catch(e=>bridge()?.toast?.(e.message));
 $('lockedCompositeClose').onclick=()=>{$('lockedComposite').hidden=true};
 $('lockedCompositeOpen').onclick=()=>open(bridge()?.active?.()).catch(e=>bridge()?.toast?.(e.message));
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',bind);else bind();
window.MTSLockedParentComposite={open};
})();