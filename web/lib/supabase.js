<script type="module">
  import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

  const cfg = window.CASAFIN;
  export const supabase = createClient(cfg.SUPABASE_URL, cfg.SUPABASE_ANON_KEY);

  // Sessão atual
  export async function getSession() {
    const { data: { session }, error } = await supabase.auth.getSession();
    if (error) console.error(error);
    return session;
  }

  // Usuário atual
  export async function getUser() {
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error) console.error(error);
    return user;
  }
</script>
