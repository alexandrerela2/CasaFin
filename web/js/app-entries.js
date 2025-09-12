import { supa, requireAuth, signOutAndGoHome, getSessionTenant } from "../lib/supabase.js";

const $ = (q)=>document.querySelector(q);
const fmt = (n)=> (Number(n)||0).toLocaleString('pt-BR',{style:'currency',currency:'BRL'});

await requireAuth();
const { user, tenant } = await getSessionTenant();
$('#tenantName').textContent = `Tenant: ${tenant?.name ?? '—'}`;

if (tenant?.role === 'owner' || tenant?.role === 'admin') {
  document.getElementById('tabConfig').classList.remove('hide');
}
$('#btnSignOut').onclick = signOutAndGoHome;

// Tabs
const tabs = document.querySelectorAll('.tab');
tabs.forEach(t=>t.onclick = ()=>{
  tabs.forEach(x=>x.classList.remove('active'));
  t.classList.add('active');
  const id = t.dataset.tab;
  document.querySelectorAll('main > section').forEach(sec=>sec.style.display='none');
  document.getElementById('tab-'+id).style.display='grid';
  if(id==='dashboard') refresh();
  if(id==='receitas') loadIncome();
  if(id==='despesas') loadExpense();
});

// Período
function getPeriod(){
  const mode = $('#filterPeriod').value;
  const today = new Date(); let from, to;
  if(mode==='today'){ from=to=today; }
  else if(mode==='week'){
    const d = new Date(today); const day = d.getDay();
    const diff = (day===0?6:day-1);
    from = new Date(d); from.setDate(d.getDate()-diff);
    to = new Date(from); to.setDate(from.getDate()+6);
  }else if(mode==='month'){
    from = new Date(today.getFullYear(), today.getMonth(), 1);
    to   = new Date(today.getFullYear(), today.getMonth()+1, 0);
  }else{
    from = $('#filterFrom').value ? new Date($('#filterFrom').value) : today;
    to   = $('#filterTo').value   ? new Date($('#filterTo').value)   : today;
  }
  const f = from.toISOString().slice(0,10);
  const t = to.toISOString().slice(0,10);
  return {from:f, to:t};
}
$('#btnRefresh').onclick = refresh;

async function refresh(){
  const {from,to} = getPeriod();
  const { data, error } = await supa.from('entries')
    .select('id,date,type,category,description,amount')
    .eq('tenant_id', tenant.id)
    .gte('date', from).lte('date', to)
    .order('date', { ascending: false });
  if(error){ console.error(error); return; }

  const tbody = $('#tblEntries'); tbody.innerHTML = '';
  let si=0, se=0;
  for(const r of data){
    if(r.type==='income') si += Number(r.amount);
    if(r.type==='expense') se += Number(r.amount);
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${r.date}</td>
      <td>${r.type}</td>
      <td>${r.category||''}</td>
      <td>${r.description||''}</td>
      <td>${fmt(r.amount)}</td>
      <td><button class="btn" data-id="${r.id}">Excluir</button></td>
    `;
    tr.querySelector('button').onclick = ()=>delEntry(r.id);
    tbody.appendChild(tr);
  }
  $('#sumIncome').textContent = fmt(si);
  $('#sumExpense').textContent = fmt(se);
  $('#sumBalance').textContent = fmt(si-se);
}

async function delEntry(id){
  const { error } = await supa.from('entries').delete().eq('id', id).eq('tenant_id', tenant.id);
  if(error){ alert('Erro ao excluir: '+error.message); return; }
  refresh();
}

// Categorias -> selects
async function loadCategories(){
  const { data } = await supa.from('categories').select('id,kind,name,active')
    .eq('tenant_id', tenant.id).eq('active', true).order('kind').order('name');
  const inc = (data||[]).filter(c=>c.kind==='income');
  const exp = (data||[]).filter(c=>c.kind==='expense');
  fillSelect('#fCategory', inc.concat(exp));
  fillSelect('#riCategory', inc);
  fillSelect('#reCategory', exp);
}
function fillSelect(sel, arr){
  const el = document.querySelector(sel); if(!el) return; el.innerHTML='';
  for(const c of arr){
    const opt = document.createElement('option');
    opt.value = c.name; opt.textContent = `${c.kind==='income'?'[R]':'[D]'} ${c.name}`;
    el.appendChild(opt);
  }
}

// Criar lançamento (Dashboard)
$('#btnCreate').onclick = async ()=>{
  const date = $('#fDate').value;
  const type = $('#fType').value;
  const category = $('#fCategory').value || null;
  const description = $('#fDesc').value || null;
  const amount = Number($('#fAmount').value);
  if(!date || !type || !amount){ alert('Preencha data, tipo e valor.'); return; }
  const row = { tenant_id: tenant.id, date, type, category, description, amount, created_by: user.id };
  const { error } = await supa.from('entries').insert(row);
  if(error){ alert('Erro ao salvar: '+error.message); return; }
  $('#fAmount').value=''; $('#fDesc').value='';
  refresh();
};

// Receitas
async function loadIncome(){
  const { data } = await supa.from('entries')
    .select('id,date,category,description,amount')
    .eq('tenant_id', tenant.id).eq('type','income')
    .order('date',{ascending:false});
  const tbody = $('#tblIncome'); tbody.innerHTML='';
  for(const r of (data||[])){
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${r.date}</td><td>${r.category||''}</td><td>${r.description||''}</td>
      <td>${fmt(r.amount)}</td><td><button class="btn" data-id="${r.id}">Excluir</button></td>`;
    tr.querySelector('button').onclick = ()=>delEntry(r.id).then(loadIncome);
    tbody.appendChild(tr);
  }
}
$('#btnRiCreate').onclick = async ()=>{
  const date = $('#riDate').value, category = $('#riCategory').value,
        description = $('#riDesc').value||null, amount = Number($('#riAmount').value);
  if(!date || !amount){ alert('Preencha data e valor.'); return; }
  const row = { tenant_id: tenant.id, date, type:'income', category, description, amount, created_by: user.id };
  const { error } = await supa.from('entries').insert(row);
  if(error){ alert('Erro ao salvar: '+error.message); return; }
  $('#riAmount').value=''; $('#riDesc').value='';
  loadIncome(); refresh();
};

// Despesas
async function loadExpense(){
  const { data } = await supa.from('entries')
    .select('id,date,category,description,amount')
    .eq('tenant_id', tenant.id).eq('type','expense')
    .order('date',{ascending:false});
  const tbody = $('#tblExpense'); tbody.innerHTML='';
  for(const r of (data||[])){
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${r.date}</td><td>${r.category||''}</td><td>${r.description||''}</td>
      <td>${fmt(r.amount)}</td><td><button class="btn" data-id="${r.id}">Excluir</button></td>`;
    tr.querySelector('button').onclick = ()=>delEntry(r.id).then(loadExpense);
    tbody.appendChild(tr);
  }
}
$('#btnReCreate').onclick = async ()=>{
  const date = $('#reDate').value, category = $('#reCategory').value,
        description = $('#reDesc').value||null, amount = Number($('#reAmount').value);
  if(!date || !amount){ alert('Preencha data e valor.'); return; }
  const row = { tenant_id: tenant.id, date, type:'expense', category, description, amount, created_by: user.id };
  const { error } = await supa.from('entries').insert(row);
  if(error){ alert('Erro ao salvar: '+error.message); return; }
  $('#reAmount').value=''; $('#reDesc').value='';
  loadExpense(); refresh();
};

// Init
await loadCategories();
await refresh();
