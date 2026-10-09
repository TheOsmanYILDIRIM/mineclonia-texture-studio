// Optional deep link from a Mineclonia texture's detail sheet to the UV generator.
const link=document.getElementById('detailUvGenerate');
link?.addEventListener('click',()=>{
  const path=document.getElementById('detailPath')?.textContent?.trim()||'';
  if(/^[\w.-]+\/[\w.-]+\/[\w.-]+\.png$/i.test(path))link.href='uv-generation.html?path='+encodeURIComponent(path);
  else link.href='uv-generation.html';
});
