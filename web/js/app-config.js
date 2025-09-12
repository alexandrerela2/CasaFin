import { supa, requireAuth, getSessionTenant } from "../lib/supabase.js";
const $ = (q)=>document.querySelector(q);

await requireAuth();
const { tenant } = await getSessionTenant();

// Guard: mostrar aba config para admin/owner
const tabConfigBtn = document.querySelector('#tabConfig');
if (tenant?.role === 'owner' || tenant?.role === 'admin') tabConfigBtn.classList.remove('hide');

// ===== Tema / Preferências =====
async function loadTheme(){
  const { data } = await supa.from('tenant_preferences').select('theme').eq('tenant_id', tenant.id).maybeSingle();
  const theme = data?.theme || {};
  if(theme.primary) document.documentElement.style.setProperty('--primary', theme.primary);
  if(theme.bg) document.documentElement.style.setProperty('--bg', theme.bg);
  if($('#themePrimary') && theme.primary) $('#themePrimary').value = theme.primary;
  if($('#themeBg') && theme.bg) $('#themeBg').value = theme.bg;
}
async function saveTheme(){
  const theme = { primary: $('#themePrimary').value, bg: $('#themeBg').value };
  const { error } = await supa.from('tenant_preferences').upsert({
    tenant_id: tenant.id, theme, updated_by: tenant.user_id
  });
  if(error){ alert('Erro ao salvar tema: '+error.message); return; }
  await loadTheme();
}
if($('#btnSaveTheme')) $('#btnSaveTheme').onclick = saveTheme;

// ===== Categorias =====
async function loadCategories(){
  const { data, error } = await supa.from('categories')
    .select('id,kind,name,active')
    .eq('tenant_id', tenant.id)
    .order('kind').order('name');
  if(error){ console.error(error); return; }
  const tbody = $('#tblCategories'); if(!tbody) return;
  tbody.innerHTML='';
  for(const c of (data||[])){
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${c.kind}</td><td>${c.name}</td><td>${c.active? 'Ativa':'Inativa'}</td>
      <td>
        <button class="btn" data-id="${c.id}" data-act="toggle">${c.active? 'Desativar':'Ativar'}</button>
        <button class="btn" data-id="${c.id}" data-act="delete">Excluir</button>
      </td>`;
    tr.querySelector('[data-act="toggle"]').onclick = ()=>toggleCategory(c);
    tr.querySelector('[data-act="delete"]').onclick = ()=>deleteCategory(c.id);
    tbody.appendChild(tr);
  }
}
async function addCategory(){
  const kind = $('#catKind').value;
  const name = $('#catName').value?.trim();
  if(!name){ alert('Informe o nome.'); return; }
  const row = { tenant_id: tenant.id, kind, name, active:true, created_by: tenant.user_id };
  const { error } = await supa.from('categories').insert(row);
  if(error){ alert('Erro ao incluir: '+error.message); return; }
  $('#catName').value=''; loadCategories();
}
async function toggleCategory(c){
  const { error } = await supa.from('categories').update({ active: !c.active }).eq('id', c.id).eq('tenant_id', tenant.id);
  if(error){ alert('Erro: '+error.message); return; }
  loadCategories();
}
async function deleteCategory(id){
  if(!confirm('Excluir categoria?')) return;
  const { error } = await supa.from('categories').delete().eq('id', id).eq('tenant_id', tenant.id);
  if(error){ alert('Erro: '+error.message); return; }
  loadCategories();
}
if($('#btnAddCategory')) $('#btnAddCategory').onclick = addCategory;

// init
await loadTheme();
await loadCategories();
