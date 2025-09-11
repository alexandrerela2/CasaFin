<script type="module">
  import { supabase } from "./supabase.js";

  const R = window.CASAFIN.REDIRECTS;

  // Busca um papel "primário" aprovado do usuário logado
  export async function getPrimaryRole() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;

    const { data, error } = await supabase
      .from("memberships")
      .select("role, approved")
      .eq("approved", true)
      .limit(1);

    if (error || !data || !data.length) return null;
    return data[0].role;
  }

  // Redireciona por papel após login
  export async function redirectByRole() {
    const role = await getPrimaryRole();
    if (role === "owner") {
      location.href = R.POST_LOGIN_OWNER;
    } else {
      location.href = R.POST_LOGIN_DEFAULT;
    }
  }

  // Exigir sessão
  export async function requireAuth() {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) location.replace(R.NOT_LOGGED);
  }

  // Exigir papel owner
  export async function requireOwner() {
    await requireAuth();
    const role = await getPrimaryRole();
    if (role !== "owner") location.replace(R.POST_LOGIN_DEFAULT);
  }

  // Logout + volta ao início
  export async function signOutAndGoHome() {
    await supabase.auth.signOut();
    location.href = R.NOT_LOGGED;
  }

  // Observa mudanças de sessão (opcional – útil para debugar)
  supabase.auth.onAuthStateChange((_event, session) => {
    // console.log("auth change:", _event, !!session);
  });
</script>
