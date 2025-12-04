
import { createClient } from '@supabase/supabase-js';
import { Database } from '../types/supabase';

const supabaseUrl = (import.meta as any).env?.VITE_SUPABASE_URL as string | undefined;
const supabaseAnonKey = (import.meta as any).env?.VITE_SUPABASE_ANON_KEY as string | undefined;

const isConfigured = !!supabaseUrl && !!supabaseAnonKey;

if (!isConfigured) {
  const message = 'Supabase configuration missing. Please set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.';
  console.error(message);
}

const fallbackUrl = supabaseUrl || 'https://example.supabase.co';
const fallbackAnonKey = supabaseAnonKey || 'public-anon-key';

export const supabase = createClient<Database>(fallbackUrl, fallbackAnonKey);
