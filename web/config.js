<script>
  // Configurações públicas do front (OK para ficar no cliente)
  window.CASAFIN = {
    SUPABASE_URL: "https://viiwumqjunvxtufejcgf.supabase.co",
    // Chave pública (anon) do projeto – vem do Bloco Único V5
    SUPABASE_ANON_KEY:
      "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZpaXd1bXFqdW52eHR1ZmVqY2dmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTc0MzA5MjcsImV4cCI6MjA3MzAwNjkyN30.-70ZnKPoMxUxAMmZ1MoCs-DcTtNmjm0_9x5L3d-03B8",
    APP_BASE_URL: "https://casa-fin.vercel.app",
    REDIRECTS: {
      POST_LOGIN_OWNER: "/owner-panel.html",
      POST_LOGIN_DEFAULT: "/app.html",
      NOT_LOGGED: "/index.html"
    }
  };
</script>

