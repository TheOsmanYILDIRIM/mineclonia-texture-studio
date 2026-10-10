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
 const actions=document.createElement('div');actions.className='mts-chat-actions';actions.innerHTML='<button type="button" class="btn">Promptu kopyala</button><button type="button" class="btn primary">ChatGPT\'de aç</button>';
 const [copyButton,openButton]=actions.querySelectorAll('button');
 async function act(open){const p=getPrompt();if(!p?.text){notify('Bu aşamada prompt yok');return}const copied=await copy(p.text);if(!open){notify(copied?'Prompt kopyalandı':'Kopyalama başarısız');return}const id=load()[p.stage];if(!id){notify('Önce bu aşama için sohbet ID kaydedin');settings.querySelector('details').open=true;fields.querySelector('[data-stage="'+p.stage+'"]')?.focus();return}const url='https://chatgpt.com/c/'+id+'?q='+encodeURIComponent(p.text);if(url.length>7500){notify('Prompt URL için çok uzun; panoya kopyalandı, sohbete yapıştırın');window.open('https://chatgpt.com/c/'+id,'_blank','noopener');return}window.open(url,'_blank','noopener');notify(copied?'Prompt kopyalandı; hedef sohbet açılıyor':'Hedef sohbet açılıyor')}
 copyButton.addEventListener('click',()=>act(false));openButton.addEventListener('click',()=>act(true));
 box.append(settings,actions);
}
