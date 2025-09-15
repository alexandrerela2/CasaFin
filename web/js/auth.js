import { supa, isPlatformOwner, redirectAfterLogin } from "../lib/supabase.js";

// Se já estiver logado, vai para o destino correto
(async ()=>{
  const { data:{ session } } = await supa.auth.getSession();
  if (session) await redirectAfterLogin();
})();

// Trata callbacks OAuth (?code=...) se um dia você usar provedores sociais
(async ()=>{
  const url = new URL(window.location.href);
  const code = url.searchParams.get("code");
  if (code) {
    try {
      await supa.auth.exchangeCodeForSession(window.location.href);
      history.replaceState({}, document.title, "./index.html");
      await redirectAfterLogin();
    } catch (e) {
      showError(e.message || "Falha ao finalizar login.");
    }
  }
})();

const frm = document.getElementById("frmLogin");
frm.addEventListener("submit", async (e)=>{
  e.preventDefault();
  const email = /** @type {HTMLInputElement} */(document.getElementById("email")).value.trim();
  const password = /** @type {HTMLInputElement} */(document.getElementById("password")).value;

  try {
    const { error } = await supa.auth.signInWithPassword({ email, password });
    if (error) throw error;
    await redirectAfterLogin();
  } catch (err) {
    showError(err.message || "Não foi possível entrar.");
  }
});

document.getElementById("lnkReset").addEventListener("click", async (e)=>{
  e.preventDefault();
  const email = prompt("Informe seu e-mail para reset de senha:");
  if (!email) return;
  try {
    const { error } = await supa.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/index.html`
    });
    if (error) throw error;
    alert("Se o e-mail existir, você receberá um link para redefinir a senha.");
  } catch (err) {
    showError(err.message || "Falha ao solicitar reset.");
  }
});

function showError(msg){
  const el = document.getElementById("msg");
  el.textContent = msg;
  el.style.display = "block";
}

