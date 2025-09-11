// web/lib/guard.js
import { supabase } from "./supabase.js";

// Ordem de precedência (caso o usuário tenha mais de 1 membership)
const ROLE_ORDER = ["owner", "admin", "usuario"];

export async function getPrimaryRole() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  // Busca memberships aprovadas do usuário
  const { data, error } = await supabase
    .from("memberships")
    .select("role, approved")
    .eq("approved", true);

  if (error || !data || !data.length) return null;

  // Escolhe o "maior" papel pela ordem
  const roles = data.map(r => r.role);
  roles.sort((a, b) => ROLE_ORDER.indexOf(a) - ROLE_ORDER.indexOf(b));
  return roles[0] || null;
}

// Redireciona conforme papel
export async function redirectByRole() {
  const role = await getPrimaryRole();
  if (role === "owner") {
    location.href = "/owner-panel.html";
  } else {
    location.href = "/app.html";
  }
}

// Exige sessão; se não tiver, volta ao login
export async function requireAuth() {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) {
    location.href = "/";
    throw new Error("No session");
  }
}

// Exige OWNER; senão, manda para app
export async function requireOwner() {
  await requireAuth();
  const role = await getPrimaryRole();
  if (role !== "owner") {
    location.href = "/app.html";
    throw new Error("Not owner");
  }
}

export async function signOutAndGoHome() {
  await supabase.auth.signOut();
  location.href = "/";
}

