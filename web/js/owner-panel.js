// web/js/owner-panel.js (trecho addMember ATUALIZADO)
async function addMember(){
  if (!currentTenant) { toast("Selecione um tenant (botão Membros)."); return; }
  const email = document.getElementById("memEmail").value.trim();
  const role  = document.getElementById("memRole").value;
  const approved = document.getElementById("memApproved").checked;
  if (!email) { toast("Informe o e-mail."); return; }

  try {
    // 1) tenta via RPC (se o e-mail já existe no Auth)
    const up = await supa.rpc("invite_member_by_email", {
      p_tenant: currentTenant.id, p_email: email, p_role: role, p_approved: approved
    });
    if (up.error) throw up.error;

    let inviteLink = null;

    if (!up.data?.ok) {
      // 2) chama API serverless para criar/invitar + retornar link
      const { data:{ session } } = await supa.auth.getSession();
      const resp = await fetch("/api/invite-user", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${session?.access_token || ""}`
        },
        body: JSON.stringify({ tenantId: currentTenant.id, email, role, approved })
      });

      const ctype = resp.headers.get("content-type") || "";
      const isJson = ctype.includes("application/json");
      const payload = isJson ? await resp.json()
                             : { ok:false, error:`HTTP_${resp.status}`, details:(await resp.text()).slice(0,180) };

      if (!resp.ok || !payload?.ok) {
        throw new Error(payload?.error || payload?.details || `HTTP ${resp.status}`);
      }
      inviteLink = payload.invite_link || null;
    }

    document.getElementById("memEmail").value = "";
    await listMembers(currentTenant);

    if (inviteLink) {
      try {
        await navigator.clipboard.writeText(inviteLink);
        toast("Convite enviado. Link copiado para a área de transferência.");
      } catch {
        alert("Convite enviado. Link de acesso:\n\n" + inviteLink);
      }
    } else {
      toast("Convite processado com sucesso.");
    }
  } catch (e) {
    console.error(e);
    toast("Erro ao adicionar/atualizar: " + (e?.message || e));
  }
}

