import { createClient } from "@libsql/client";

const turso = createClient({
    url: process.env.VITE_TURSO_DATABASE_URL,
    authToken: process.env.VITE_TURSO_AUTH_TOKEN,
});

async function run() {
    console.log("Creating whatsapp_recipients table...");
    try {
        await turso.execute(`
            CREATE TABLE IF NOT EXISTS whatsapp_recipients (
                id TEXT PRIMARY KEY,
                phone_number TEXT NOT NULL UNIQUE,
                name TEXT,
                created_at TEXT DEFAULT (datetime('now'))
            )
        `);
        console.log("✅ whatsapp_recipients table created");
        
        const res = await turso.execute("SELECT name FROM sqlite_master WHERE type='table';");
        console.log("Tables:", res.rows.map(r => r.name));
    } catch (e) {
        console.error("Failed to create table:", e);
    }
}

run();
