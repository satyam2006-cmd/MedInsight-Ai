import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
export const hasSupabaseEnv = Boolean(supabaseUrl && supabaseAnonKey);

if (!hasSupabaseEnv) {
    console.error('Missing Supabase environment variables. Create frontend/.env with VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.');
}

const safeSupabaseUrl = supabaseUrl || 'https://missing-project.supabase.co';
const safeSupabaseAnonKey = supabaseAnonKey || 'missing-anon-key';

export const supabase = createClient(safeSupabaseUrl, safeSupabaseAnonKey, {
    auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        storage: typeof window !== 'undefined' ? window.localStorage : undefined,
    },
});

