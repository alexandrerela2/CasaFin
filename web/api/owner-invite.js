// web/api/owner-invite.js
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const ANON_KEY = process.env.SUPABASE_ANON_KEY; // valida papel via RLS e lê user id
const APP_BASE_URL = process.env.APP_BASE_URL || "https://casa-fin.vercel.app";

export default async function handler(req, res) {
  try {
    if (req.method !== "POST") {
      return res.status(405).json({ error: "Method not allowed" });
    }

    // Conferência de variáveis de ambiente
    const missing = [];
    if (!SUPABASE_URL) missing.push("SUPABASE_URL");
    if (!SERVICE_ROLE_KEY) missing.push("SUPABASE_SERVICE_ROLE_KEY");
    if (!ANON_KEY) missing.push("SUPABASE_ANON_KEY");
    if (missing.length) {
      return res.status(500).json({ error: `Variáveis ausentes: ${missing.join(", ")}` });
    }

    const authHeader = req.headers.authorization || "";
    if (!authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ error: "Missing Authorization Bearer token" });
    }
    const access_token = authHeader.replace("Bearer ", "").trim();

    // Corpo da requisição
    const body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : (req.body || {});
    const { tenant_id, email, role, expires_in_days } = body;
    if (!tenant_id || !email || !role) {
      return res.status(400).json({ error: "tenant_id, email e role são obrigatórios" });
    }
    const days = Number(expires_in_days ?? 7);
    if (!Number.isFinite(days) || days < 1 || days > 30) {
      return res.status(400).json({ error: "expires_in_days deve estar entre 1 e 30" });
    }

    // Client no contexto do USUÁRIO (RLS) + obter user_id
    const userClient = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: `Bearer ${access_token}` } },
    });

    // v2: em ambiente server, passe o token explicitamente
    const { data: userInfo, error: userErr } = await userClient.auth.getUser(access_token);
    if (userErr || !userInfo?.user?.id) {
      return res.status(401).json({ error: "Sessão inválida ao obter usuário (auth.getUser)." });
    }
    const ownerUserId = userInfo.user.id;

    // Validar que é OWNER aprovado no tenant
    const { data: ownerCheck, error: ownerErr } = await userClient
      .from("memberships")
      .select("role")
      .eq("tenant_id", tenant_id)
      .eq("role", "owner")
      .eq("approved", true)
      .limit(1);
    if (ownerErr) {
      return res.status(500).json({ error: `Erro ao validar owner: ${ownerErr.message}` });
    }
    if (!ownerCheck || ownerCheck.length === 0) {
      return res.status(403).json({ error: "Ação permitida apenas ao OWNER deste espaço." });
    }

    // Admin client (service role) para RPC e Auth Admin
    const adminDb = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
    const adminAuth = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

    // 1) Gerar token de convite
    const { data: tokenData, error: tokenErr } = await adminDb.rpc("create_invite", {
      p_tenant_id: tenant_id,
      p_email: email,
      p_role: role,
      p_expires_in_days: days,
    });
    if (tokenErr) {
      return res.status(500).json({ error: `Erro ao gerar token: ${tokenErr.message}` });
    }
    const token = typeof tokenData === "string" ? tokenData : tokenData?.token;
    if (!token) return res.status(500).json({ error: "Token do convite não retornado pela RPC." });

    // 1.1) Atribuir created_by para visibilidade em RLS
    const { error: updErr } = await adminDb.from("invites").update({ created_by: ownerUserId }).eq("token", token);
    if (updErr) console.warn("Falha ao atualizar created_by no invite:", updErr);

    // 2) Enviar e-mail de convite (Supabase Auth)
    const redirectTo = `${APP_BASE_URL}/accept-invite.html?token=${encodeURIComponent(token)}`;
    const { data: inviteResp, error: inviteErr } = await adminAuth.auth.admin.inviteUserByEmail(email, { redirectTo });

    // Caso o envio de e-mail falhe (ex.: usuário já existe), retornamos sucesso com o token para fallback manual
    if (inviteErr) {
      console.warn("Falha ao enviar e-mail de convite:", inviteErr);
      return res.status(200).json({
        ok: true,
        emailSent: false,
        token,
        message: `Convite criado, mas falhou o envio automático: ${inviteErr.message}`,
      });
    }

    return res.status(200).json({
      ok: true,
      emailSent: true,
      token,
      userId: inviteResp?.user?.id || null,
      message: "Convite gerado e e-mail enviado.",
    });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: `Falha inesperada: ${e?.message || e}` });
  }
}

