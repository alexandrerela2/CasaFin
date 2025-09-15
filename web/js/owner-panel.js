import { supa, requireAuth, isPlatformOwner, signOutAndGoHome } from "../lib/supabase.js";

await requireAuth();
const { data:{ user } } = await supa.auth.getUser();
if (!isPlatformOwner(user)) { window.location.href = "/app.html"; throw new Error("Somente Owner plataforma"); }

document.getElementById('btnSignOut').onclick = signOutAndGoHome;
document.getElementById('btnGoApp').onclick = ()=>window.location.href="/app.html";

async function loadTenants(){
  const { data, error } = await supa.from('tenants').select('id,name,created_at').order('created_at',{ascending:false});
  if(error){ console.error(error); return; }
  const tbody = document.getElementById('tblTenants'); tbody.innerHTML = '';
  for(const t of (data||[])){
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${t.name||''}</td>
      <td><code>${t.id}</code></td>
      <td>${new Date(t.created_at).toLocaleString('pt-BR')}</td>
      <td><button class="btn" data-id="${t.id}">Copiar ID</button></td>`;
    tr.querySelector('button').onclick = ()=>navigator.clipboard.writeText(t.id);
    tbody.appendChild(tr);
  }
}
async function createTenant(){
  const name = document.getElementById('tenName').value?.trim();
  if(!name){ alert("Informe o nome do tenant."); return; }
  const { error } = await supa.from('tenants').insert({ name });
  if(error){ alert("Erro ao criar tenant: "+error.message); return; }
  document.getElementById('tenName').value = '';
  await loadTenants();
}
document.getElementById('btnCreateTenant').onclick = createTenant;

async function loadMembers(){
  const tenantId = document.getElementById('selTenantId').value?.trim();
  if(!tenantId){ alert("Informe o tenant_id."); return; }
  const { data, error } = await supa.from('memberships')
    .select('user_id, role, approved')
    .eq('tenant_id', tenantId)
    .order('role',{ascending:true});
  if(error){ alert("Erro ao listar: "+error.message); return; }
  document.getElementById('selTenantName').textContent = tenantId;
  const tbody = document.getElementById('tblMembers'); tbody.innerHTML = '';
  for(const m of (data||[])){
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td><code>${m.user_id}</code></td>
      <td>${m.role}</td>
      <td>${m.approved ? 'sim' : 'não'}</td>
      <td>
        <button class="btn" data-act="approve">Aprovar</button>
        <button class="btn" data-act="remove">Remover</button>
      </td>`;
    tr.querySelector('[data-act="approve"]').onclick = ()=>approveMember(tenantId, m.user_id);
    tr.querySelector('[data-act="remove"]').onclick  = ()=>removeMember(tenantId, m.user_id);
    tbody.appendChild(tr);
  }
}
async function approveMember(tenantId, userId){
  const { error } = await supa.from('memberships').update({ approved:true })
    .eq('tenant_id', tenantId).eq('user_id', userId);
  if(error){ alert("Erro ao aprovar: "+error.message); return; }
  await loadMembers();
}
async function removeMember(tenantId, userId){
  if(!confirm("Remover este membro?")) return;
  const { error } = await supa.from('memberships').delete()
    .eq('tenant_id', tenantId).eq('user_id', userId);
  if(error){ alert("Erro ao remover: "+error.message); return; }
  await loadMembers();
}

document.getElementById('btnLoadMembers').onclick = loadMembers;

// init
await loadTenants();
