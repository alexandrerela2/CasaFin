// web/js/app-entries.js
import {
  supa,
  requireAuth,
  signOutAndGoHome,
  getSessionTenant,
  isPlatformOwner
} from "../lib/supabase.js";

const $  = (q)=>document.querySelector(q);
const fmt = (n)=> (Number(n)||0).toLocaleString("pt-BR",{ style:"currency", currency:"BRL" });

/* ===== Auth + Guard ===== */
await requireAuth();

// Se for Owner de plataforma, não deve usar o app de tenant
{
  const { data:{ user } } = await supa.auth.getUser();
  if (isPlatformOwner(user)) {
    window.location.href = "/owner-panel.html";
    throw new Error("Platform owner should not use tenant app");
  }
}

/* ===== Contexto do Tenant ===== */
const { user, tenant } = await getSessionTenant();

$("#tenantName").textContent = `Tenant: ${tenant?.name ?? "—"}`;

if (tenant?.role === "owner" || tenant?.role === "admin") {
  document.getElementById("tabConfig").classList.remove("hide");
}
document.getElementById("btnSignOut").onclick = signOutAndGoHome;

/* ===== Tabs ===== */
const tabs = document.querySelectorAll(".tab");
tabs.forEach(t => t.onclick = ()=>{
  tabs.forEach(x=>x.classList.remove("active"));
  t.classList.add("active");
  const id = t.dataset.tab;
  document.querySelectorAll("main > section").forEach(sec=>sec.style.display="none");
  document.getElementById("tab-"+id).style.display="grid";
  if (id === "dashboard") refresh();
  if (id === "receitas")  loadIncome();
  if (id === "despesas")  loadExpense();
});

/* ===== Filtro de período (Dashboard) ===== */
function getPeriod(){
  const mode = $("#filterPeriod").value;
  const today = new Date(); let from, to;
  if (mode === "today") { from = to = today; }
  else if (mode === "week") {
    const d = new Date(today);
    const day = d.getDay();
    const diff = (day===0 ? 6 : day-1);
    from = new Date(d); from.setDate(d.getDate()-diff);
    to   = new Date(from); to.setDate(from.getDate()+6);
  } else if (mode === "month") {
    from = new Date(today.getFullYear(), today.getMonth(), 1);
    to   = new Date(today.getFullYear(), today.getMonth()+1, 0);
  } else {
    from = $("#filterFrom").value ? new Date($("#filterFrom").value) : today;
    to   = $("#filterTo").value   ? new Date($("#filterTo").value)   : today;
  }
  const f = from.toISOString().slice(0,10);
  const t = to.toISOString().slice(0,10);
  return { from:f, to:t };
}
$("#btnRefresh").onclick = refresh;

/* ===== Dashboard: lista + totais ===== */
async function refresh(){
  const { from, to } = getPeriod();
  const { data, error } = await supa
    .from("entries")
    .select("id,date,type,category,description,amount")
    .eq("tenant_id", tenant.id)
    .gte("date", from).lte("date", to)
    .order("date", { ascending:false });

  if (error) { console.error(error); return; }

  const tbody = $("#tblEntries"); tbody.innerHTML = "";
  let si = 0, se = 0;

  for (const r of (data||[])) {
    if (r.type === "income")  si += Number(r.amount);
    if (r.type === "expense") se += Number(r.amount);

    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${r.date}</td>
      <td>${r.type}</td>
      <td>${r.category || ""}</td>
      <td>${r.description || ""}</td>
      <td>${fmt(r.amount)}</td>
      <td><button class="btn" data-id="${r.id}">Excluir</button></td>
    `;
    tr.querySelector("button").onclick = ()=>delEntry(r.id);
    tbody.appendChild(tr);
  }

  $("#sumIncome").textContent  = fmt(si);
  $("#sumExpense").textContent = fmt(se);
  $("#sumBalance").textContent = fmt(si - se);
}

async function delEntry(id){
  const { error } = await supa
    .from("entries")
    .delete()
    .eq("id", id)
    .eq("tenant_id", tenant.id);
  if (error) { alert("Erro ao excluir: " + error.message); return; }
  refresh();
}

/* ===== Categorias → selects (Dashboard/Receitas/Despesas) ===== */
async function loadCategories(){
  const { data } = await supa
    .from("categories")
    .select("id,kind,name,active")
    .eq("tenant_id", tenant.id)
    .eq("active", true)
    .order("kind")
    .order("name");

  const inc = (data||[]).filter(c=>c.kind==="income");
  const exp = (data||[]).filter(c=>c.kind==="expense");

  fillSelect("#fCategory", inc.concat(exp));
  fillSelect("#riCategory", inc);
  fillSelect("#reCategory", exp);
}
function fillSelect(selector, arr){
  const el = document.querySelector(selector); if (!el) return;
  el.innerHTML = "";
  for (const c of arr) {
    const opt = document.createElement("option");
    opt.value = c.name;
    opt.textContent = `${c.kind==="income" ? "[R]" : "[D]"} ${c.name}`;
    el.appendChild(opt);
  }
}

/* ===== Criar lançamento (Dashboard) ===== */
document.getElementById("btnCreate").onclick = async ()=>{
  const date        = document.getElementById("fDate").value;
  const type        = document.getElementById("fType").value;
  const category    = document.getElementById("fCategory").value || null;
  const description = document.getElementById("fDesc").value || null;
  const amount      = Number(document.getElementById("fAmount").value);

  if (!date || !type || !amount) { alert("Preencha data, tipo e valor."); return; }

  const row = { tenant_id: tenant.id, date, type, category, description, amount, created_by: user.id };
  const { error } = await supa.from("entries").insert(row);
  if (error) { alert("Erro ao salvar: " + error.message); return; }

  document.getElementById("fAmount").value = "";
  document.getElementById("fDesc").value   = "";
  refresh();
};

/* ===== Receitas (CRUD) ===== */
async function loadIncome(){
  const { data } = await supa
    .from("entries")
    .select("id,date,category,description,amount")
    .eq("tenant_id", tenant.id)
    .eq("type","income")
    .order("date",{ ascending:false });

  const tbody = document.getElementById("tblIncome"); tbody.innerHTML = "";
  for (const r of (data||[])) {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${r.date}</td>
      <td>${r.category || ""}</td>
      <td>${r.description || ""}</td>
      <td>${fmt(r.amount)}</td>
      <td><button class="btn" data-id="${r.id}">Excluir</button></td>
    `;
    tr.querySelector("button").onclick = ()=>delEntry(r.id).then(loadIncome);
    tbody.appendChild(tr);
  }
}
document.getElementById("btnRiCreate").onclick = async ()=>{
  const date        = document.getElementById("riDate").value;
  const category    = document.getElementById("riCategory").value;
  const description = document.getElementById("riDesc").value || null;
  const amount      = Number(document.getElementById("riAmount").value);

  if (!date || !amount) { alert("Preencha data e valor."); return; }

  const row = { tenant_id: tenant.id, date, type:"income", category, description, amount, created_by: user.id };
  const { error } = await supa.from("entries").insert(row);
  if (error) { alert("Erro ao salvar: " + error.message); return; }

  document.getElementById("riAmount").value = "";
  document.getElementById("riDesc").value   = "";
  loadIncome(); refresh();
};

/* ===== Despesas (CRUD) ===== */
async function loadExpense(){
  const { data } = await supa
    .from("entries")
    .select("id,date,category,description,amount")
    .eq("tenant_id", tenant.id)
    .eq("type","expense")
    .order("date",{ ascending:false });

  const tbody = document.getElementById("tblExpense"); tbody.innerHTML = "";
  for (const r of (data||[])) {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${r.date}</td>
      <td>${r.category || ""}</td>
      <td>${r.description || ""}</td>
      <td>${fmt(r.amount)}</td>
      <td><button class="btn" data-id="${r.id}">Excluir</button></td>
    `;
    tr.querySelector("button").onclick = ()=>delEntry(r.id).then(loadExpense);
    tbody.appendChild(tr);
  }
}
document.getElementById("btnReCreate").onclick = async ()=>{
  const date        = document.getElementById("reDate").value;
  const category    = document.getElementById("reCategory").value;
  const description = document.getElementById("reDesc").value || null;
  const amount      = Number(document.getElementById("reAmount").value);

  if (!date || !amount) { alert("Preencha data e valor."); return; }

  const row = { tenant_id: tenant.id, date, type:"expense", category, description, amount, created_by: user.id };
  const { error } = await supa.from("entries").insert(row);
  if (error) { alert("Erro ao salvar: " + error.message); return; }

  document.getElementById("reAmount").value = "";
  document.getElementById("reDesc").value   = "";
  loadExpense(); refresh();
};

/* ===== Init ===== */
await loadCategories();
await refresh();
