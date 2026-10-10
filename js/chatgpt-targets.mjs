const KEY='mts:chatTargets:v1';
const STAGES=[['block_ref','Block · Referans'],['block_production','Block · Üretim'],['item_creative','Item · Creative'],['item_correction','Item · A+B Correction'],['mob_hq','Mob/Armor · HQ UV'],['mob_ref','Mob/Armor · Referans'],['mob_final','Mob/Armor · Final UV'],['general','Diğer · Prompt']];
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function parseId(value){const v=String(value||'').trim();const m=v.match(/(?:chatgpt\.com\/c\/)?([0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12})/i);return m&&UUID.test(m[1])?m[1]:''}
function load(){try{return JSON.parse(localStorage.getItem(KEY)||'{}')}catch{return {}}}
function save(map){try{localStorage.setItem(KEY,JSON.stringify(map));return true}catch{return false}}
async function copy(text){try{await navigator.clipboard.writeText(text);return true}catch{const t=document.createElement('textarea');t.value=text;document.body.append(t);t.select();const ok=document.execCommand('copy');t.remove();return ok}}
export function installChatTargets({getPrompt,notify}){
 const box=document.querySelector('.promptBox');if(!box)return;
 const settings=document.createElement('section');settings.className='mts-chat-settings';
 settings.innerHTML='<details><summary>ChatGPT sohbet hedefleri · Ayarlar</summary><div class="mts-chat-fields"></div><small>Her aşama için ayrı sohbet ID veya chatgpt.com/c/ bağlantısı. Yalnızca bu tarayıcıda saklanır.</small></details>';
 const fields=settings.querySelector('.mts-chat-fields');
 for(const [id,label] of STAGES){const row=document.createElement('label');row.textContent=label;const input=document.createElement('input');input.type='text';input.autocomplete='off';input.placeholder='Sohbet ID veya URL';input.value=load()[id]||'';input.dataset.stage=id;input.addEventListener('change',()=>{const raw=input.value.trim(),parsed=parseId(raw);if(raw&&!parsed){input.setCustomValidity('Geçerli sohbet ID girin');input.reportValidity();return}input.setCustomValidity('');const data=load();if(parsed)data[id]=parsed;else delete data[id];if(!save(data))notify('Sohbet hedefi kaydedilemedi');else notify('Sohbet hedefi kaydedildi');input.value=parsed});row.append(input);fields.append(row)}

 const toggleLabel=document.createElement('label');toggleLabel.className='mts-chat-toggle';
 const toggle=document.createElement('input');toggle.type='checkbox';toggle.checked=localStorage.getItem('mts:chatAutoOpen:v1')==='1';
 const toggleText=document.createElement('span');toggleText.textContent='Prompta dokununca ChatGPT sohbetini aç';
 toggleLabel.append(toggle,toggleText);
 toggle.addEventListener('change',()=>{try{localStorage.setItem('mts:chatAutoOpen:v1',toggle.checked?'1':'0')}catch{notify('Tercih kaydedilemedi')}});
 settings.append(toggleLabel);
 box.append(settings);
 let activeStage='general';
 window.addEventListener('mts:chat-stage',event=>{if(STAGES.some(([id])=>id===event.detail?.stage))activeStage=event.detail.stage});
 const mapping={mobHqPrompt:'mob_hq',mobRefPrompt:'mob_ref',mobFinalPrompt:'mob_final'};
 const buttons=['mobHqPrompt','mobRefPrompt','mobFinalPrompt','copyPrompt','savePrompt'];
 for(const buttonId of buttons){
  const button=document.getElementById(buttonId);if(!button)continue;
  button.addEventListener('click',()=>{
   if(!toggle.checked)return;
   const stage=mapping[buttonId]||(buttonId==='savePrompt'?(activeStage==='item_creative'?'item_correction':activeStage==='block_ref'?'block_production':null):activeStage);
   if(!stage)return; // "Kaydet" for general prompts must retain its original behavior.
   const p=getPrompt(stage);if(!p?.text)return;
   const id=load()[stage];if(!id){notify('Bu aşama için ChatGPT sohbet ID kaydedin');settings.querySelector('details').open=true;return}
   const base='https://chatgpt.com/c/'+id;
   const full=base+'?q='+encodeURIComponent(p.text);
   // Capture phase opens synchronously in the user's click; original clipboard handler still runs.
   window.open(full.length<=7500?full:base,'_blank','noopener');
   if(full.length>7500)notify('Uzun prompt kopyalandı; hedef sohbete yapıştırın');
  },{capture:true});
 }
}
