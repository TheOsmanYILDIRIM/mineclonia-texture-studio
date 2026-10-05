async function canvasHasTransparency(canvas){
 const g=canvas.getContext('2d',{willReadFrequently:true});
 const d=g.getImageData(0,0,canvas.width,canvas.height).data;
 for(let i=3;i<d.length;i+=4)if(d[i]!==255)return true;
 return false;
}

async function sourceExpectsTransparency(meta){
 if(!meta?.path)return false;
 try{
  const source=await decodeBlobToCanvas(await originalBlob(meta.path));
  return await canvasHasTransparency(source);
 }catch(err){
  console.warn('Kaynak alpha kontrolü yapılamadı',meta?.path,err);
  return false;
 }
}

async function autoRemoveBorderBlackBackground(blob,meta){
 if(!blob||!meta)return blob;

 const canvas=await decodeBlobToCanvas(blob);
 if(await canvasHasTransparency(canvas))return blob;
 if(!(await sourceExpectsTransparency(meta)))return blob;

 const w=canvas.width,h=canvas.height;
 if(!w||!h)return blob;

 const g=canvas.getContext('2d',{willReadFrequently:true});
 const img=g.getImageData(0,0,w,h),d=img.data;
 const seen=new Uint8Array(w*h);
 const queue=new Int32Array(w*h);
 let head=0,tail=0,removed=0;

 const isPureBlack=index=>{
  const p=index*4;
  return d[p]===0&&d[p+1]===0&&d[p+2]===0&&d[p+3]===255;
 };
 const push=index=>{
  if(index<0||index>=w*h||seen[index]||!isPureBlack(index))return;
  seen[index]=1;
  queue[tail++]=index;
 };

 for(let x=0;x<w;x++){push(x);if(h>1)push((h-1)*w+x)}
 for(let y=1;y<h-1;y++){push(y*w);if(w>1)push(y*w+w-1)}

 while(head<tail){
  const index=queue[head++],p=index*4,x=index%w,y=(index/w)|0;
  d[p+3]=0;removed++;
  if(x>0)push(index-1);
  if(x+1<w)push(index+1);
  if(y>0)push(index-w);
  if(y+1<h)push(index+w);
 }

 if(!removed)return blob;
 g.putImageData(img,0,0);
 const out=await canvasPngBlob(canvas);
 console.info('Dış siyah arka plan temizlendi',meta.path,{removed,total:w*h});
 return out;
}
