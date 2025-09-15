import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const { SUPABASE_URL, SUPABASE_ANON_KEY } = window.CASAFIN;
export const supa = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

export function isPlatformOwner(user){
  return user?.app_metadata?.app_role === 'owner';
}

export async function requireAuth(){
  const { data:{ session } } = await supa.auth.getSession();
  if(!session){ window.location.href = '/index.html'; throw new Error('Not logged'); }
}

export async function signOutAndGoHome(){
  await supa.auth.signOut();
  window.location.href = '/index.html';
}

export async function getSessionTenant(){
  const { data:{ user } } = await supa.auth.getUser();
  // Para Owner plataforma, não force tenant
  if (isPlatformOwner(user)) return { user, tenant: null };

  const { data: ms } = await supa
    .from('memberships')
    .select('tenant_id, role, tenants(name, id)')
    .eq('user_id', user.id)
    .limit(1)
    .maybeSingle();

  return { user, tenant: ms ? { id: ms.tenant_id, name: ms.tenants?.name, role: ms.role, user_id: user.id } : null };
}

export async function redirectAfterLogin(){
  const { data:{ user } } = await supa.auth.getUser();
  if (isPlatformOwner(user)) window.location.href = '/owner-panel.html';
  else window.location.href = '/app.html';
}
