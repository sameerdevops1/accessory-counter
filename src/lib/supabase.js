import { createClient } from '@supabase/supabase-js';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

// True once both environment values are set. The pages show a setup message otherwise.
export const configured = Boolean(url && key);

export const supabase = createClient(url || 'http://localhost:54321', key || 'not-configured');
