import {chromium} from 'playwright';
import fs from 'node:fs/promises';
const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
const out='artifacts/mobile-ui';
await fs.mkdir(out,{recursive:true});
const page=await browser.newPage({viewport:{width:390,height:844},deviceScaleFactor:1,isMobile:true,hasTouch:true});
const errors=[];
page.on('pageerror',e=>errors.push(String(e)));
await page.goto('http://127.0.0.1:8765/index.html',{waitUntil:'domcontentloaded'});
await page.locator('#grid .card').first().waitFor({timeout:30000});
await page.locator('#grid .card').first().click();
await page.locator('#sheet.open .mtsTileCycle').waitFor({timeout:20000});
await page.screenshot({path:out+'/01-single.png'});
async function verify(label){
 const result=await page.evaluate(()=>{
  const row=document.querySelector('#sheet .drawer>.tileTools');
  const cycle=document.querySelector('.mtsTileCycle');
  const icons=[...document.querySelectorAll('#compactToolRail>.compactToolOrb')];
  const frame=document.querySelector('#sheet .preview');
  const r=row.getBoundingClientRect(),c=cycle.getBoundingClientRect();
  const rects=icons.map(x=>x.getBoundingClientRect());
  const fr=frame.getBoundingClientRect();
  return {viewport:innerWidth,row:[r.x,r.y,r.width,r.height],cycle:[c.x,c.y,c.width],icons:rects.map(x=>[x.x,x.y,x.width,x.height]),frame:[fr.x,fr.y,fr.width,fr.height],scrollWidth:document.documentElement.scrollWidth};
 });
 if(result.icons.length!==3)throw Error(label+': expected 3 preview tools, found '+result.icons.length);
 if(result.scrollWidth>390)throw Error(label+': horizontal document overflow '+result.scrollWidth);
 const [rx,ry,rw,rh]=result.row;
 if(rw>390||rh>62)throw Error(label+': oversized tile toolbar '+JSON.stringify(result));
 for(const [x,y,w,h] of result.icons){
  if(x<0||x+w>390||y<ry-3||y+h>ry+rh+3)throw Error(label+': tool outside toolbar '+JSON.stringify(result));
 }
 return result;
}
const first=await verify('1x1');
await page.locator('.mtsTileCycle').click();
await page.screenshot({path:out+'/02-three-by-three.png'});
const second=await verify('3x3');
await page.locator('.mtsTileCycle').click();
await page.locator('.mtsTileCycle').click();
await page.screenshot({path:out+'/03-nine-by-nine.png'});
const third=await verify('9x9');
if(Math.abs(first.row[1]-second.row[1])>3||Math.abs(first.row[1]-third.row[1])>3)throw Error('Tile toolbar moves vertically between preview sizes');
if(errors.length)throw Error('Browser JS errors: '+errors.join(' | '));
console.log('PASS mobile UI visual geometry',JSON.stringify({first,second,third}));
await browser.close();
