import { supa, requireAuth, isPlatformOwner, signOutAndGoHome } from "../lib/supabase.js";

await requireAuth();
const { data:{ user } } = await supa.auth.getUser();
if (!isPlatformOwner(user)) { window.location.href = "/app.html"; throw new Error("Somente Owner plataforma"); }

document.getElementById("btnSignOut").onclick = signOutAndGoHome;
document.getElementById("btnGoApp").onclick  = ()=>window.location.href="/app.html";

let currentTenant = null;

/* ===== Tenants ===== */
document.getElementById("btnCreateTenant").onclick = async ()=>{
  const name = document.getElementById("tenName").value?.trim();
  if (!name) { alert("Informe o nome do tenant."); return; }
  const { data, error } = await supa.rpc("create_tenant", { p_name: name });
  if (error) { alert("Erro ao criar tenant: " + error.message); return; }
  document.getElementById("tenName").value = "";
  await loadTenants();
  // Seleciona o recém-criado
  currentTenant = data;
  await listMembers(currentTenant);
};

async function toggleTenantActive(tenant){
  const { error } = await supa.from("tenants").update({ active: !tenant.active }).eq("id", tenant.id);
  if (error) { alert("Erro ao alterar status: " + error.message); return; }
  await loadTenants();
}

async function deleteTenant(id){
  if (!confirm("Confirma excluir este tenant e todos os seus dados?")) return;
  const { error } = await supa.from("tenants").delete().eq("id", id);
  if (error) { alert("Erro ao excluir tenant: " + error.message); return; }
  if (currentTenant?.id === id) { currentTenant = null; document.getElementById("tblMembers").innerHTML = ""; document.getElementById("selTenantName").textContent = "—"; }
  await loadTenants();
}

async function loadTenants(){
  // usa RPC com contagem de membros
  const { data, error } = await supa.rpc("tenants_with_counts");
  if (error) { alert("Erro ao carregar tenants: " + error.message); return; }

  const tbody = document.getElementById("tblTenants"); tbody.innerHTML = "";
  for (const t of (data||[])) {
    const tr = document.createElement("tr");
   tr.innerHTML = `
  <td>${t.name || ""}</td>
  <td><code>${t.slug || ""}</code></td>
  <td><code>${t.passcode || ""}</code></td>
  <td>${t.active ? '<span class="badge active">ativo</span>' : '<span class="badge paused">paralisado</span>'}</td>
  <td><code>${t.id}</code></td>
  <td>${new Date(t.created_at).toLocaleString("pt-BR")}</td>
  <td>${t.members}</td>
  <td>
    <button class="btn" data-act="members">Membros</button>
    <button class="btn" data-act="toggle">${t.active ? "Paralisar" : "Ativar"}</button>
    <button class="btn" data-act="delete">Excluir</button>
  </td>`;

        <button class="btn" data-act="members">Membros</button>
        <button class="btn" data-act="toggle">${t.active ? "Paralisar" : "Ativar"}</button>
        <button class="btn" data-act="delete">Excluir</button>
      </td>`;
    tr.querySelector('[data-act="members"]').onclick = ()=>{ currentTenant = t; listMembers(t); };
    tr.querySelector('[data-act="toggle"]').onclick  = ()=>toggleTenantActive(t);
    tr.querySelector('[data-act="delete"]').onclick  = ()=>deleteTenant(t.id);
    tbody.appendChild(tr);
  }
}

/* ===== Membros ===== */
async function listMembers(tenant){
  const { data, error } = await supa.rpc("memberships_with_email", { p_tenant: tenant.id });
  if (error) { alert("Erro ao listar membros: " + error.message); return; }

  document.getElementById("selTenantName").textContent = `${tenant.name} — ${tenant.id}`;
  const tbody = document.getElementById("tblMembers"); tbody.innerHTML = "";
  for (const m of (data||[])){
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${m.email || ""}</td>
      <td><code>${m.user_id}</code></td>
      <td>${m.role}</td>
      <td>${m.approved ? "sim" : "não"}</td>
      <td>
        <button class="btn" data-act="approve">Aprovar</button>
        <button class="btn" data-act="remove">Remover</button>
      </td>`;
    tr.querySelector('[data-act="approve"]').onclick = ()=>approveMember(tenant.id, m.user_id);
    tr.querySelector('[data-act="remove"]').onclick  = ()=>removeMember(tenant.id, m.user_id);
    tbody.appendChild(tr);
  }
}

async function approveMember(tenantId, userId){
  const { error } = await supa.from("memberships").update({ approved:true })
    .eq("tenant_id", tenantId).eq("user_id", userId);
  if (error) { alert("Erro ao aprovar: " + error.message); return; }
  if (currentTenant?.id === tenantId) await listMembers(currentTenant);
}

async function removeMember(tenantId, userId){
  if (!confirm("Remover este membro?")) return;
  const { error } = await supa.from("memberships").delete()
    .eq("tenant_id", tenantId).eq("user_id", userId);
  if (error) { alert("Erro ao remover: " + error.message); return; }
  if (currentTenant?.id === tenantId) await listMembers(currentTenant);
}

// Adicionar/atualizar membro por e-mail
document.getElementById("btnAddMember").onclick = async ()=>{
  if (!currentTenant) { alert("Selecione um tenant (botão Membros) antes de adicionar usuários."); return; }
  const email = document.getElementById("memEmail").value.trim();
  const role  = document.getElementById("memRole").value;
  const approved = document.getElementById("memApproved").checked;
  if (!email) { alert("Informe o e-mail."); return; }

  const { data, error } = await supa.rpc("invite_member_by_email", {
    p_tenant: currentTenant.id,
    p_email: email,
    p_role: role,
    p_approved: approved
  });
  if (error) { alert("Erro ao adicionar/atualizar membro: " + error.message); return; }
  if (!data?.ok) { alert("Falha: " + (data?.error || "desconhecida")); return; }

  document.getElementById("memEmail").value = "";
  await listMembers(currentTenant);
};

// init
await loadTenants();
