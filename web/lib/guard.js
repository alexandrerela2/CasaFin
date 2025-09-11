import { supabase } from "./supabase.js";

const R = window.CASAFIN.REDIRECTS;

export async function getPrimaryRole() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data, error } = await supabase
    .from("memberships")
    .select("role, approved")
    .eq("approved", true)
    .limit(1);

  if (error || !data || !data.length) {
    if (error) console.error("[getPrimaryRole]", error);
    return null;
  }
  return data[0].role;
}

export async function redirectByRole() {
  const role = await getPrimaryRole();
  if (role === "owner") location.href = R.POST_LOGIN_OWNER;
  else location.href = R.POST_LOGIN_DEFAULT;
}

export async function requireAuth() {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) location.replace(R.NOT_LOGGED);
}

export async function requireOwner() {
  await requireAuth();
  const role = await getPrimaryRole();
  if (role !== "owner") location.replace(R.POST_LOGIN_DEFAULT);
}

export async function signOutAndGoHome() {
  await supabase.auth.signOut();
  location.href = R.NOT_LOGGED;
}

// Opcional p/ debug:
// supabase.auth.onAuthStateChange((ev, session) => console.log("auth:", ev, !!session));

