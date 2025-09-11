// web/api/owner-invite.js
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const ANON_KEY = process.env.SUPABASE_ANON_KEY; // usado para validar papel via RLS e obter user id
const APP_BASE_URL = process.env.APP_BASE_URL || "https://casa-fin.vercel.app";

export default async function handler(req, res) {
  try {
    if (req.method !== "POST") {
      return res.status(405).json({ error: "Method not allowed" });
    }

    const authHeader = req.headers.authorization || "";
    if (!authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ error: "Missing Authorization Bearer token" });
    }
    const access_token = authHeader.replace("Bearer ", "").trim();

    const { tenant_id, email, role, expires_in_days } = req.body || {};
    if (!tenant_id || !email || !role) {
      return res.status(400).json({ error: "tenant_id, email e role são obrigatórios" });
    }
    const days = Number(expires_in_days ?? 7);
    if (!Number.isFinite(days) || days < 1 || days > 30) {
      return res.status(400).json({ error: "expires_in_days deve estar entre 1 e 30" });
    }

    // Client no contexto do USUÁRIO para validar que é OWNER desse tenant
    const userClient = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: `Bearer ${access_token}` } },
    });

    // 0) Descobre o user_id do chamador (vamos usar em created_by)
    const { data: userInfo, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userInfo?.user?.id) {
      return res.status(401).json({ error: "Sessão inválida ao obter usuário." });
    }
    const ownerUserId = userInfo.user.id;

    // 1) Valida papel de OWNER no tenant
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

    // 2) Gera token de convite via RPC (service role)
    const adminDb = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
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
    if (!token) {
      return res.status(500).json({ error: "Token do convite não retornado pela RPC." });
    }

    // 2.1) ATRIBUI created_by = OWNER (importante p/ RLS/visibilidade)
    const { error: updErr } = await adminDb
      .from("invites")
      .update({ created_by: ownerUserId })
      .eq("token", token);
    if (updErr) {
      // não bloqueia o fluxo de e-mail, mas informa
      console.warn("Falha ao atualizar created_by no invite:", updErr);
    }

    // 3) Dispara e-mail de convite via Supabase Auth
    const adminAuth = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
    const { data: inviteResp, error: inviteErr } =
      await adminAuth.auth.admin.inviteUserByEmail(email, {
        redirectTo: `${APP_BASE_URL}/accept-invite.html?token=${encodeURIComponent(token)}`
      });
    if (inviteErr) {
      return res.status(500).json({ error: `Erro ao enviar e-mail de convite: ${inviteErr.message}` });
    }

    return res.status(200).json({
      ok: true,
      message: "Convite gerado e e-mail enviado.",
      token,
      userId: inviteResp?.user?.id || null,
    });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: "Erro inesperado" });
  }
}

