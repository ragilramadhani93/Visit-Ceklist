import os

file_path = "d:/PROJECT CHECKLIST VISIT/components/admin/EmailConfigView.tsx"

with open(file_path, "r", encoding="utf-8") as f:
    content = f.read()

# Add turso import
content = content.replace(
    "import { supabase } from '../../services/supabaseClient';",
    "import { supabase } from '../../services/supabaseClient';\nimport { turso } from '../../services/tursoClient';"
)

# Replace fetchRecipients
old_fetch = """    const { data, error } = await supabase
      .from('email_recipients')
      .select('*')
      .order('created_at', { ascending: false });"""
new_fetch = """    let data: any = null;
    let error: any = null;
    try {
      const res = await turso.execute('SELECT * FROM email_recipients ORDER BY created_at DESC');
      data = res.rows;
    } catch (e: any) { error = e; }"""
content = content.replace(old_fetch, new_fetch)

# Replace addRecipient
old_add = """    const { data, error } = await (supabase as any).rpc('add_email_recipient', {
      p_email: newEmail,
      p_name: newName || newEmail.split('@')[0],
    });"""
new_add = """    let error: any = null;
    try {
      await turso.execute({ 
        sql: 'INSERT INTO email_recipients (id, email, name) VALUES (?, ?, ?)', 
        args: [crypto.randomUUID(), newEmail, newName || newEmail.split('@')[0]] 
      });
    } catch (e: any) { error = e; }"""
content = content.replace(old_add, new_add)

# Replace deleteRecipient
old_delete = """    const { error } = await supabase
      .from('email_recipients')
      .delete()
      .eq('id', id);"""
new_delete = """    let error: any = null;
    try {
      await turso.execute({ sql: 'DELETE FROM email_recipients WHERE id = ?', args: [id] });
    } catch (e: any) { error = e; }"""
content = content.replace(old_delete, new_delete)

with open(file_path, "w", encoding="utf-8") as f:
    f.write(content)

# Fix import in ChecklistItem.tsx
cl_path = "d:/PROJECT CHECKLIST VISIT/components/checklist/ChecklistItem.tsx"
with open(cl_path, "r", encoding="utf-8") as f:
    cl_content = f.read()

cl_content = cl_content.replace(
    "import { uploadPublic } from '../../services/supabaseClient';",
    "import { uploadPublic } from '../../services/storageClient';"
)

with open(cl_path, "w", encoding="utf-8") as f:
    f.write(cl_content)

print("Done phase 2")
