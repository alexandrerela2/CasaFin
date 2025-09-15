import { supa, requireAuth, isPlatformOwner, signOutAndGoHome } from "../lib/supabase.js";

await requireAuth();
const { data:{ user } } = await supa.auth.getUser();
if (!isPlatformOwner(user)) { window.location.href = "/app.html"; throw new Error("Somente Owner plataforma"); }

document.getElementById("btnSignOut").onclick = signOutAndGoHome;
document.getElementById("btnGoApp").onclick  = ()=>window.location.href="/app.html";

document.getElementById("btnCreateTenant").onclick = createTenant;

async function createTenant(){
  const name = document.getElementById("tenName").value?.trim();
  if (!name) { alert("Informe o nome do tenant."); return; }
  const { error } = await supa.from("tenants").insert({ name, active:true });
  if (error) { alert("Erro ao criar tenant: " + error.message); return; }
  document.getElementById("tenName").value = "";
  await loadTenants();
}

async function toggleTenantActive(tenant){
  const { error } = await supa.from("tenants").update({ active: !tenant.active }).eq("id", tenant.id);
  if (error) { alert("Erro ao alterar status: " + error.message); return; }
  await loadTenants();
}

async function deleteTenant(id){
  if (!confirm("Confirma excluir este tenant e todos os seus dados?")) return;
  const { error } = await supa.from("tenants").delete().eq("id", id);
  if (error) { alert("Erro ao excluir tenant: " + error.message); return; }
  await loadTenants();
}

async function listMembers(tenant){
  // RPC expõe email via SECURITY DEFINER
  const { data, error } = await supa.rpc("memberships_with_email", { p_tenant: tenant.id });
  if (error) { alert("Erro ao listar membros: " + error.message); return; }

  document.getElementById("selTenantName").textContent = `${tenant.name} — ${tenant.id}`;
  const tbody = document.getElementById("tblMembers"); tbody.innerHTML = "";
  for (const m of (data||[])) {
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
  // Recarrega a grade atual
  const name = document.getElementById("selTenantName").textContent.split(" — ")[0];
  await listMembers({ id: tenantId, name });
}

async function removeMember(tenantId, userId){
  if (!confirm("Remover este membro?")) return;
  const { error } = await supa.from("memberships").delete()
    .eq("tenant_id", tenantId).eq("user_id", userId);
  if (error) { alert("Erro ao remover: " + error.message); return; }
  const name = document.getElementById("selTenantName").textContent.split(" — ")[0];
  await listMembers({ id: tenantId, name });
}

async function loadTenants(){
  const { data, error } = await supa
    .from("tenants")
    .select("id,name,active,created_at")
    .order("created_at", { ascending:false });
  if (error) { alert("Erro ao carregar tenants: " + error.message); return; }

  const tbody = document.getElementById("tblTenants"); tbody.innerHTML = "";
  for (const t of (data||[])) {
    // contar membros (rápido e simples)
    const { data: ms } = await supa.from("memberships").select("role").eq("tenant_id", t.id);
    const membersCount = (ms||[]).length;

    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${t.name || ""}</td>
      <td>${t.active ? '<span class="badge active">ativo</span>' : '<span class="badge paused">paralisado</span>'}</td>
      <td><code>${t.id}</code></td>
      <td>${new Date(t.created_at).toLocaleString("pt-BR")}</td>
      <td>${membersCount}</td>
      <td>
        <button class="btn" data-act="members">Membros</button>
        <button class="btn" data-act="toggle">${t.active ? "Paralisar" : "Ativar"}</button>
        <button class="btn" data-act="delete">Excluir</button>
      </td>`;
    tr.querySelector('[data-act="members"]').onclick = ()=>listMembers(t);
    tr.querySelector('[data-act="toggle"]').onclick  = ()=>toggleTenantActive(t);
    tr.querySelector('[data-act="delete"]').onclick  = ()=>deleteTenant(t.id);
    tbody.appendChild(tr);
  }
}

// init
await loadTenants();
