// api/invite-user.js
import { createClient } from "@supabase/supabase-js";

/**
 * POST /api/invite-user
 * Body: { tenantId, email, role, approved }
 * Header: Authorization: Bearer <token do Owner>
 */
export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ ok: false, error: "METHOD_NOT_ALLOWED" });
  }

  const { tenantId, email, role = "usuario", approved = false } = req.body || {};
  if (!tenantId || !email) {
    return res.status(400).json({ ok: false, error: "MISSING_PARAMS" });
  }

  // 0) Variáveis de ambiente
  const url  = process.env.SUPABASE_URL;
  const anon = process.env.SUPABASE_ANON_KEY;
  const svc  = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const redirectTo = process.env.APP_URL
    ? `${process.env.APP_URL}/index.html`
    : undefined;

  if (!url || !anon || !svc) {
    return res.status(500).json({ ok: false, error: "MISSING_ENV_SUPABASE" });
  }

  try {
    // 1) Autenticar o chamador e validar que é Owner de plataforma
    const bearer = req.headers.authorization || "";
    const token  = bearer.startsWith("Bearer ") ? bearer.slice(7) : null;

    const pub = createClient(url, anon);
    const { data: userData, error: getUserErr } = await pub.auth.getUser(token);
    if (getUserErr || !userData?.user) {
      return res.status(401).json({ ok: false, error: "NOT_AUTHENTICATED" });
    }
    const caller = userData.user;
    if (caller?.app_metadata?.app_role !== "owner") {
      return res.status(403).json({ ok: false, error: "NOT_PLATFORM_OWNER" });
    }

    // 2) Cliente com Service Role para usar Admin API e burlar RLS do backend
    const admin = createClient(url, svc, { auth: { autoRefreshToken: false, persistSession: false } });

    // 2a) Tentar INVITE (cria usuário se não existe e envia e-mail)
    let invited = await admin.auth.admin.inviteUserByEmail(email, { redirectTo }).catch((e) => ({ error: e }));
    let userId  = invited?.data?.user?.id || null;

    // 2b) Se já existia e o invite falhou, tenta localizar o user por e-mail
    if (!userId) {
      // lista até 1000 usuários e procura por e-mail (ok para projetos pequenos)
      const pageSize = 1000;
      const { data: list, error: listErr } = await admin.auth.admin.listUsers({ page: 1, perPage: pageSize });
      if (listErr) {
        return res.status(500).json({ ok: false, error: "LIST_USERS_FAILED", details: String(listErr.message || listErr) });
      }
      const found = (list?.users || []).find(u => String(u.email || "").toLowerCase() === String(email).toLowerCase());
      if (found) userId = found.id;
    }

    if (!userId) {
      return res.status(400).json({ ok: false, error: "USER_NOT_FOUND_OR_INVITE_FAILED" });
    }

    // 3) Vincular ao tenant (upsert em memberships)
    const db = createClient(url, svc, { auth: { autoRefreshToken: false, persistSession: false } });
    const { error: upErr } = await db
      .from("memberships")
      .upsert({ tenant_id: tenantId, user_id: userId, role, approved }, { onConflict: "tenant_id,user_id" });

    if (upErr) {
      return res.status(500).json({ ok: false, error: "MEMBERSHIP_UPSERT_FAILED", details: upErr.message });
    }

    return res.status(200).json({ ok: true, user_id: userId });
  } catch (e) {
    return res.status(500).json({ ok: false, error: "UNEXPECTED", details: String(e?.message || e) });
  }
}
