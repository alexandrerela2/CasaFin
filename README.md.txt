# CasaFin — Frontend

## 📌 Estrutura do projeto
- **Raiz do deploy:** `web/`
- **Páginas principais:**
  - `index.html` → Login / cadastro
  - `app.html` → Painel principal do usuário
  - `owner-panel.html` → Gestão do espaço (convites, membros, configs)
  - `forgot-password.html` → Reset de senha
  - `update-password.html` → Definir nova senha
  - `accept-invite.html` → Aceitar convite
- **Config público:** `web/config.js` (URLs do Supabase + redirects)
- **Domínio canônico (produção):** https://casa-fin.vercel.app :contentReference[oaicite:0]{index=0}

## ⚙️ Pré-requisitos
- Conta na **Vercel** com acesso ao repositório.
- Projeto **Supabase** configurado (Auth + SMTP).
- Redirect URLs já registradas no Supabase Auth:
  - `https://casa-fin.vercel.app/update-password.html`
  - `https://casa-fin.vercel.app/accept-invite.html`
  - `https://casa-fin.vercel.app/forgot-password.html` :contentReference[oaicite:1]{index=1}

## 🚀 Deploy pela Vercel (Dashboard)
1. **New Project** → selecione o repositório.  
2. Em **Root Directory**, escolha **`web/`** (obrigatório).  
3. **Build & Output Settings:**  
   - Framework: **Other** (site estático).  
   - Build Command: _(vazio)_  
   - Output Directory: **`web`** (ou deixe vazio, já que a raiz é `web/`).  
4. **Environment Variables:** não são necessárias para o front (usamos `config.js` público).  
5. Deploy. Depois, aponte o domínio para `casa-fin.vercel.app`.:contentReference[oaicite:2]{index=2}

## 🚀 Deploy via CLI (opcional)
```bash
npm i -g vercel
vercel login
vercel --prod --cwd web
