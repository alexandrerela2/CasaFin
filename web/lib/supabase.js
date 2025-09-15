// web/lib/supabase.js
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

if (!window.CASAFIN?.SUPABASE_URL || !window.CASAFIN?.SUPABASE_ANON_KEY) {
  throw new Error("Config ausente: defina window.CASAFIN.{SUPABASE_URL,SUPABASE_ANON_KEY} em web/config.js");
}

export const supa = createClient(
  window.CASAFIN.SUPABASE_URL,
  window.CASAFIN.SUPABASE_ANON_KEY,
  { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true } }
);

export function isPlatformOwner(user) {
  const meta = user?.app_metadata || {};
  return meta.app_role === "owner";
}

export async function requireAuth(redirect = "./index.html") {
  const { data: { session } } = await supa.auth.getSession();
  if (!session) {
    window.location.href = redirect;
    throw new Error("Sem sessão");
  }
}

export async function currentUser() {
  const { data: { user } } = await supa.auth.getUser();
  return user || null;
}

export async function signOutAndGoHome() {
  await supa.auth.signOut();
  window.location.href = "./index.html";
}

export async function redirectAfterLogin() {
  const { data: { user } } = await supa.auth.getUser();
  if (isPlatformOwner(user)) window.location.href = "./owner-panel.html";
  else window.location.href = "./app.html";
}
