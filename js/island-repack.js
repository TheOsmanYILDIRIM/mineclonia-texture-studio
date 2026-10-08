(()=>{
'use strict';

function dedupeRects(rects=[]){
  const seen=new Set(),out=[];
  for(const r of rects){
    if(!r||r.w<=0||r.h<=0)continue;
    const key=[r.x,r.y,r.w,r.h].join(':');
    if(seen.has(key))continue;
    seen.add(key);out.push(r);
  }
  return out;
}

function scaledRect(r,sx,sy){
  return {
    x:r.x*sx,
    y:r.y*sy,
    w:r.w*sx,
    h:r.h*sy
  };
}

function sourceFrame(slot,finalRects,scaleX,scaleY){
  const fr=finalRects?.[slot.slotId];
  if(fr&&Number.isFinite(fr.x)&&Number.isFinite(fr.y)&&fr.w>0&&fr.h>0){
    return {x:fr.x,y:fr.y,w:fr.w,h:fr.h,corrected:true};
  }
  return {
    x:slot.content.x*scaleX,
    y:slot.content.y*scaleY,
    w:slot.content.w*scaleX,
    h:slot.content.h*scaleY,
    corrected:false
  };
}

function restore({sheet,map,finalRects={}}={}){
  if(!sheet)throw Error('Corrected island sheet missing');
  if(!map?.slots?.length||map.v!==3||map.layout!=='group-slots-v3')throw Error('V3 island slot map missing');

  const scaleX=sheet.width/Math.max(1,map.sheetW);
  const scaleY=sheet.height/Math.max(1,map.sheetH);
  const out=document.createElement('canvas');
  out.width=Math.max(1,Math.round(map.sourceW*scaleX));
  out.height=Math.max(1,Math.round(map.sourceH*scaleY));
  const g=out.getContext('2d');
  g.imageSmoothingEnabled=true;
  g.imageSmoothingQuality='high';

  let restoredRects=0;
  const failed=[];

  for(const slot of map.slots){
    const rects=dedupeRects(slot.rects);
    if(!rects.length){failed.push(slot.slotId);continue}

    const frame=sourceFrame(slot,finalRects,scaleX,scaleY);
    const srcW=Math.max(1,slot.src.w);
    const srcH=Math.max(1,slot.src.h);

    for(const rr of rects){
      const lx=(rr.x-slot.src.x)/srcW;
      const ly=(rr.y-slot.src.y)/srcH;
      const lw=rr.w/srcW;
      const lh=rr.h/srcH;

      const sx=frame.x+lx*frame.w;
      const sy=frame.y+ly*frame.h;
      const sw=Math.max(.01,lw*frame.w);
      const sh=Math.max(.01,lh*frame.h);

      const dst=scaledRect(rr,scaleX,scaleY);
      const dx=Math.round(dst.x),dy=Math.round(dst.y);
      const dw=Math.max(1,Math.round(dst.w)),dh=Math.max(1,Math.round(dst.h));

      g.drawImage(sheet,sx,sy,sw,sh,dx,dy,dw,dh);
      restoredRects++;
    }
  }

  return {
    canvas:out,
    restoredRects,
    slotCount:map.slots.length,
    failed,
    scaleX,
    scaleY
  };
}

window.MTSIslandRepack={restore};
})();