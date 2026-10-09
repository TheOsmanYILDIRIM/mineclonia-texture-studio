/** Reversible, source-authoritative UV generation presentation. Browser + Node ES module.
 * Never measures AI geometry from a force-applied target mask.
 */
const isInt = n => Number.isInteger(n);
const assert = (ok, message) => { if (!ok) throw new Error(message); };
const rgba = (width, height, data = new Uint8ClampedArray(width * height * 4)) => ({ width, height, data });
const color = (hex) => {
  assert(/^#[0-9a-fA-F]{6}$/.test(hex), 'Color must be #RRGGBB');
  return [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16));
};
function validateImage(image) {
  assert(image && isInt(image.width) && isInt(image.height) && image.width > 0 && image.height > 0 && image.data?.length === image.width * image.height * 4, 'Invalid RGBA image');
  assert(image.width <= 512 && image.height <= 512, 'Source exceeds supported native size (512px)');
}
function getOptions(options = {}) {
  const scale = Number(options.scale ?? 24), spacing = Number(options.spacing ?? 48);
  const clearance = Number(options.clearance ?? 8);
  assert(isInt(scale) && scale >= 1 && scale <= 48, 'Scale must be an integer in 1..48');
  assert(isInt(spacing) && spacing >= 8 && spacing <= 512, 'Grid spacing must be 8..512px');
  assert(isInt(clearance) && clearance >= 0 && clearance <= 48, 'Clearance must be 0..48px');
  return { scale, spacing, clearance, matte: options.matte ?? '#1c1f27', grid: options.grid ?? '#ff00ff' };
}
function prepareMapping(source, options) {
  const w = source.width, h = source.height;
  const mapping = options.mapping;
  if (mapping) {
    assert(Array.isArray(mapping.layout_size) && mapping.layout_size.length === 2 && Array.isArray(mapping.groups) && mapping.groups.length > 0, 'Invalid mapping manifest');
    assert(!mapping.source_size || mapping.source_size[0] === w && mapping.source_size[1] === h, 'Mapping source size mismatch');
    return { layout: mapping.layout_size.slice(), groups: mapping.groups.map(g => ({ id: String(g.id), source: g.source.slice(), dest: g.dest.slice() })) };
  }
  const side = Math.max(w, h), align = options.align ?? 'center';
  assert(['center', 'top', 'bottom'].includes(align), 'Unknown square placement');
  const dx = Math.floor((side - w) / 2);
  const dy = align === 'top' ? 0 : align === 'bottom' ? side - h : Math.floor((side - h) / 2);
  return { layout: [side, side], groups: [{ id: 'atlas', source: [0, 0, w, h], dest: [dx, dy] }] };
}
function masksFor(source, mapping) {
  const [lw, lh] = mapping.layout, { width: w, height: h } = source;
  assert(isInt(lw) && isInt(lh) && lw > 0 && lh > 0 && lw <= 512 && lh <= 512, 'Layout exceeds 512px');
  const occupied = new Uint8Array(lw * lh), seenSource = new Uint8Array(w * h);
  const ids = new Set();
  for (const g of mapping.groups) {
    assert(g.id && !ids.has(g.id), 'Duplicate/empty group ID'); ids.add(g.id);
    const [x0,y0,x1,y1] = g.source, [dx,dy] = g.dest;
    assert([x0,y0,x1,y1,dx,dy].every(isInt) && x0>=0 && y0>=0 && x1>x0 && y1>y0 && x1<=w && y1<=h && dx>=0 && dy>=0 && dx+x1-x0<=lw && dy+y1-y0<=lh, 'Invalid UV group coordinates');
    for(let y=y0;y<y1;y++) for(let x=x0;x<x1;x++) {
      const i=y*w+x, tx=dx+x-x0, ty=dy+y-y0, j=ty*lw+tx;
      assert(!seenSource[i], 'Overlapping source rectangles'); seenSource[i]=1;
      if (source.data[i*4+3] > 0) { assert(!occupied[j], 'Overlapping occupied destination rectangles'); occupied[j]=1; }
    }
  }
  for(let i=0;i<w*h;i++) if (source.data[i*4+3] > 0) assert(seenSource[i], 'Unmapped opaque UV pixel');
  return occupied;
}
export function createPlan(source, options = {}) {
  validateImage(source);
  const settings = getOptions(options);
  const mapping = prepareMapping(source, options);
  const occupied = masksFor(source, mapping);
  const { scale } = settings;
  assert(mapping.layout[0]*scale <= 8192 && mapping.layout[1]*scale <= 8192, 'Output exceeds 8192px');
  const manifest = {
    schema: 'mts-uv-generation-v1', source_size:[source.width,source.height],
    layout_size:mapping.layout, scale, groups:mapping.groups,
    grid:{spacing:settings.spacing,clearance:settings.clearance,color:settings.grid,matte:settings.matte},
    notes:'Inverse preserves original alpha by construction. AI geometric accuracy must be checked independently.'
  };
  return { manifest, occupied };
}
export function loadPlan(source, manifest) {
  assert(manifest?.schema === 'mts-uv-generation-v1', 'Unsupported/absent round-trip manifest');
  assert(manifest.source_size?.[0]===source.width && manifest.source_size?.[1]===source.height, 'Original texture does not match saved manifest dimensions');
  return createPlan(source, { scale:manifest.scale, spacing:manifest.grid.spacing, clearance:manifest.grid.clearance, grid:manifest.grid.color, matte:manifest.grid.matte, mapping:{source_size:manifest.source_size,layout_size:manifest.layout_size,groups:manifest.groups} });
}
function sampleInside(plan, x, y) {
  const [w,h] = plan.manifest.layout_size, s = plan.manifest.scale;
  if(x<0||y<0||x>=w*s||y>=h*s) return false;
  return plan.occupied[Math.floor(y/s)*w+Math.floor(x/s)] !== 0;
}
function nearOccupied(plan, x, y, radius) {
  // Inspect the native cells whose scaled rectangles intersect this radius.
  const [w,h] = plan.manifest.layout_size, s=plan.manifest.scale;
  const x0=Math.max(0,Math.floor((x-radius)/s)), x1=Math.min(w-1,Math.floor((x+radius)/s));
  const y0=Math.max(0,Math.floor((y-radius)/s)), y1=Math.min(h-1,Math.floor((y+radius)/s));
  for(let yy=y0;yy<=y1;yy++) for(let xx=x0;xx<=x1;xx++) {
    if(!plan.occupied[yy*w+xx]) continue;
    const left=xx*s, right=left+s-1, top=yy*s, bottom=top+s-1;
    const dx=Math.max(left-x,0,x-right),dy=Math.max(top-y,0,y-bottom);
    if(dx*dx+dy*dy <= radius*radius) return true;
  }
  return false;
}
export function pack(source, plan) {
  const m=plan.manifest, s=m.scale, [w,h]=m.layout_size;
  const output=rgba(w*s,h*s), d=output.data;
  const bg=color(m.grid.matte),fg=color(m.grid.color);
  for(let y=0;y<output.height;y++) for(let x=0;x<output.width;x++) {
    const i=(y*output.width+x)*4;
    const line=(x % m.grid.spacing === 0 || y % m.grid.spacing === 0);
    const c=line&&!nearOccupied(plan,x,y,m.grid.clearance)?fg:bg;
    d[i]=c[0];d[i+1]=c[1];d[i+2]=c[2];d[i+3]=255;
  }
  for(const g of m.groups) {
    const [x0,y0,x1,y1]=g.source,[dx,dy]=g.dest;
    for(let y=y0;y<y1;y++)for(let x=x0;x<x1;x++) {
      const src=(y*source.width+x)*4;
      if(source.data[src+3]===0)continue;
      const tx=(dx+x-x0)*s,ty=(dy+y-y0)*s;
      for(let oy=0;oy<s;oy++)for(let ox=0;ox<s;ox++) {
        const dst=((ty+oy)*output.width+tx+ox)*4;
        d[dst]=source.data[src];d[dst+1]=source.data[src+1];d[dst+2]=source.data[src+2];d[dst+3]=255;
      }
    }
  }
  return output;
}
function magentaAt(data, idx) {
  const r=data[idx],g=data[idx+1],b=data[idx+2];
  return r>=85 && b>=85 && r>g*1.7 && b>g*1.7 && Math.abs(r-b)<115;
}
function sampleGrid(image, plan, dx, dy) {
  const { spacing, clearance }=plan.manifest.grid;
  let n=0, matches=0;
  // Sample the MIDPOINT of each horizontal and vertical grid segment, not
  // intersections: a candidate shifted in only one axis must not score 100%.
  for(let y=spacing;y<image.height-spacing;y+=spacing) for(let x=spacing;x<image.width-spacing;x+=spacing) {
    const mid=Math.floor(spacing/2);
    for(const [sx,sy] of [[x+mid,y],[x,y+mid]]) {
      if(nearOccupied(plan,sx,sy,clearance+3))continue;
      const xx=sx+dx,yy=sy+dy;
      if(xx<0||yy<0||xx>=image.width||yy>=image.height)continue;
      if(magentaAt(image.data,(yy*image.width+xx)*4))matches++;
      n++;
    }
  }
  return {fraction:n?matches/n:0, points:n};
}
export function estimateShift(image, plan, maxShift=6) {
  const [lw,lh]=plan.manifest.layout_size,s=plan.manifest.scale;
  assert(image.width===lw*s && image.height===lh*s,'Generated canvas size differs from manifest; never silently resize');
  assert(isInt(maxShift) && maxShift>=0 && maxShift<=12, 'Maximum automatic shift must be 0..12px');
  const base=sampleGrid(image,plan,0,0), scores=[];
  for(let dy=-maxShift;dy<=maxShift;dy++) for(let dx=-maxShift;dx<=maxShift;dx++) {
    const q=sampleGrid(image,plan,dx,dy); scores.push({dx,dy,score:q.fraction,points:q.points});
  }
  scores.sort((a,b)=> b.score-a.score || (Math.abs(a.dx)+Math.abs(a.dy))-(Math.abs(b.dx)+Math.abs(b.dy)));
  const best=scores[0],runner=scores.find(v=>Math.abs(v.dx-best.dx)+Math.abs(v.dy-best.dy)>=2);
  const accept=best.score>=0.40 && best.score-base.fraction>=0.08 && best.score-(runner?.score??0)>=0.03;
  return {dx:accept?best.dx:0,dy:accept?best.dy:0,applied:accept,score:best.score,unshiftedScore:base.fraction,pointCount:best.points,reason:accept?'grid-registered':'insufficient-distinct-grid-evidence'};
}
function nearTransparent(plan,x,y,band) {
  for(let dy=-band;dy<=band;dy++)for(let dx=-band;dx<=band;dx++){
    if(dx*dx+dy*dy>band*band)continue;
    if(!sampleInside(plan,x+dx,y+dy))return true;
  }
  return false;
}
export function unpack(source, generated, plan, options={}) {
  const m=plan.manifest, s=m.scale, [lw,lh]=m.layout_size;
  assert(generated.width===lw*s&&generated.height===lh*s, 'AI image size changed; refuse implicit resize');
  assert(source.width===m.source_size[0]&&source.height===m.source_size[1], 'Original dimensions changed');
  const maxShift=Number(options.maxShift??6),manualX=Number(options.manualX??0),manualY=Number(options.manualY??0);
  assert(isInt(manualX)&&isInt(manualY)&&Math.abs(manualX)<=12&&Math.abs(manualY)<=12,'Manual shift must be integer ±12px');
  const auto=options.autoShift===false?{dx:0,dy:0,applied:false,reason:'disabled'}:estimateShift(generated,plan,maxShift);
  const gx=auto.dx+manualX,gy=auto.dy+manualY;
  const output=rgba(source.width*s,source.height*s),d=output.data;
  // Start from full upscaled original to retain RGBA where not occupied / hidden RGB.
  for(let y=0;y<output.height;y++)for(let x=0;x<output.width;x++){
    const src=(Math.floor(y/s)*source.width+Math.floor(x/s))*4,di=(y*output.width+x)*4;
    for(let c=0;c<4;c++) d[di+c]=source.data[src+c];
  }
  let bleed=0,repaired=0,unresolved=0,clipped=0;
  const band=Number(options.edgeBand??3),radius=Number(options.repairRadius??6);
  assert(isInt(band)&&band>=0&&band<=8&&isInt(radius)&&radius>=0&&radius<=12,'Invalid edge tolerance');
  const corrections=[];
  for(const g of m.groups){
    const [x0,y0,x1,y1]=g.source,[ox,oy]=g.dest;
    const adjustment=options.groupOffsets?.[g.id]??{x:0,y:0};
    assert(isInt(adjustment.x)&&isInt(adjustment.y)&&Math.abs(adjustment.x)<=12&&Math.abs(adjustment.y)<=12,'Group correction exceeds ±12px');
    let changed=0;
    for(let y=y0*s;y<y1*s;y++)for(let x=x0*s;x<x1*s;x++) {
      const src=(Math.floor(y/s)*source.width+Math.floor(x/s))*4;
      if(source.data[src+3]===0)continue;
      const px=(ox*s+x-x0*s),py=(oy*s+y-y0*s);
      const xx=px+gx+adjustment.x, yy=py+gy+adjustment.y;
      const di=(y*output.width+x)*4;
      if(xx<0||yy<0||xx>=generated.width||yy>=generated.height){clipped++;continue;}
      let si=(yy*generated.width+xx)*4;
      if(magentaAt(generated.data,si)&&nearTransparent(plan,px,py,band)){
        bleed++;
        if(options.repairMagenta!==false){
          let best=Infinity,found=-1;
          for(let ry=-radius;ry<=radius;ry++)for(let rx=-radius;rx<=radius;rx++){
            const dist=rx*rx+ry*ry;if(!dist||dist>radius*radius||dist>=best)continue;
            const tx=xx+rx,ty=yy+ry;
            if(tx<0||ty<0||tx>=generated.width||ty>=generated.height)continue;
            const nativeX=Math.floor((px+rx)/s),nativeY=Math.floor((py+ry)/s);
            if(nativeX<ox||nativeX>=ox+(x1-x0)||nativeY<oy||nativeY>=oy+(y1-y0))continue;
            if(!sampleInside(plan,px+rx,py+ry))continue;
            const test=(ty*generated.width+tx)*4;
            if(magentaAt(generated.data,test))continue;
            best=dist;found=test;
          }
          if(found>=0){si=found;repaired++;changed++;}else unresolved++;
        }
      }
      for(let c=0;c<3;c++)d[di+c]=generated.data[si+c];
    }
    corrections.push({id:g.id,magentaRepaired:changed});
  }
  return {image:output,report:{status:'needs_3d_validation',sourceSize:m.source_size,generatedSize:[generated.width,generated.height],restoredSize:[output.width,output.height],gridRegistration:auto,appliedShiftPx:{x:gx,y:gy},borderMagentaCandidates:bleed,borderMagentaRepaired:repaired,borderMagentaUnresolved:unresolved,clippedSamples:clipped,groupRepairs:corrections,originalAlphaForced:true,rawGeneratedGeometryIoU:'not measured',warning:'Forced original alpha and exact inverse mapping do not prove generated geometry or correct 3D face semantics.'}};
}
