// api/invite-user.mjs
import { createClient } from "@supabase/supabase-js";

/**
 * GET  /api/invite-user   -> sanity check (retorna JSON)
 * POST /api/invite-user   -> { tenantId, email, role, approved }
 *   Header: Authorization: Bearer <access_token do Owner>
 */
export default async function handler(req, res) {
  try {
    if (req.method === "GET") {
      const hasUrl  = !!process.env.SUPABASE_URL;
      const hasAnon = !!process.env.SUPABASE_ANON_KEY;
      const hasSrv  = !!process.env.SUPABASE_SERVICE_ROLE_KEY;
      const hasApp  = !!process.env.APP_URL;
      return res.status(200).json({ ok:true, method:"GET", hasUrl, hasAnon, hasSrv, hasApp });
    }
    if (req.method !== "POST") {
      return res.status(405).json({ ok:false, error:"METHOD_NOT_ALLOWED" });
    }

    const { tenantId, email, role = "usuario", approved = false } = req.body || {};
    if (!tenantId || !email) return res.status(400).json({ ok:false, error:"MISSING_PARAMS" });

    const url  = process.env.SUPABASE_URL;
    const anon = process.env.SUPABASE_ANON_KEY;
    const svc  = process.env.SUPABASE_SERVICE_ROLE_KEY;

    // 🔁 NOVO: ao aceitar o convite, usuário vai para /welcome.html
    const redirectTo = process.env.APP_URL
      ? `${process.env.APP_URL}/welcome.html`
      : undefined;

    if (!url || !anon || !svc) return res.status(500).json({ ok:false, error:"MISSING_ENV_SUPABASE" });

    // autentica o chamador (precisa ser Owner de plataforma)
    const bearer = req.headers.authorization || "";
    const token  = bearer.startsWith("Bearer ") ? bearer.slice(7) : null;

    const pub = createClient(url, anon);
    const { data: userData, error: getUserErr } = await pub.auth.getUser(token);
    if (getUserErr || !userData?.user) return res.status(401).json({ ok:false, error:"NOT_AUTHENTICATED" });
    const caller = userData.user;
    if (caller?.app_metadata?.app_role !== "owner") return res.status(403).json({ ok:false, error:"NOT_PLATFORM_OWNER" });

    // Admin (service role) para usar Admin API e burlar RLS
    const admin = createClient(url, svc, { auth: { autoRefreshToken:false, persistSession:false } });

    // convida (cria se não existir)
    let userId = null;
    const invited = await admin.auth.admin.inviteUserByEmail(email, { redirectTo }).catch(e => ({ error: e }));
    userId = invited?.data?.user?.id || null;

    // se já existia, tente localizar
    if (!userId) {
      const { data: list, error: listErr } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
      if (listErr) return res.status(500).json({ ok:false, error:"LIST_USERS_FAILED", details:String(listErr?.message || listErr) });
      const found = (list?.users || []).find(u => String(u.email || "").toLowerCase() === String(email).toLowerCase());
      if (found) userId = found.id;
    }
    if (!userId) return res.status(400).json({ ok:false, error:"USER_NOT_FOUND_OR_INVITE_FAILED" });

    // vincula ao tenant
    const db = createClient(url, svc, { auth: { autoRefreshToken:false, persistSession:false } });
    const { error: upErr } = await db
      .from("memberships")
      .upsert({ tenant_id: tenantId, user_id: userId, role, approved }, { onConflict: "tenant_id,user_id" });
    if (upErr) return res.status(500).json({ ok:false, error:"MEMBERSHIP_UPSERT_FAILED", details: upErr.message });

    return res.status(200).json({ ok:true, user_id: userId });
  } catch (e) {
    return res.status(500).json({ ok:false, error:"UNEXPECTED", details:String(e?.message || e) });
  }
}

