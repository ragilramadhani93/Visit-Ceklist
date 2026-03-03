import { createClient } from "@libsql/client";
import dotenv from "dotenv";

dotenv.config();

const turso = createClient({
    url: process.env.VITE_TURSO_DATABASE_URL as string,
    authToken: process.env.VITE_TURSO_AUTH_TOKEN as string,
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
    } catch (e) {
        console.error("Failed to create table:", e);
    }
}

run();
