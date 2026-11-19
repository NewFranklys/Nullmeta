/* Bolso Bravo – zero frameworks, mascote responsivo e sync bancária opcional. */
const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => Array.from(document.querySelectorAll(sel));
const fmt = (cents) => new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(cents / 100);
const displayMonth = (s) => { const [y,m]=s.split('-').map(Number); const name=new Intl.DateTimeFormat('pt-BR',{month:'long',year:'numeric'}).format(new Date(y,m-1,1));return name[0].toUpperCase()+name.slice(1); };
const escapeHtml = (s) => String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const icons = {'Delivery':'♨','Jogos':'◈','Transporte':'↗','Assinaturas':'◉','Mercado':'▦','Saúde':'✚','Moradia':'⌂','Compras':'▧','Salário':'↙','Entrada':'↙','Revisar':'?','Transferência':'⇄','Outros':'•'};
const categoryOptions = ['Delivery','Jogos','Transporte','Assinaturas','Mercado','Saúde','Moradia','Compras','Transferência','Outros','Salário','Entrada'];
const today = new Date();
const S = {month:`${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,'0')}`, data:null, tab:'home'};
let toastTimer;
function toast(msg){const el=$('#toast');el.textContent=msg;el.classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>el.classList.remove('show'),4200);}
async function api(path, method='GET', body){const res=await fetch(path,{method,headers:{'Content-Type':'application/json'},body:body===undefined?undefined:JSON.stringify(body),cache:'no-store'});let j={};try{j=await res.json();}catch{}if(!res.ok)throw Error(j.detail||`Erro HTTP ${res.status}`);return j;}
async function load(){try{S.data=await api(`/api/state?month=${S.month}`);render();}catch(e){toast(e.message);}}
function changeMonth(delta){const [y,m]=S.month.split('-').map(Number);const d=new Date(y,m-1+delta,1);S.month=`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;load();}
function tab(name){S.tab=name;$$('.view').forEach(e=>e.classList.toggle('active',e.id===`view-${name}`));$$('[data-tab]').forEach(e=>e.classList.toggle('active',e.dataset.tab===name));window.scrollTo({top:0,behavior:'smooth'});}
function labelMood(mood){return {neutral:'● OBSERVANDO',angry:'● INDIGNADO',happy:'● SATISFEITO',suspicious:'● DESCONFIADO'}[mood]||'● OBSERVANDO';}
function say(text,mood='neutral'){const mascot=$('#mascot');mascot.className=`mascot mood-${mood}`;$('#mascot-says').textContent=text;$('#mood-label').textContent=labelMood(mood);}
function render(){const {stats,transactions,connections,source,tone,bank_configured}=S.data;
  $('#month-name').textContent=displayMonth(S.month);
  $('#spent').textContent=fmt(stats.spent_cents);$('#budget').textContent=fmt(stats.budget_cents);$('#remaining').textContent=fmt(stats.remaining_cents);$('#income').textContent=fmt(stats.income_cents);$('#percent').textContent=`${stats.percent}%`;
  $('#progress-fill').style.width=`${Math.min(stats.percent,100)}%`;$('#progress-fill').classList.toggle('over',stats.percent>=100);$('#progressbar').setAttribute('aria-valuenow',Math.min(stats.percent,100));
  $('#source-pill').textContent=source==='demo'?'● DADOS DE EXEMPLO':'● DADOS BANCÁRIOS / MANUAIS';
  const connected=connections.length>0;$('#bank-top-text').textContent=connected?'Banco conectado':'Conectar banco';$('.bank-dot').classList.toggle('connected',connected);
  $('#budget-input').value=(stats.budget_cents/100).toFixed(2);$('#tone-input').value=tone;
  $('#bank-explanation').textContent=connected?'Banco vinculado. A sincronização funciona enquanto este servidor estiver ligado.':'Nenhum banco conectado. Todos os lançamentos de exemplo são fictícios.';
  $('#connections-list').innerHTML=connections.map(c=>`<div class="connection-row"><div><strong>${escapeHtml(c.label)}</strong><small>Status: ${escapeHtml(c.status)}${c.last_sync?' • Última atualização: '+escapeHtml(c.last_sync):''}</small></div><button data-unlink="${escapeHtml(c.item_id)}">Desconectar</button></div>`).join('');
  const list=transactions.map(renderTransaction).join('')||'<div class="empty-message">Ainda não tem movimentações neste mês.</div>';
  $('#transactions-preview').innerHTML=transactions.slice(0,5).map(renderTransaction).join('')||'<div class="empty-message">Nada por aqui. Será que é milagre?</div>';
  $('#transactions-full').innerHTML=list;$('#transactions-count').textContent=`${transactions.length} movimentações em ${displayMonth(S.month)}`;
  const max=Math.max(1,...stats.categories.map(x=>x.value_cents));
  $('#category-list').innerHTML=stats.categories.slice(0,5).map(c=>`<div class="category-entry"><div class="cat-icon">${icons[c.name]||'•'}</div><div class="cat-main"><div class="cat-main-top"><span>${escapeHtml(c.name)}</span><span>${fmt(c.value_cents)}</span></div><div class="cat-main-track"><div class="cat-main-fill" style="width:${Math.round(100*c.value_cents/max)}%"></div></div></div></div>`).join('')||'<div class="empty-message">Nenhum suspeito ainda.</div>';
  if(!bank_configured)$('#connect-settings').textContent='Configurar Pluggy primeiro ↗';else $('#connect-settings').textContent='Conectar via Open Finance ↗';
  const unknown=transactions.find(x=>x.needs_review);
  if(unknown) say(`EI. TEM ${stats.review_count} GASTO${stats.review_count>1?'S':''} QUE EU NÃO ENTENDI. “${unknown.description}” FOI O QUÊ?`,'suspicious');
  else if(stats.spent_cents>stats.budget_cents) say('PARABÉNS. VOCÊ CONSEGUIU GASTAR MAIS DO QUE TINHA PROMETIDO. UM TALENTO CARÍSSIMO.','angry');
  else if(transactions.length===0) say('SEM MOVIMENTAÇÕES. VOCÊ TÁ ECONOMIZANDO OU ESCONDENDO OS CORPOS?','suspicious');
  else say('EU VI SEU EXTRATO. TENHO PERGUNTAS. MUITAS PERGUNTAS.','neutral');
}
function renderTransaction(t){const positive=t.amount_cents>0;return `<div class="transaction" role="button" tabindex="0" data-tx="${escapeHtml(t.id)}"><div class="transaction-icon">${icons[t.category]||'•'}</div><div class="transaction-info"><div class="transaction-name">${escapeHtml(t.description)}${t.needs_review?'<span class="review-pill">?</span>':''}</div><div class="transaction-sub">${escapeHtml(t.category)} · ${formatDay(t.date)}${t.source==='demo'?' · exemplo':''}</div></div><div class="transaction-price ${positive?'positive':''}">${positive?'+':'−'} ${fmt(Math.abs(t.amount_cents))}</div></div>`;}
function formatDay(s){const [y,m,d]=s.split('-');return `${d}/${m}`;}
async function judgeTransaction(id){try{const query=new URLSearchParams({month:S.month});if(id)query.set('transaction_id',id);const result=await api(`/api/judge?${query}`);say(result.text,result.mood);$('#mascot-stage').scrollIntoView({block:'nearest',behavior:'smooth'});}catch(e){toast(e.message);}}
async function transactionClick(target){const id=target.closest('[data-tx]')?.dataset.tx;if(!id||!S.data)return;const tx=S.data.transactions.find(t=>t.id===id);if(!tx)return;await judgeTransaction(id);if(tx.needs_review){const chosen=window.prompt(`Não reconheci “${tx.description}”.\nQual categoria?\n${categoryOptions.join(', ')}`,'Outros');if(chosen===null)return;const category=categoryOptions.find(x=>x.toLowerCase()===chosen.trim().toLowerCase());if(!category){toast('Categoria inválida. Use uma da lista.');return;}try{await api(`/api/transactions/${encodeURIComponent(id)}/category`,'PATCH',{category});toast('Categorizado! Agora consigo te julgar direito.');await load();await judgeTransaction(id);}catch(e){toast(e.message);}}}
async function connectBank(){if(!S.data?.bank_configured){tab('settings');toast('Primeiro preencha o arquivo .env com suas credenciais da Pluggy.');return;}try{toast('Abrindo conexão bancária segura...');const {accessToken}=await api('/api/pluggy/token','POST');if(!accessToken)throw Error('A Pluggy não retornou um Connect Token.');await addPluggyScript();const widget=new window.PluggyConnect({connectToken:accessToken,language:'pt',countries:['BR'],includeSandbox:true,onSuccess:async ({item})=>{try{await api('/api/pluggy/link','POST',{item_id:item.id});toast('Banco vinculado! Buscando suas movimentações...');await load();await syncBank();}catch(e){toast(e.message);}},onError:({message})=>toast(message||'Não consegui conectar o banco.')});widget.init();}catch(e){toast(e.message);}}
function addPluggyScript(){if(window.PluggyConnect)return Promise.resolve();return new Promise((resolve,reject)=>{const s=document.createElement('script');s.src='https://cdn.pluggy.ai/pluggy-connect/v2.8.2/pluggy-connect.js';s.onload=()=>window.PluggyConnect?resolve():reject(new Error('Widget bancário indisponível.'));s.onerror=()=>reject(new Error('Não foi possível carregar o widget Pluggy.'));document.head.appendChild(s);});}
async function syncBank(){if(!S.data?.connections.length){toast('Conecte um banco primeiro.');return;}const btn=$('#sync-home');btn.disabled=true;try{const result=await api('/api/pluggy/sync','POST');await load();const count=result.results.reduce((a,b)=>a+b.imported,0);const waiting=result.results.some(r=>r.status?.toUpperCase()!=='UPDATED');toast(waiting?'Conexão ainda processando. Tente sincronizar mais tarde.':`${count} movimentações consultadas. Nada passa despercebido.`);}catch(e){toast(e.message);}finally{btn.disabled=false;}}
async function unlink(itemId){if(!window.confirm('Desconectar este banco? O app pedirá exclusão do vínculo na Pluggy e apagará as transações dele deste computador.'))return;try{await api(`/api/pluggy/connections/${encodeURIComponent(itemId)}`,'DELETE');toast('Banco desconectado, transações locais removidas.');await load();}catch(e){toast(e.message);}}
function setup(){ $$('#prev-month,#next-month').forEach(e=>e.addEventListener('click',()=>changeMonth(e.id==='prev-month'?-1:1)));
  $$('[data-tab]').forEach(e=>e.addEventListener('click',()=>tab(e.dataset.tab)));
  $('#judge-button').addEventListener('click',()=>judgeTransaction());$('#view-all').addEventListener('click',()=>tab('transactions'));
  $('#edit-budget').addEventListener('click',()=>{tab('settings');$('#budget-input').focus();});
  $('#bank-top').addEventListener('click',connectBank);$('#connect-settings').addEventListener('click',connectBank);
  $('#sync-home').addEventListener('click',syncBank);$('#sync-settings').addEventListener('click',syncBank);
  $('#save-settings').addEventListener('click',async()=>{try{await api('/api/settings','POST',{budget:Number($('#budget-input').value),tone:$('#tone-input').value});toast('Salvo. O juiz já sabe seu limite.');await load();}catch(e){toast(e.message);}});
  $('#add-button').addEventListener('click',()=>{$('#modal').hidden=false;$('#transaction-desc').focus();});$('#close-modal').addEventListener('click',()=>$('#modal').hidden=true);$('#modal').addEventListener('click',(e)=>{if(e.target.id==='modal')$('#modal').hidden=true;});
  $('#transaction-form').addEventListener('submit',async(e)=>{e.preventDefault();try{const desc=$('#transaction-desc').value,amount=Number($('#transaction-amount').value),direction=$('#transaction-direction').value;await api('/api/transactions','POST',{description:desc,amount,direction});$('#modal').hidden=true;e.target.reset();await load();await judgeTransaction();toast('Movimentação de teste registrada.');}catch(err){toast(err.message);}});
  document.body.addEventListener('click',e=>{if(e.target.closest('[data-unlink]'))unlink(e.target.closest('[data-unlink]').dataset.unlink);else if(e.target.closest('[data-tx]'))transactionClick(e.target);});
  document.body.addEventListener('keydown',e=>{if(e.key==='Enter'&&e.target.closest('[data-tx]'))transactionClick(e.target);if(e.key==='Escape')$('#modal').hidden=true;});
  load();
  // Não faz polling em banco se não houver vínculo; o backend agenda sync a cada hora.
  setInterval(()=>{if(document.visibilityState==='visible')load();},60000);
}
setup();
