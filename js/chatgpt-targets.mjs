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
 const stageSelect=document.createElement('select');stageSelect.className='select';stageSelect.setAttribute('aria-label','Prompt aşaması');for(const [id,label] of STAGES){const option=document.createElement('option');option.value=id;option.textContent=label;stageSelect.append(option)}box.append(stageSelect);
 window.addEventListener('mts:chat-stage',event=>{const stage=event.detail?.stage;if(STAGES.some(([id])=>id===stage))stageSelect.value=stage});
 const legacyButtons=[['mobHqPrompt','mob_hq'],['mobRefPrompt','mob_ref'],['mobFinalPrompt','mob_final'],['copyPrompt',null],['savePrompt',null]];
 for(const [id,stage] of legacyButtons){const button=document.getElementById(id);if(button&&stage)button.addEventListener('click',()=>{stageSelect.value=stage})}
 const actions=document.createElement('div');actions.className='mts-chat-actions';actions.innerHTML='<button type="button" class="btn">Promptu kopyala</button><button type="button" class="btn primary">ChatGPT\'de aç</button>';
 const [copyButton,openButton]=actions.querySelectorAll('button');
 async function act(open){
  const p=getPrompt(stageSelect.value);if(!p?.text){notify('Bu aşamada prompt yok');return}
  if(!open){notify(await copy(p.text)?'Prompt kopyalandı':'Kopyalama başarısız');return}
  const id=load()[p.stage];if(!id){notify('Önce bu aşama için sohbet ID kaydedin');settings.querySelector('details').open=true;fields.querySelector('[data-stage="'+p.stage+'"]')?.focus();return}
  const base='https://chatgpt.com/c/'+id;
  const url=base+'?q='+encodeURIComponent(p.text);
  const long=url.length>7500;
  const tab=window.open(long?base:url,'_blank','noopener');
  const copied=await copy(p.text);
  if(!tab)notify('Tarayıcı yeni sekmeyi engelledi; prompt '+(copied?'panoya kopyalandı':'kopyalanamadı'));
  else notify(long?'Uzun prompt panoya kopyalandı; sohbete yapıştırın':'Hedef sohbet açıldı; prompt da panoya kopyalandı');
 }
 copyButton.addEventListener('click',()=>act(false));openButton.addEventListener('click',()=>act(true));
 box.append(settings,actions);
}
