
import { createClient } from '@supabase/supabase-js';
import { Database } from '../types/supabase';

// Hardcoded Supabase credentials. In a production environment, these should be
// stored securely as environment variables.
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://xkzmddgcwcqvhicdqrpa.supabase.co';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inhrem1kZGdjd2NxdmhpY2RxcnBhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTk5OTQwMTYsImV4cCI6MjA3NTU3MDAxNn0.n97hg3mk7namkY4OLpnf-KfqPqV7FGOqad_R-awD2Ko';

if (!supabaseUrl || !supabaseAnonKey) {
  const message = "Supabase URL or anonymous key is missing. The application cannot connect to the database.";
  console.error(message);
  alert(message);
}

export const supabase = createClient<Database>(supabaseUrl!, supabaseAnonKey!);
