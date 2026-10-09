// Region-level UV editing. Pure ImageData transformations; no atlas repacking or storage writes.
const int = n => Number.isFinite(Number(n)) ? Math.round(Number(n)) : 0;
export function normalizedRects(rects,width,height){
  if(!Number.isInteger(width)||!Number.isInteger(height)||width<1||height<1)throw Error('Invalid active UV dimensions');
  const out=[],seen=new Set();
  for(const r of rects||[]){
    if(!r||![r.x,r.y,r.w,r.h].every(v=>Number.isFinite(Number(v))))continue;
    const x=Math.max(0,int(r.x)),y=Math.max(0,int(r.y));
    const right=Math.min(width,int(Number(r.x)+Number(r.w))),bottom=Math.min(height,int(Number(r.y)+Number(r.h)));
    if(x>=right||y>=bottom)continue;
    const item={x,y,w:right-x,h:bottom-y},key=[x,y,item.w,item.h].join(',');
    if(!seen.has(key)){out.push(item);seen.add(key)}
  }
  return out;
}
export function boundsOf(rects,width,height){
  const valid=normalizedRects(rects,width,height);
  if(!valid.length)throw Error('Select at least one nonempty UV region');
  const x=Math.min(...valid.map(r=>r.x)),y=Math.min(...valid.map(r=>r.y));
  const right=Math.max(...valid.map(r=>r.x+r.w)),bottom=Math.max(...valid.map(r=>r.y+r.h));
  return {x,y,w:right-x,h:bottom-y,rects:valid};
}
export function scaleSavedRects(rects,fromWidth,fromHeight,toWidth,toHeight){
  if(!(fromWidth>0&&fromHeight>0))throw Error('Saved UV dimensions missing');
  const sx=toWidth/fromWidth,sy=toHeight/fromHeight;
  return normalizedRects((rects||[]).map(r=>({x:Math.round(r.x*sx),y:Math.round(r.y*sy),w:Math.round((r.x+r.w)*sx)-Math.round(r.x*sx),h:Math.round((r.y+r.h)*sy)-Math.round(r.y*sy)})),toWidth,toHeight);
}
function checkImage(image){if(!image||!Number.isInteger(image.width)||!Number.isInteger(image.height)||image.width<1||image.height<1||image.data?.length!==image.width*image.height*4)throw Error('Invalid RGBA image')}
function selectionMask(rects,width,height){const mask=new Uint8Array(width*height);for(const r of rects)for(let y=r.y;y<r.y+r.h;y++)mask.fill(1,y*width+r.x,y*width+r.x+r.w);return mask}
export function extractRegion(base,rects){
  checkImage(base);
  const b=boundsOf(rects,base.width,base.height),mask=selectionMask(b.rects,base.width,base.height);
  const out=new Uint8ClampedArray(b.w*b.h*4);
  for(let y=b.y;y<b.y+b.h;y++)for(let x=b.x;x<b.x+b.w;x++){
    if(!mask[y*base.width+x])continue;
    const src=(y*base.width+x)*4,dst=((y-b.y)*b.w+x-b.x)*4;
    out.set(base.data.subarray(src,src+4),dst);
  }
  return {image:{width:b.w,height:b.h,data:out},bounds:{x:b.x,y:b.y,w:b.w,h:b.h},rects:b.rects};
}
export function compositeRegion(base,source,rects,options={}){
  checkImage(base);checkImage(source);
  const box=boundsOf(rects,base.width,base.height),mask=selectionMask(box.rects,base.width,base.height);
  const mode=options.mode==='atlas'?'atlas':'region';
  const dx=Number(options.dx||0),dy=Number(options.dy||0),scale=Number(options.scale??1);
  if(![dx,dy,scale].every(Number.isFinite)||scale<=0||scale>20)throw Error('Invalid region alignment');
  const frame=mode==='atlas'?{x:0,y:0,w:base.width,h:base.height}:box;
  const out=new Uint8ClampedArray(base.data);
  let changed=0,selected=0;
  for(let y=box.y;y<box.y+box.h;y++)for(let x=box.x;x<box.x+box.w;x++){
    if(!mask[y*base.width+x])continue;
    selected++;
    const dst=(y*base.width+x)*4;
    // The active atlas owns the alpha/UV occupancy, even when AI outputs an opaque background.
    if(base.data[dst+3]===0)continue;
    const u=.5+((x+.5-frame.x-frame.w/2)-dx)/(frame.w*scale);
    const v=.5+((y+.5-frame.y-frame.h/2)-dy)/(frame.h*scale);
    if(u<0||u>=1||v<0||v>=1)continue;
    const sx=Math.max(0,Math.min(source.width-1,Math.floor(u*source.width+1e-9))),sy=Math.max(0,Math.min(source.height-1,Math.floor(v*source.height+1e-9)));
    const src=(sy*source.width+sx)*4;
    if(source.data[src+3]===0)continue;
    if(out[dst]!==source.data[src]||out[dst+1]!==source.data[src+1]||out[dst+2]!==source.data[src+2])changed++;
    out[dst]=source.data[src];out[dst+1]=source.data[src+1];out[dst+2]=source.data[src+2];
    // The alpha channel remains precisely equal to the active UV's alpha.
  }
  return {image:{width:base.width,height:base.height,data:out},changed,selected,bounds:{x:box.x,y:box.y,w:box.w,h:box.h}};
}
