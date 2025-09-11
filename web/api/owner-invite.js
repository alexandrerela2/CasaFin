// web/api/owner-invite.js
import { createClient } from "@supabase/supabase-js";
import nodemailer from "nodemailer";

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const ANON_KEY = process.env.SUPABASE_ANON_KEY;
const APP_BASE_URL = process.env.APP_BASE_URL || "https://casa-fin.vercel.app";

const SMTP_HOST = process.env.SMTP_HOST;
const SMTP_PORT = Number(process.env.SMTP_PORT || 465);
const SMTP_USER = process.env.SMTP_USER;
const SMTP_PASS = process.env.SMTP_PASS;
const FROM_NAME  = process.env.FROM_NAME  || "CasaFin";
const FROM_EMAIL = process.env.FROM_EMAIL || SMTP_USER;

export default async function handler(req, res) {
  try {
    if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

    const missing = [];
    if (!SUPABASE_URL) missing.push("SUPABASE_URL");
    if (!SERVICE_ROLE_KEY) missing.push("SUPABASE_SERVICE_ROLE_KEY");
    if (!ANON_KEY) missing.push("SUPABASE_ANON_KEY");
    if (!SMTP_HOST) missing.push("SMTP_HOST");
    if (!SMTP_PORT) missing.push("SMTP_PORT");
    if (!SMTP_USER) missing.push("SMTP_USER");
    if (!SMTP_PASS) missing.push("SMTP_PASS");
    if (missing.length) return res.status(500).json({ error: `Variáveis ausentes: ${missing.join(", ")}` });

    const authHeader = req.headers.authorization || "";
    if (!authHeader.startsWith("Bearer ")) return res.status(401).json({ error: "Missing Authorization Bearer token" });
    const access_token = authHeader.replace("Bearer ", "").trim();

    const body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : (req.body || {});
    const { tenant_id, email, role, expires_in_days } = body;
    if (!tenant_id || !email || !role) return res.status(400).json({ error: "tenant_id, email e role são obrigatórios" });
    const days = Number(expires_in_days ?? 7);
    if (!Number.isFinite(days) || days < 1 || days > 30) return res.status(400).json({ error: "expires_in_days deve estar entre 1 e 30" });

    // Client no contexto do OWNER (RLS)
    const userClient = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: `Bearer ${access_token}` } },
    });

    const { data: userInfo, error: userErr } = await userClient.auth.getUser(access_token);
    if (userErr || !userInfo?.user?.id) return res.status(401).json({ error: "Sessão inválida ao obter usuário." });

    const { data: ownerCheck, error: ownerErr } = await userClient
      .from("memberships")
      .select("role")
      .eq("tenant_id", tenant_id)
      .eq("role", "owner")
      .eq("approved", true)
      .limit(1);
    if (ownerErr) return res.status(500).json({ error: `Erro ao validar owner: ${ownerErr.message}` });
    if (!ownerCheck || ownerCheck.length === 0) return res.status(403).json({ error: "Ação permitida apenas ao OWNER deste espaço." });

    // 1) Gera token do convite via RPC (usa auth.uid())
    const { data: tokenData, error: tokenErr } = await userClient.rpc("create_invite", {
      p_tenant_id: tenant_id,
      p_email: email,
      p_role: role,
      p_expires_in_days: days,
    });
    if (tokenErr) return res.status(500).json({ error: `Erro ao gerar token: ${tokenErr.message}` });
    const token = typeof tokenData === "string" ? tokenData : tokenData?.token;
    if (!token) return res.status(500).json({ error: "Token do convite não retornado pela RPC." });

    // 2) Garante usuário no Auth; se já existir, ok
    const adminAuth = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
    await adminAuth.auth.admin.createUser({ email }).catch(() => {});

    // 3) Link de definição de senha (recovery) com redirect para aceitar convite
    const nextAfterPassword = `/accept-invite.html?token=${encodeURIComponent(token)}`;
    const redirectTo = `${APP_BASE_URL}/update-password.html?next=${encodeURIComponent(nextAfterPassword)}`;

    const { data: linkData, error: linkErr } = await adminAuth.auth.admin.generateLink({
      type: "recovery",
      email,
      options: { redirectTo }
    });
    if (linkErr) {
      return res.status(200).json({
        ok: true,
        emailSent: false,
        token,
        actionLink: null,
        message: `Convite criado, mas falhou a geração do link de senha: ${linkErr.message}`
      });
    }
    const actionLink =
      linkData?.properties?.action_link || linkData?.action_link || linkData?.email_otp?.action_link;

    // 4) SMTP: verifica conexão e envia
    const transporter = nodemailer.createTransport({
      host: SMTP_HOST,
      port: SMTP_PORT,
      secure: SMTP_PORT === 465,
      auth: { user: SMTP_USER, pass: SMTP_PASS }
    });

    try {
      await transporter.verify();
    } catch (vErr) {
      console.error("SMTP verify error:", vErr);
      return res.status(500).json({ error: `Falha SMTP (verify): ${vErr.message}`, token, actionLink });
    }

    const html = `
      <p>Olá,</p>
      <p>Você foi convidado para acessar o <strong>CasaFin</strong>.</p>
      <p><strong>Antes de entrar, defina sua senha</strong> clicando no botão abaixo:</p>
      <p><a href="${actionLink}" style="display:inline-block;padding:10px 14px;border-radius:8px;background:#1f883d;color:#fff;text-decoration:none" target="_blank" rel="noopener">Definir senha e entrar</a></p>
      <p>Se o botão não funcionar, copie e cole este link no navegador:</p>
      <p style="word-break:break-all">${actionLink}</p>
      <hr/>
      <p>Caso não reconheça este convite, ignore este e-mail.</p>
    `;

    let info;
    try {
      info = await transporter.sendMail({
        from: `"${FROM_NAME}" <${FROM_EMAIL}>`,
        to: email,
        subject: "CasaFin • Defina sua senha para acessar",
        html
      });
      console.log("SMTP sendMail info:", {
        messageId: info?.messageId,
        accepted: info?.accepted,
        rejected: info?.rejected
      });
    } catch (sendErr) {
      console.error("SMTP sendMail error:", sendErr);
      return res.status(200).json({
        ok: true,
        emailSent: false,
        token,
        actionLink,
        message: `Convite criado, mas falhou o envio SMTP: ${sendErr.message}`
      });
    }

    return res.status(200).json({
      ok: true,
      emailSent: true,
      token,
      actionLink,
      smtp: {
        messageId: info?.messageId || null,
        accepted: info?.accepted || [],
        rejected: info?.rejected || []
      },
      message: "Convite gerado e e-mail enviado (definição de senha obrigatória)."
    });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: `Falha inesperada: ${e?.message || e}` });
  }
}
