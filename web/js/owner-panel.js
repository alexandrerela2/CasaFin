// web/js/owner-panel.js
import { supa, requireAuth, isPlatformOwner, signOutAndGoHome, currentUser } from "../lib/supabase.js";

let currentTenant = null;

function toast(msg){
  const t = document.getElementById("toast");
  if (!t) return alert(msg);
  t.textContent = String(msg ?? "");
  t.style.display = "block";
  setTimeout(()=> t.style.display = "none", 4000);
}
function on(el, ev, fn){ el && el.addEventListener(ev, fn); }

async function init(){
  try {
    await requireAuth("./index.html");
    const user = await currentUser();
    document.getElementById("debug").textContent =
      user ? `user=${user.id} | role=${user.app_metadata?.app_role ?? "-"}` : "sem sessão";

    if (!isPlatformOwner(user)) { window.location.href = "./app.html"; return; }

    on(document.getElementById("btnSignOut"), "click", signOutAndGoHome);
    on(document.getElementById("btnGoApp"),   "click", ()=> window.location.href = "./app.html");
    on(document.getElementById("btnCreateTenant"), "click", createTenant);
    on(document.getElementById("btnAddMember"),    "click", addMember);

    await loadTenants();
  } catch (e) { console.error(e); toast(e?.message || e); }
}

async function createTenant(){
  const name = document.getElementById("tenName").value?.trim();
  if (!name) { toast("Informe o nome do tenant."); return; }
  try {
    const { data, error } = await supa.rpc("create_tenant", { p_name: name });
    if (error) throw error;
    document.getElementById("tenName").value = "";
    await loadTenants();
    if (Array.isArray(data) && data[0]) { currentTenant = data[0]; await listMembers(currentTenant); }
  } catch (e) { console.error(e); toast("Erro ao criar tenant: " + (e?.message || e)); }
}

async function toggleTenantActive(tenant){
  try {
    const { error } = await supa.from("tenants").update({ active: !tenant.active }).eq("id", tenant.id);
    if (error) throw error;
    await loadTenants();
  } catch (e) { toast("Erro ao alterar status: " + (e?.message || e)); }
}

async function deleteTenant(id){
  if (!confirm("Confirma excluir este tenant e todos os seus dados?")) return;
  try {
    const { error } = await supa.from("tenants").delete().eq("id", id);
    if (error) throw error;
    if (currentTenant?.id === id) {
      currentTenant = null;
      document.getElementById("tblMembers").innerHTML = "";
      document.getElementById("selTenantName").textContent = "—";
    }
    await loadTenants();
  } catch (e) { toast("Erro ao excluir tenant: " + (e?.message || e)); }
}

async function loadTenants(){
  try {
    let { data, error } = await supa.rpc("tenants_with_counts");
    if (error) throw error;

    if (!Array.isArray(data)) {
      const sel = await supa.from("tenants").select("id,name,slug,passcode,active,created_at");
      if (sel.error) throw sel.error;
      data = (sel.data || []);
      // contagem de membros (rápida)
      for (const t of data) {
        const cnt = await supa.from("memberships").select("*", { count: "exact", head: true }).eq("tenant_id", t.id);
        t.members = cnt.count ?? 0;
      }
    }

    const tbody = document.getElementById("tblTenants"); tbody.innerHTML = "";
    for (const t of data) {
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${t.name || ""}</td>
        <td><code>${t.slug || ""}</code></td>
        <td><code>${t.passcode || ""}</code></td>
        <td>${t.active ? '<span class="badge active">ativo</span>' : '<span class="badge paused">paralisado</span>'}</td>
        <td><code>${t.id}</code></td>
        <td>${t.created_at ? new Date(t.created_at).toLocaleString("pt-BR") : ""}</td>
        <td>${t.members ?? 0}</td>
        <td>
          <button class="btn" data-act="members">Membros</button>
          <button class="btn" data-act="toggle">${t.active ? "Paralisar" : "Ativar"}</button>
          <button class="btn" data-act="delete">Excluir</button>
        </td>`;
      tr.querySelector('[data-act="members"]').onclick = ()=>{ currentTenant = t; listMembers(t); };
      tr.querySelector('[data-act="toggle"]').onclick  = ()=> toggleTenantActive(t);
      tr.querySelector('[data-act="delete"]').onclick  = ()=> deleteTenant(t.id);
      tbody.appendChild(tr);
    }

    if (currentTenant) {
      const still = data.find(x => x.id === currentTenant.id);
      if (still) { currentTenant = still; await listMembers(still); }
      else {
        currentTenant = null;
        document.getElementById("tblMembers").innerHTML = "";
        document.getElementById("selTenantName").textContent = "—";
      }
    }
  } catch (e) { console.error(e); toast("Erro ao carregar tenants: " + (e?.message || e)); }
}

async function listMembers(tenant){
  try {
    const { data, error } = await supa.rpc("memberships_with_email", { p_tenant: tenant.id });
    if (error) throw error;

    document.getElementById("selTenantName").textContent = `${tenant.name} — ${tenant.id}`;
    const tbody = document.getElementById("tblMembers"); tbody.innerHTML = "";
    for (const m of (data || [])) {
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
      tr.querySelector('[data-act="approve"]').onclick = ()=> approveMember(tenant.id, m.user_id, true);
      tr.querySelector('[data-act="remove"]').onclick  = ()=> removeMember(tenant.id, m.user_id);
      tbody.appendChild(tr);
    }
  } catch (e) { console.error(e); toast("Erro ao listar membros: " + (e?.message || e)); }
}

async function approveMember(tenantId, userId, approved){
  try {
    const { data, error } = await supa.rpc("approve_member", { p_tenant: tenantId, p_user: userId, p_approved: approved });
    if (error) throw error;
    if (!data?.ok) throw new Error("Não foi possível aprovar.");
    if (currentTenant?.id === tenantId) { await listMembers(currentTenant); }
  } catch (e) { toast("Erro ao aprovar: " + (e?.message || e)); }
}

async function removeMember(tenantId, userId){
  if (!confirm("Remover este membro?")) return;
  try {
    const { data, error } = await supa.rpc("remove_member", { p_tenant: tenantId, p_user: userId });
    if (error) throw error;
    if (!data?.ok) throw new Error("Não foi possível remover.");
    if (currentTenant?.id === tenantId) { await listMembers(currentTenant); }
  } catch (e) { toast("Erro ao remover: " + (e?.message || e)); }
}

async function addMember(){
  if (!currentTenant) { toast("Selecione um tenant (botão Membros)."); return; }
  const email = document.getElementById("memEmail").value.trim();
  const role  = document.getElementById("memRole").value;
  const approved = document.getElementById("memApproved").checked;
  if (!email) { toast("Informe o e-mail."); return; }
  try {
    const { data, error } = await supa.rpc("invite_member_by_email", {
      p_tenant: currentTenant.id, p_email: email, p_role: role, p_approved: approved
    });
    if (error) throw error;
    if (!data?.ok) throw new Error(data?.error || "Falha ao adicionar/atualizar membro");
    document.getElementById("memEmail").value = "";
    await listMembers(currentTenant);
  } catch (e) { toast("Erro ao adicionar/atualizar: " + (e?.message || e)); }
}

window.addEventListener("DOMContentLoaded", () => { init(); });
