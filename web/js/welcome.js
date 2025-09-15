// web/js/welcome.js
import { supa } from "../lib/supabase.js";

const $ = (id) => document.getElementById(id);

function show(id){ $(id).style.display = "block"; }
function hide(id){ $(id).style.display = "none"; }

function cleanUrl(){
  // remove tokens da URL (hash/query) após processar
  const url = new URL(window.location.href);
  url.hash = "";
  url.search = "";
  window.history.replaceState({}, document.title, url.toString());
}

async function ensureSessionFromUrl(){
  // Com supabase-js v2 e detectSessionInUrl=true (já setado no supabase.js),
  // a sessão é automaticamente persistida quando há tokens no URL hash.
  // Este helper apenas cobre o caso de "code" (alguns provedores/SSO).
  try {
    const url = new URL(window.location.href);
    const code = url.searchParams.get("code");
    if (code) {
      // tentamos a troca de code por sessão (ignora se não suportado)
      if (typeof supa.auth.exchangeCodeForSession === "function") {
        await supa.auth.exchangeCodeForSession(code).catch(()=>{});
      }
    }
  } catch(_) {}
}

async function init(){
  const state = $("state"), problem = $("problem"), errmsg = $("errmsg");
  const setpw = $("setpw"), emailEl = $("email");
  const btn = $("btnSet"), msg = $("msg");

  try {
    await ensureSessionFromUrl();

    // Checa se já temos user (o link de convite cria uma sessão temporária)
    const { data:{ user }, error } = await supa.auth.getUser();
    if (error) throw error;

    if (!user) {
      state.textContent = "Não foi possível confirmar seu convite.";
      errmsg.textContent = "Link inválido ou expirado.";
      hide("state"); show("problem");
      return;
    }

    // Sessão OK — pede a senha
    emailEl.textContent = user.email || user.id;
    hide("state"); show("setpw");
    cleanUrl();

    btn.onclick = async ()=>{
      const p1 = $("pw1").value.trim();
      const p2 = $("pw2").value.trim();
      msg.textContent = "";

      if (p1.length < 8) { msg.textContent = "A senha precisa ter pelo menos 8 caracteres."; return; }
      if (p1 !== p2)    { msg.textContent = "As senhas não coincidem."; return; }

      btn.disabled = true; btn.textContent = "Salvando…";
      const { error: upErr } = await supa.auth.updateUser({ password: p1 });
      if (upErr) {
        btn.disabled = false; btn.textContent = "Salvar senha e entrar";
        msg.textContent = "Erro ao salvar senha: " + (upErr.message || upErr);
        return;
      }

      // sucesso → vai para o app
      hide("setpw"); show("done");
      setTimeout(()=> { window.location.href = "./app.html"; }, 600);
    };

  } catch (e) {
    hide("state"); show("problem");
    errmsg.textContent = e?.message || String(e);
  }
}

window.addEventListener("DOMContentLoaded", init);
