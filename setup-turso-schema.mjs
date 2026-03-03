// Script to create Turso database schema matching the Supabase schema
import { createClient } from "@libsql/client";

const turso = createClient({
    url: "libsql://visit-checklist-ragilrrr.aws-ap-northeast-1.turso.io",
    authToken: "eyJhbGciOiJFZERTQSIsInR5cCI6IkpXVCJ9.eyJhIjoicnciLCJpYXQiOjE3NzIxODU5MzEsImlkIjoiMDE5YzllM2EtNzAwMS03ZjFkLThiMGYtYjU5YzIzZTdmMTk5IiwicmlkIjoiNTU0Y2NlNWUtNDNhOC00NzhlLWE5NjQtMWFhMDEzYjZmZmY1In0.BxM9ZGJSaMXDcBjSPH3g2ivApAjb5wpR8IWdosO3f_yqQErcfZNlzMc7rQGjnPXO5zgXAURirwwN9KbMbadMDQ",
});

async function createSchema() {
    console.log("Creating Turso database schema...");

    // 1. USERS Table
    await turso.execute(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      name TEXT,
      email TEXT UNIQUE,
      role TEXT NOT NULL DEFAULT 'Auditor' CHECK(role IN ('Admin', 'Auditor')),
      avatar_url TEXT,
      location TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    )
  `);
    console.log("✅ users table created");

    // 2. OUTLETS Table
    await turso.execute(`
    CREATE TABLE IF NOT EXISTS outlets (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      address TEXT,
      manager_id TEXT REFERENCES users(id) ON DELETE SET NULL,
      created_at TEXT DEFAULT (datetime('now'))
    )
  `);
    console.log("✅ outlets table created");

    // 3. CHECKLIST_TEMPLATES Table
    await turso.execute(`
    CREATE TABLE IF NOT EXISTS checklist_templates (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      items TEXT DEFAULT '[]',
      created_at TEXT DEFAULT (datetime('now'))
    )
  `);
    console.log("✅ checklist_templates table created");

    // 4. CHECKLISTS Table
    await turso.execute(`
    CREATE TABLE IF NOT EXISTS checklists (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      location TEXT,
      assigned_to TEXT REFERENCES users(id) ON DELETE SET NULL,
      due_date TEXT,
      status TEXT CHECK(status IN ('pending', 'in-progress', 'completed')),
      items TEXT DEFAULT '[]',
      check_in_time TEXT,
      check_out_time TEXT,
      auditor_signature TEXT,
      report_url TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    )
  `);
    console.log("✅ checklists table created");

    // 5. TASKS Table
    await turso.execute(`
    CREATE TABLE IF NOT EXISTS tasks (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      checklist_item_id TEXT,
      priority TEXT CHECK(priority IN ('Low', 'Medium', 'High')),
      assigned_to TEXT REFERENCES users(id) ON DELETE SET NULL,
      due_date TEXT,
      status TEXT CHECK(status IN ('open', 'in-progress', 'resolved')),
      description TEXT,
      photo TEXT,
      proof_of_fix TEXT,
      checklist_id TEXT REFERENCES checklists(id) ON DELETE CASCADE,
      created_at TEXT DEFAULT (datetime('now'))
    )
  `);
    console.log("✅ tasks table created");

    // 6. EMAIL_RECIPIENTS Table
    await turso.execute(`
    CREATE TABLE IF NOT EXISTS email_recipients (
      id TEXT PRIMARY KEY,
      email TEXT NOT NULL,
      name TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    )
  `);
    console.log("✅ email_recipients table created");

    console.log("\n🎉 All tables created successfully!");

    // Verify tables
    const result = await turso.execute("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name");
    console.log("\nTables in database:");
    for (const row of result.rows) {
        console.log(`  - ${row.name}`);
    }
}

createSchema().catch(console.error);
