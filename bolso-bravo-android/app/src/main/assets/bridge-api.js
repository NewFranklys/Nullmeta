/* Bolso Bravo Android - modo offline local + servidor HTTPS autenticado opcional.
   Sem coleta oculta, sem segredos bancários, sem chamadas a terceiros em modo offline. */
(()=>{'use strict';
 const stateKey='bolso-bravo-phone-v2',serverKey='bolso-bravo-secure-server-v1';
 const nativeFetch=window.fetch.bind(window);
 const samples=[['iFood • Lanche da madrugada',-8790],['Steam • promoção imperdível',-14990],['Uber • viagem',-2430],['Netflix',-4490],['Mercado do bairro',-16380],['PIX enviado • desconhecido',-7500],['Salário',280000],['iFood • almoço',-5290],['Farmácia',-3270],['Spotify',-2190],['PIX recebido • amigo',4500],['Amazon • compra',-11600]];
 const categories=['Delivery','Jogos','Transporte','Assinaturas','Mercado','Saúde','Moradia','Compras','Transferência','Outros','Salário','Entrada'];
 const today=()=>new Date().toISOString().slice(0,10);
 function category(desc,amount){const d=desc.toLocaleLowerCase('pt-BR');
  if(/pagamento.*fatura|transfer.ncia entre contas|pagamento de cart.o/.test(d))return ['Transferência',false];
  if(amount>0)return [/sal.rio|remunera|provento/.test(d)?'Salário':'Entrada',false];
  const rules=[['Delivery',/ifood|rappi|delivery|pizza|mcdonald|burger king/],['Jogos',/steam|epic games|playstation|psn|nintendo|xbox|riot games/],['Transporte',/uber|99pop|99 app|metr.|combust.vel|posto /],['Assinaturas',/netflix|spotify|disney|youtube premium|prime video|crunchyroll/],['Mercado',/mercado|supermercado|carrefour|assai|atacad.o/],['Saúde',/farm.cia|drogaria|hospital|consulta/],['Moradia',/aluguel|enel|energia|condom.nio|sabesp/],['Compras',/amazon|mercado livre|shopee|shein|magalu/]];
  const found=rules.find(x=>x[1].test(d));return found?[found[0],false]:['Revisar',true];
 }
 function initial(){const d=today(),day=Number(d.slice(-2));return {budget_cents:180000,tone:'sem-piedade',transactions:samples.map(([description,amount_cents],i)=>{const dayOfMonth=Math.max(1,day-(i*2)%Math.max(1,day));const c=category(description,amount_cents);return {id:'demo:'+i,description,amount_cents,category:c[0],needs_review:c[1],source:'demo',date:d.slice(0,8)+String(dayOfMonth).padStart(2,'0')};})};}
 function load(){try{const obj=JSON.parse(localStorage.getItem(stateKey));return obj&&Array.isArray(obj.transactions)?obj:initial();}catch{return initial();}}
 function save(db){localStorage.setItem(stateKey,JSON.stringify(db));}
 function server(){try{return JSON.parse(localStorage.getItem(serverKey));}catch{return null;}}
 function validateServer(url,token){let u;try{u=new URL(url)}catch{throw Error('Informe uma URL válida.')}
  if(u.protocol!=='https:'||u.username||u.password||u.search||u.hash||u.pathname!=='/')throw Error('Use somente endereço HTTPS sem caminho, senha ou parâmetros.');
  if(!token||token.length<32)throw Error('O token de acesso deve ter pelo menos 32 caracteres.');
  return {url:u.origin,token};
 }
 function summary(rows,budget,month){const eligible=rows.filter(x=>x.category!=='Transferência');const spent=eligible.reduce((a,x)=>a+Math.max(0,-x.amount_cents),0),income=eligible.reduce((a,x)=>a+Math.max(0,x.amount_cents),0);const sums={};
  eligible.filter(x=>x.amount_cents<0).forEach(x=>sums[x.category]=(sums[x.category]||0)-x.amount_cents);
  return {month,spent_cents:spent,income_cents:income,budget_cents:budget,remaining_cents:budget-spent,percent:budget?Math.round(spent*100/budget):0,categories:Object.entries(sums).sort((a,b)=>b[1]-a[1]).map(([name,value_cents])=>({name,value_cents})),review_count:rows.filter(x=>x.needs_review).length};
 }
 function judge(tx,rows,tone){if(!tx)return {text:'NENHUM GASTO PRA JULGAR. VOCÊ VIROU UM MONGE?',mood:'suspicious'};
  const cat=tx.category,n=rows.filter(x=>x.category===cat&&x.amount_cents<0).length,amount=new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(Math.abs(tx.amount_cents)/100);
  if(tx.needs_review)return {text:`${amount} EM “${tx.description}”. QUE PORRA FOI ISSO? ME DIZ A CATEGORIA.`,mood:'suspicious'};
  if(tx.amount_cents>0)return {text:`ENTROU ${amount}! VAMOS VER QUANTO TEMPO VOCÊ CONSEGUE NÃO GASTAR.`,mood:'happy'};
  if(tone==='leve')return {text:`${amount} EM ${cat.toUpperCase()}? EU VI, VIU.`,mood:'suspicious'};
  let msg=({'Delivery':n>1?'VOCÊ TÁ FINANCIANDO UMA COZINHA INDUSTRIAL PELO IFOOD?':'TUA CASA NÃO TEM FOGÃO, DESGRAÇA?', 'Jogos':'OUTRO JOGO? VOCÊ JOGA OU SÓ COLECIONA ÍCONE NA STEAM?', 'Assinaturas':'MAIS UMA ASSINATURA. VOCÊ USA OU PATROCINA?', 'Compras':'ERA NECESSIDADE OU O BOTÃO DE COMPRAR TE HIPNOTIZOU?', 'Transporte':'O SALDO NÃO GANHA CARONA DE VOLTA.', 'Mercado':'MERCADO EU ACEITO. MILAGRE, UMA COMPRA ÚTIL.', 'Saúde':'SAÚDE NÃO É LUXO. ESSA PASSA.', 'Moradia':'CONTA PAGA. O BÁSICO DA VIDA ADULTA.'})[cat]||`VOCÊ TORROU ${amount} E ACHOU QUE EU NÃO IA VER?`;
  if(tone==='ácido')msg=msg.replace('DESGRAÇA','CRIATURA');if(n>=3&&!['Saúde','Moradia','Mercado'].includes(cat))msg+=` JÁ FORAM ${n} VEZES NESSA CATEGORIA!`;
  return {text:msg,mood:['Mercado','Saúde'].includes(cat)?'happy':'angry'};
 }
 function jResponse(body,status=200){return new Response(JSON.stringify(body),{status,headers:{'Content-Type':'application/json'}})}
 async function offlineApi(path,opts){const url=new URL(path,'https://offline.invalid'),db=load(),method=(opts?.method||'GET').toUpperCase();let body={};try{if(opts?.body)body=JSON.parse(opts.body)}catch{return jResponse({detail:'JSON inválido'},400)}
  const month=url.searchParams.get('month')||today().slice(0,7);
  const rows=db.transactions.filter(x=>x.date.slice(0,7)===month).sort((a,b)=>b.date.localeCompare(a.date));
  if(url.pathname==='/api/state'&&method==='GET')return jResponse({transactions:rows,stats:summary(rows,db.budget_cents,month),tone:db.tone,connections:[],source:'demo',bank_configured:false});
  if(url.pathname==='/api/settings'&&method==='POST'){if(!Number.isFinite(Number(body.budget))||Number(body.budget)<0||!['leve','ácido','sem-piedade'].includes(body.tone))return jResponse({detail:'Orçamento ou tom inválido'},400);db.budget_cents=Math.round(body.budget*100);db.tone=body.tone;save(db);return jResponse({ok:true});}
  if(url.pathname==='/api/judge'&&method==='GET'){const id=url.searchParams.get('transaction_id'),tx=id?rows.find(x=>x.id===id):rows.find(x=>x.needs_review)||rows.find(x=>x.amount_cents<0);return jResponse(judge(tx,rows,db.tone));}
  if(url.pathname==='/api/transactions'&&method==='POST'){const amount=Math.round(Number(body.amount)*100),description=String(body.description||'').trim();if(!description||!Number.isFinite(amount)||amount<=0)return jResponse({detail:'Descrição e valor são obrigatórios'},400);
   const value=body.direction==='credit'?amount:-amount,c=category(description,value);db.transactions.unshift({id:'manual:'+String(Date.now())+'-'+Math.random().toString(36).slice(2),source:'manual',description,date:today(),amount_cents:value,category:c[0],needs_review:c[1]});save(db);return jResponse({ok:true});}
  const catPath=url.pathname.match(/^\/api\/transactions\/(.+)\/category$/);if(catPath&&method==='PATCH'){const row=db.transactions.find(x=>x.id===decodeURIComponent(catPath[1]));if(!row)return jResponse({detail:'Transação não encontrada'},404);if(!categories.includes(body.category))return jResponse({detail:'Categoria inválida'},400);row.category=body.category;row.needs_review=false;save(db);return jResponse({ok:true});}
  if(url.pathname.startsWith('/api/pluggy/'))return jResponse({detail:'Conexão bancária real requer um servidor HTTPS privado com Pluggy. Configure na aba Ajustes.'},503);
  return jResponse({detail:'Operação não disponível no modo offline'},404);
 }
 window.fetch=async function(path,opts){if(typeof path!=='string'||!path.startsWith('/api/'))return nativeFetch(path,opts);
  const cfg=server();if(!cfg)return offlineApi(path,opts);
  const headers=new Headers(opts?.headers||{});headers.set('Authorization','Bearer '+cfg.token);
  return nativeFetch(cfg.url+path,{...opts,headers,mode:'cors',credentials:'omit',redirect:'error'});
 };
 window.BolsoBridge={server,setup(url,token){const cfg=validateServer(url.trim(),token.trim());localStorage.setItem(serverKey,JSON.stringify(cfg));return cfg;},clear(){localStorage.removeItem(serverKey);},isOffline(){return !server();}};
 window.addEventListener('DOMContentLoaded',()=>{const cfg=server(),url=document.querySelector('#server-url'),token=document.querySelector('#server-token'),status=document.querySelector('#server-status');if(url)url.value=cfg?.url||'';
  if(status)status.textContent=cfg?'Servidor externo ativo. Dados bancários só via HTTPS autenticado.':'Modo offline: extrato fictício armazenado neste aparelho.';
  document.querySelector('#save-server')?.addEventListener('click',()=>{try{window.BolsoBridge.setup(url.value,token.value);location.reload();}catch(e){status.textContent=e.message}});
  document.querySelector('#clear-server')?.addEventListener('click',()=>{window.BolsoBridge.clear();location.reload()});
 });
})();
