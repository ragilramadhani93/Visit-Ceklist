import os

file_path = "d:/PROJECT CHECKLIST VISIT/App.tsx"

with open(file_path, "r", encoding="utf-8") as f:
    content = f.read()

# 1. Imports
content = content.replace(
    "import { supabase } from './services/supabaseClient';",
    "import { supabase } from './services/supabaseClient';\nimport { turso } from './services/tursoClient';\nimport { uploadPublic } from './services/storageClient';"
)

# 2. setupUserSession (fetch user)
old_fetch_user = """        const { data: userProfile, error } = await supabase
          .from('users')
          .select('*')
          .eq('id', userId)
          .single();"""
new_fetch_user = """        let userProfile: any = null;
        let error: any = null;
        try {
          const res = await turso.execute({ sql: 'SELECT * FROM users WHERE id = ?', args: [userId] });
          if (res.rows.length > 0) userProfile = res.rows[0];
          else error = { code: 'PGRST116', message: 'Not found' };
        } catch (e: any) { error = e; }"""
content = content.replace(old_fetch_user, new_fetch_user)

# 3. setupUserSession (insert user)
old_insert_user = """        const { data: newUserProfile, error: insertError } = await (supabase.from('users') as any)
          .insert({ id: userId, email: userEmail, role: Role.Auditor }) // Sensible defaults
          .select()
          .single();"""
new_insert_user = """        let newUserProfile: any = null;
        let insertError: any = null;
        try {
          await turso.execute({ sql: 'INSERT INTO users (id, email, role) VALUES (?, ?, ?)', args: [userId, userEmail, Role.Auditor] });
          const res = await turso.execute({ sql: 'SELECT * FROM users WHERE id = ?', args: [userId] });
          newUserProfile = res.rows[0];
        } catch (e: any) { insertError = e; }"""
content = content.replace(old_insert_user, new_insert_user)

# 4. fetchData (bulk fetch)
old_fetch_data = """        const [usersRes, checklistsRes, tasksRes, templatesRes, outletsRes] = await Promise.all([
            supabase.from('users').select('*'),
            supabase.from('checklists').select('*'),
            supabase.from('tasks').select('*'),
            supabase.from('checklist_templates').select('*'),
            supabase.from('outlets').select('*'),
        ]);"""
new_fetch_data = """        const processJSON = (rows: any[], cols: string[]) => rows.map((r: any) => { 
           const newR = { ...r };
           cols.forEach(c => { if (typeof newR[c] === 'string') { try { newR[c] = JSON.parse(newR[c]); } catch {} } }); 
           return newR; 
        });

        const fetchAll = async (table: string) => {
           try { const res = await turso.execute(`SELECT * FROM ${table}`); return { data: res.rows as any[] }; }
           catch (error) { return { error }; }
        };

        const [usersRes, checklistsRes, tasksRes, templatesRes, outletsRes] = await Promise.all([
            fetchAll('users'), fetchAll('checklists'), fetchAll('tasks'), fetchAll('checklist_templates'), fetchAll('outlets')
        ]);
        if (checklistsRes.data) checklistsRes.data = processJSON(checklistsRes.data, ['items']);
        if (templatesRes.data) templatesRes.data = processJSON(templatesRes.data, ['items']);"""
content = content.replace(old_fetch_data, new_fetch_data)

# 5. handleUpdateUser
old_update_user = """    const { data, error } = await (supabase.from('users') as any).update(updateData).eq('id', id).select();"""
new_update_user = """    let data: any = null;
    let error: any = null;
    try {
      const sets = Object.keys(updateData).map(k => `${k} = ?`).join(', ');
      const values = Object.values(updateData);
      await turso.execute({ sql: `UPDATE users SET ${sets} WHERE id = ?`, args: [...values, id] });
      const res = await turso.execute({ sql: 'SELECT * FROM users WHERE id = ?', args: [id] });
      data = res.rows;
    } catch (e: any) { error = e; }"""
content = content.replace(old_update_user, new_update_user)

# 6. handleDeleteUser
old_delete_user = """        const { error } = await supabase.from('users').delete().eq('id', userId);"""
new_delete_user = """        let error: any = null;
        try { await turso.execute({ sql: 'DELETE FROM users WHERE id = ?', args: [userId] }); }
        catch (e: any) { error = e; }"""
content = content.replace(old_delete_user, new_delete_user)

# 7. handleSaveTemplate
old_save_template = """    const { data, error } = await (supabase.from('checklist_templates') as any)
      .upsert(payload)
      .select()
      .single();"""
new_save_template = """    let data: any = null;
    let error: any = null;
    try {
      const itemsJson = JSON.stringify(payload.items);
      const isUpdate = payload.id !== undefined;
      // SQLite doesn't have standard UPSERT easily without knowing fields. Since ID is uuid, we do replace or insert.
      // But we just use explicit UPDATE or INSERT
      let newId = payload.id;
      if (isUpdate) {
          await turso.execute({ sql: 'UPDATE checklist_templates SET title = ?, items = ? WHERE id = ?', args: [payload.title, itemsJson, payload.id] });
      } else {
          newId = crypto.randomUUID();
          await turso.execute({ sql: 'INSERT INTO checklist_templates (id, title, items) VALUES (?, ?, ?)', args: [newId, payload.title, itemsJson] });
      }
      const res = await turso.execute({ sql: 'SELECT * FROM checklist_templates WHERE id = ?', args: [newId] });
      data = res.rows[0];
      if (data && typeof data.items === 'string') data.items = JSON.parse(data.items);
    } catch (e: any) { error = e; }"""
content = content.replace(old_save_template, new_save_template)

# 8. handleAddOutlet
old_add_outlet = """    const { data, error } = await (supabase.from('outlets') as any)
      .insert(newOutlet)
      .select()
      .single();"""
new_add_outlet = """    let data: any = null;
    let error: any = null;
    try {
      const keys = Object.keys(newOutlet).join(', ');
      const placeholders = Object.keys(newOutlet).map(() => '?').join(', ');
      const values = Object.values(newOutlet);
      const newId = crypto.randomUUID();
      await turso.execute({ sql: `INSERT INTO outlets (id, ${keys}) VALUES (?, ${placeholders})`, args: [newId, ...values] });
      const res = await turso.execute({ sql: 'SELECT * FROM outlets WHERE id = ?', args: [newId] });
      data = res.rows[0];
    } catch (e: any) { error = e; }"""
content = content.replace(old_add_outlet, new_add_outlet)

# 9. handleUpdateOutlet
old_update_outlet = """    const { data, error } = await (supabase.from('outlets') as any)
      .update(updateData)
      .eq('id', id)
      .select()
      .single();"""
new_update_outlet = """    let data: any = null;
    let error: any = null;
    try {
      const sets = Object.keys(updateData).map(k => `${k} = ?`).join(', ');
      const values = Object.values(updateData);
      await turso.execute({ sql: `UPDATE outlets SET ${sets} WHERE id = ?`, args: [...values, id] });
      const res = await turso.execute({ sql: 'SELECT * FROM outlets WHERE id = ?', args: [id] });
      data = res.rows[0];
    } catch (e: any) { error = e; }"""
content = content.replace(old_update_outlet, new_update_outlet)

# 10. handleDeleteOutlet
old_delete_outlet = """      const { error } = await supabase.from('outlets').delete().eq('id', outletId);"""
new_delete_outlet = """      let error: any = null;
      try { await turso.execute({ sql: 'DELETE FROM outlets WHERE id = ?', args: [outletId] }); }
      catch (e: any) { error = e; }"""
content = content.replace(old_delete_outlet, new_delete_outlet)

# 11. handleCreateAssignments
old_create_assign = """      const { data, error } = await (supabase.from('checklists') as any)
        .insert(newChecklists)
        .select();"""
new_create_assign = """      let data: any = null;
      let error: any = null;
      try {
        data = [];
        for (const cl of newChecklists) {
            const clId = crypto.randomUUID();
            const keys = Object.keys(cl).filter(k => k !== 'items').join(', ');
            const placeholders = Object.keys(cl).filter(k => k !== 'items').map(() => '?').join(', ');
            const values = Object.keys(cl).filter(k => k !== 'items').map(k => (cl as any)[k]);
            await turso.execute({ sql: `INSERT INTO checklists (id, items, ${keys}) VALUES (?, ?, ${placeholders})`, args: [clId, JSON.stringify(cl.items), ...values] });
            const res = await turso.execute({ sql: 'SELECT * FROM checklists WHERE id = ?', args: [clId] });
            const inserted = res.rows[0];
            if (inserted && typeof inserted.items === 'string') inserted.items = JSON.parse(inserted.items);
            data.push(inserted);
        }
      } catch (e: any) { error = e; }"""
content = content.replace(old_create_assign, new_create_assign)

# 12. uploadFile
old_upload = """  const uploadFile = async (bucket: string, file: Blob | File, fileName: string): Promise<string> => {
    const { data, error } = await supabase.storage.from(bucket).upload(fileName, file, {
        cacheControl: '3600',
        upsert: true,
    });
    if (error) {
        throw new Error(`Storage upload error: ${error.message}`);
    }
    const { data: { publicUrl } } = supabase.storage.from(bucket).getPublicUrl(data.path);
    return publicUrl;
  };"""
new_upload = """  const uploadFile = async (bucket: string, file: Blob | File, fileName: string): Promise<string> => {
    return await uploadPublic(bucket, file, fileName);
  };"""
content = content.replace(old_upload, new_upload)

# 13. handleChecklistSubmit - tasks insert
old_tasks_insert = """          const { data: createdTasks, error: taskError } = await (supabase.from('tasks') as any)
              .insert(newTasks)
              .select();"""
new_tasks_insert = """          let createdTasks: any = null;
          let taskError: any = null;
          try {
            createdTasks = [];
            for (const task of newTasks) {
                const taskId = crypto.randomUUID();
                const keys = Object.keys(task).join(', ');
                const placeholders = Object.keys(task).map(() => '?').join(', ');
                const values = Object.values(task);
                await turso.execute({ sql: `INSERT INTO tasks (id, ${keys}) VALUES (?, ${placeholders})`, args: [taskId, ...values] });
                const res = await turso.execute({ sql: 'SELECT * FROM tasks WHERE id = ?', args: [taskId] });
                createdTasks.push(res.rows[0]);
            }
          } catch (e: any) { taskError = e; }"""
content = content.replace(old_tasks_insert, new_tasks_insert)

# 14. handleChecklistSubmit - update checklist
old_update_checklist = """      const { data, error } = await (supabase.from('checklists') as any)
          .update(updateData)
          .eq('id', id)
          .select()
          .single();"""
new_update_checklist = """      let data: any = null;
      let error: any = null;
      try {
        const updateDataDb = { ...updateData, items: JSON.stringify(updateData.items) };
        const sets = Object.keys(updateDataDb).map(k => `${k} = ?`).join(', ');
        const values = Object.values(updateDataDb);
        await turso.execute({ sql: `UPDATE checklists SET ${sets} WHERE id = ?`, args: [...values, id] });
        const res = await turso.execute({ sql: 'SELECT * FROM checklists WHERE id = ?', args: [id] });
        data = res.rows[0];
        if (data && typeof data.items === 'string') data.items = JSON.parse(data.items);
      } catch (e: any) { error = e; }"""
content = content.replace(old_update_checklist, new_update_checklist)


# 15. handleResolveTask
old_resolve_task = """    const { data, error } = await (supabase.from('tasks') as any)
        .update(updatePayload)
        .eq('id', taskId)
        .select()
        .single();"""
new_resolve_task = """    let data: any = null;
    let error: any = null;
    try {
      const sets = Object.keys(updatePayload).map(k => `${k} = ?`).join(', ');
      const values = Object.values(updatePayload);
      await turso.execute({ sql: `UPDATE tasks SET ${sets} WHERE id = ?`, args: [...values, taskId] });
      const res = await turso.execute({ sql: 'SELECT * FROM tasks WHERE id = ?', args: [taskId] });
      data = res.rows[0];
    } catch (e: any) { error = e; }"""
content = content.replace(old_resolve_task, new_resolve_task)

# 16. handleUpdateAssignment
old_update_assignment = """    const { data, error } = await (supabase.from('checklists') as any)
      .update(updates)
      .eq('id', checklistId)
      .select()
      .single();"""
new_update_assignment = """    let data: any = null;
    let error: any = null;
    try {
      const updateDataDb = { ...updates };
      if (updateDataDb.items) updateDataDb.items = JSON.stringify(updateDataDb.items) as any;
      const sets = Object.keys(updateDataDb).map(k => `${k} = ?`).join(', ');
      const values = Object.values(updateDataDb);
      await turso.execute({ sql: `UPDATE checklists SET ${sets} WHERE id = ?`, args: [...values, checklistId] });
      const res = await turso.execute({ sql: 'SELECT * FROM checklists WHERE id = ?', args: [checklistId] });
      data = res.rows[0];
      if (data && typeof data.items === 'string') data.items = JSON.parse(data.items);
    } catch (e: any) { error = e; }"""
content = content.replace(old_update_assignment, new_update_assignment)

# 17. handleCancelAssignment
old_cancel_assignment = """    const { error } = await supabase.from('checklists').delete().eq('id', checklistId);"""
new_cancel_assignment = """    let error: any = null;
    try { await turso.execute({ sql: 'DELETE FROM checklists WHERE id = ?', args: [checklistId] }); }
    catch (e: any) { error = e; }"""
content = content.replace(old_cancel_assignment, new_cancel_assignment)

# 18. handleAssignTask
old_assign_task = """    const { data, error } = await (supabase.from('tasks') as any)
      .update({ assigned_to: assigneeId })
      .eq('id', taskId)
      .select()
      .single();"""
new_assign_task = """    let data: any = null;
    let error: any = null;
    try {
      await turso.execute({ sql: `UPDATE tasks SET assigned_to = ? WHERE id = ?`, args: [assigneeId, taskId] });
      const res = await turso.execute({ sql: 'SELECT * FROM tasks WHERE id = ?', args: [taskId] });
      data = res.rows[0];
    } catch (e: any) { error = e; }"""
content = content.replace(old_assign_task, new_assign_task)

with open(file_path, "w", encoding="utf-8") as f:
    f.write(content)
