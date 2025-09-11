// web/lib/supabase.js
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.47.0";

const { SUPABASE_URL, SUPABASE_ANON_KEY } = window.CASAFIN || {};
export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
