// api/invite-user.mjs
import { createClient } from "@supabase/supabase-js";

/**
 * GET  /api/invite-user   -> sanity check (retorna JSON)
 * POST /api/invite-user   -> { tenantId, email, role, approved }
 *   Header: Authorization: Bearer <access_token do Owner>
 */
export default async function handler(req, res) {
  try {
    // sanity check
    if (req.method === "GET") {
      return res.status(200).json({
        ok: true,
        method: "GET",
        hasUrl:  !!process.env.SUPABASE_URL,
        hasAnon: !!process.env.SUPABASE_ANON_KEY,
        hasSrv:  !!process.env.SUPABASE_SERVICE_ROLE_KEY,
        hasApp:  !!process.env.APP_URL
      });
    }

    if (req.method !== "POST") {
      return res.status(405).json({ ok:false, error:"METHOD_NOT_ALLOWED" });
    }

    const { tenantId, email, role = "usuario", approved = false } = req.body || {};
    if (!tenantId || !email) return res.status(400).json({ ok:false, error:"MISSING_PARAMS" });

    const url  = process.env.SUPABASE_URL;
    const anon = process.env.SUPABASE_ANON_KEY;
    const svc  = process.env.SUPABASE_SERVICE_ROLE_KEY;
    // redireciona para a página que define senha e entra
    const redirectTo = process.env.APP_URL ? `${process.env.APP_URL}/welcome.html` : undefined;

    if (!url || !anon || !svc) return res.status(500).json({ ok:false, error:"MISSING_ENV_SUPABASE" });

    // valida quem chama: precisa ser o Owner plataforma
    const bearer = req.headers.authorization || "";
    const token  = bearer.startsWith("Bearer ") ? bearer.slice(7) : null;

    const pub = createClient(url, anon);
    const { data: ures, error: uerr } = await pub.auth.getUser(token);
    if (uerr || !ures?.user) return res.status(401).json({ ok:false, error:"NOT_AUTHENTICATED" });
    if (ures.user.app_metadata?.app_role !== "owner") {
      return res.status(403).json({ ok:false, error:"NOT_PLATFORM_OWNER" });
    }

    // admin client (service role) para Admin API e bypass de RLS
    const admin = createClient(url, svc, { auth: { autoRefreshToken:false, persistSession:false } });

    // 1) tenta convidar (envia e-mail se possível)
    let createdByInvite = false;
    let userId = null;

    const invited = await admin.auth.admin
      .inviteUserByEmail(email, { redirectTo })
      .catch(e => ({ error: e }));

    if (invited?.data?.user?.id) {
      userId = invited.data.user.id;
      createdByInvite = true;
    }

    // 2) se já existia, localiza
    if (!userId) {
      const { data: list, error: listErr } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
      if (listErr) {
        return res.status(500).json({ ok:false, error:"LIST_USERS_FAILED", details: String(listErr?.message || listErr) });
      }
      const found = (list?.users || []).find(u => String(u.email || "").toLowerCase() === String(email).toLowerCase());
      if (found) userId = found.id;
    }

    if (!userId) return res.status(400).json({ ok:false, error:"USER_NOT_FOUND_OR_INVITE_FAILED" });

    // 3) gera o link de acesso (sempre retornamos como fallback para copiar)
    let invite_link = null;
    try {
      const gl = await admin.auth.admin.generateLink({
        type: createdByInvite ? "invite" : "recovery",
        email,
        options: { redirectTo }
      });
      invite_link =
        gl?.data?.properties?.action_link ||
        gl?.data?.action_link ||
        null;
    } catch (_) {
      // ok se falhar, apenas não retornamos link
    }

    // 4) vincula ao tenant (upsert)
    const db = createClient(url, svc, { auth: { autoRefreshToken:false, persistSession:false } });
    const { error: upErr } = await db
      .from("memberships")
      .upsert({ tenant_id: tenantId, user_id: userId, role, approved }, { onConflict: "tenant_id,user_id" });
    if (upErr) return res.status(500).json({ ok:false, error:"MEMBERSHIP_UPSERT_FAILED", details: upErr.message });

    return res.status(200).json({ ok:true, user_id: userId, invite_link });
  } catch (e) {
    return res.status(500).json({ ok:false, error:"UNEXPECTED", details:String(e?.message || e) });
  }
}

