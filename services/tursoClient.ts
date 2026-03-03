import { createClient } from "@libsql/client";

const url = (import.meta as any).env?.VITE_TURSO_DATABASE_URL as string | undefined;
const authToken = (import.meta as any).env?.VITE_TURSO_AUTH_TOKEN as string | undefined;

const isConfigured = !!url && !!authToken;

if (!isConfigured) {
  console.error('Turso configuration missing. Please set VITE_TURSO_DATABASE_URL and VITE_TURSO_AUTH_TOKEN in your .env file.');
}

export const turso = createClient({
  url: url || 'libsql://example.turso.io',
  authToken: authToken || 'your-auth-token',
});
