import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const cfg = window.CASAFIN;
export const supabase = createClient(cfg.SUPABASE_URL, cfg.SUPABASE_ANON_KEY);

export async function getSession() {
  const { data: { session }, error } = await supabase.auth.getSession();
  if (error) console.error("[getSession]", error);
  return session;
}

export async function getUser() {
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error) console.error("[getUser]", error);
  return user;
}
