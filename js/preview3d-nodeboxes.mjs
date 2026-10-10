// Source-backed Mineclonia nodebox preview. No guessing for unknown assets.
export function nodeboxKind(profile,meta) {
  const node=String(profile?.node||'').toLowerCase();
  const texture=String(meta?.name||'').toLowerCase().replace(/\.png$/,'');
  const id=node||texture;
  if(/fence_gate/.test(id))return /(?:_open|_opened)$/.test(id)?'fence_gate_open':'fence_gate_closed';
  if(/(?:^|[:_])fence(?:_|$)/.test(id))return 'fence';
  if(/(?:^|[:_])stair(?:_|$)/.test(id))return 'stair';
  if(/(?:^|[:_])slab(?:_|$)/.test(id))return /(?:_top|_upper)$/.test(id)?'slab_top':'slab_bottom';
  if(/(?:^|[:_])door(?:_|$)/.test(id))return 'door_half';
  return null;
}
export function nodeboxMesh(def,connections=[]) {
  if(!def||!Array.isArray(def.fixed))return null;
  const boxes=[...def.fixed];
  if(def.type==='connected')for(const side of connections)
    if(['front','back','left','right'].includes(side))
      boxes.push(...(def['connect_'+side]||[]));
  const positions=[],uv=[],indices=[];
  for(const box of boxes){
    if(!Array.isArray(box)||box.length!==6||box.some(v=>!Number.isFinite(v)))continue;
    const [x0,y0,z0,x1,y1,z1]=box;
    if(x1<=x0||y1<=y0||z1<=z0)continue;
    const faces=[
      [x0,y0,z1,x1,y0,z1,x1,y1,z1,x0,y1,z1],
      [x1,y0,z0,x0,y0,z0,x0,y1,z0,x1,y1,z0],
      [x1,y0,z1,x1,y0,z0,x1,y1,z0,x1,y1,z1],
      [x0,y0,z0,x0,y0,z1,x0,y1,z1,x0,y1,z0],
      [x0,y1,z1,x1,y1,z1,x1,y1,z0,x0,y1,z0],
      [x0,y0,z0,x1,y0,z0,x1,y0,z1,x0,y0,z1]
    ];
    for(let f=0;f<6;f++){
      const start=positions.length/3;positions.push(...faces[f]);
      const col=f%3,row=Math.floor(f/3),u0=col/3,u1=(col+1)/3,v0=row/2,v1=(row+1)/2;
      uv.push(u0,v1,u1,v1,u1,v0,u0,v0);
      indices.push(start,start+1,start+2,start,start+2,start+3);
    }
  }
  return positions.length?{positions,uv,indices,boxes:boxes.length}:null;
}
