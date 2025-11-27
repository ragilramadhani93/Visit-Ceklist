# Field Ops Pro with Supabase Integration

This document outlines the steps required to set up the Field Ops Pro application with a Supabase backend.

## 1. Create a Supabase Project

1.  Go to [supabase.com](https://supabase.com) and create a new project.
2.  Once your project is created, navigate to the **Project Settings** > **API** section.
3.  Keep this page open. You will need the **Project URL** and the **`anon` public key**.

## 2. Environment Variables

This application expects your Gemini API key to be available as an environment variable to enable the AI analysis feature. The Supabase connection is pre-configured.

-   `API_KEY`: Your Google Gemini API Key (for the AI analysis feature). If not provided, AI features will be disabled.

## 3. Database Schema Setup

Navigate to the **SQL Editor** in your Supabase project dashboard and run the following SQL script to create the necessary tables and policies. This script includes a trigger to automatically create user profiles when you add users via the Supabase Authentication dashboard.

**Note:** Running this script will drop and recreate existing tables, clearing any data within them. This ensures a clean and correct setup.

```sql
-- This script is designed to be run multiple times.
-- It will drop existing functions, triggers, tables, and types to ensure a clean setup.

-- Drop trigger and function first
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS public.handle_new_user;

-- Drop existing tables. The order is important due to foreign key constraints.
DROP TABLE IF EXISTS public.tasks;
DROP TABLE IF EXISTS public.checklists;
DROP TABLE IF EXISTS public.outlets; -- Drop outlets before users
DROP TABLE IF EXISTS public.users;
DROP TABLE IF EXISTS public.checklist_templates;

-- Drop custom types. This must be done after dropping tables that use them.
DROP TYPE IF EXISTS public.checklist_status;
DROP TYPE IF EXISTS public.task_status;
DROP TYPE IF EXISTS public.task_priority;
DROP TYPE IF EXISTS public.role;


-- Create custom types for roles and priorities
CREATE TYPE public.role AS ENUM ('Admin', 'Auditor');
CREATE TYPE public.task_priority AS ENUM ('Low', 'Medium', 'High');
CREATE TYPE public.task_status AS ENUM ('open', 'in-progress', 'resolved');
CREATE TYPE public.checklist_status AS ENUM ('pending', 'in-progress', 'completed');

-- 1. USERS Table
-- This table stores public profile data and is linked to auth.users.
CREATE TABLE public.users (
    id uuid NOT NULL PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    -- FIX: The 'name' column is explicitly set to NULL to prevent errors when
    -- a user is created via authentication without a name. The application UI
    -- is designed to handle null names gracefully.
    name text NULL,
    email text UNIQUE,
    role public.role NOT NULL DEFAULT 'Auditor',
    avatar_url text,
    location text,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);

-- Function to create a public user profile when a new auth user signs up
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER -- Use administrator privileges to insert into public.users
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.users (id, email, name, role)
  VALUES (NEW.id, NEW.email, NEW.raw_user_meta_data->>'name', 'Auditor'); -- Default new users to 'Auditor'
  RETURN NEW;
END;
$$;

-- Trigger to call the function after a new user is created in auth.users
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- 2. OUTLETS Table
CREATE TABLE public.outlets (
    id uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
    name text NOT NULL,
    address text,
    manager_id uuid REFERENCES public.users(id) ON DELETE SET NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);

-- 3. CHECKLIST TEMPLATES Table
CREATE TABLE public.checklist_templates (
    id uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
    title text NOT NULL,
    items jsonb,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);

-- 4. CHECKLISTS Table
CREATE TABLE public.checklists (
    id uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
    title text NOT NULL,
    location text,
    assigned_to uuid REFERENCES public.users(id) ON DELETE SET NULL,
    due_date date,
    status public.checklist_status,
    items jsonb,
    check_in_time timestamp with time zone,
    check_out_time timestamp with time zone,
    auditor_signature text,
    report_url text, -- To store the URL of the generated PDF report
    created_at timestamp with time zone DEFAULT now() NOT NULL
);

-- 5. TASKS Table
CREATE TABLE public.tasks (
    id uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
    title text NOT NULL,
    checklist_item_id text,
    priority public.task_priority,
    assigned_to uuid REFERENCES public.users(id) ON DELETE SET NULL,
    due_date date,
    status public.task_status,
    description text,
    photo text,
    proof_of_fix text,
    checklist_id uuid REFERENCES public.checklists(id) ON DELETE CASCADE,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


-- Enable Row Level Security (RLS)
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.outlets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.checklist_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.checklists ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;


-- Create Policies to allow public access (for anonymous key)
-- NOTE: For a production app, you would create more restrictive policies based on user authentication.
CREATE POLICY "Allow public full access" ON public.users FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow public full access" ON public.outlets FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow public full access" ON public.checklist_templates FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow public full access" ON public.checklists FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow public full access" ON public.tasks FOR ALL USING (true) WITH CHECK (true);
```

## 4. User Setup (IMPORTANT)

User management is now handled by **Supabase Authentication**. You must create users here for them to be able to log in.

1.  In your Supabase project dashboard, navigate to the **Authentication** section.
2.  Under the **Users** tab, click **"Add user"**.
3.  Enter the user's email and create a secure password for them.
4.  Click **"Add user"**. The trigger you set up in the SQL script will automatically create a corresponding profile in the `public.users` table.
5.  **To create an Admin user:** After creating a user, log in to the app with your Admin account, go to **User Management**, and change the new user's role from "Auditor" (the default) to "Admin".

## 5. Supabase Storage Setup

You will need two storage buckets for this application: one for photos and one for PDF reports.

### Bucket 1: `field-ops-photos`

1.  In your Supabase project, go to the **Storage** section.
2.  Click **New bucket**.
3.  Name the bucket `field-ops-photos` and check the **Public bucket** option.
4.  Click **Create bucket**.
5.  Go to the **SQL Editor** and run the following script to set up access policies for photo uploads.

```sql
-- Drop existing policies if they exist, to ensure a clean setup.
DROP POLICY IF EXISTS "Public read access for field-ops-photos" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated uploads for field-ops-photos" ON storage.objects;

-- Policy: Allow public read access to all files in the 'field-ops-photos' bucket.
CREATE POLICY "Public read access for field-ops-photos"
ON storage.objects FOR SELECT
USING ( bucket_id = 'field-ops-photos' );

-- Policy: Allow any authenticated user to upload files to the 'field-ops-photos' bucket.
CREATE POLICY "Allow authenticated uploads for field-ops-photos"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK ( bucket_id = 'field-ops-photos' );
```

### Bucket 2: `field-ops-reports`

1.  In the **Storage** section, click **New bucket** again.
2.  Name the bucket `field-ops-reports` and check the **Public bucket** option.
3.  Click **Create bucket**.
4.  Go to the **SQL Editor** and run the following script to set up access policies for PDF report uploads.

```sql
-- Drop existing policies if they exist, to ensure a clean setup.
DROP POLICY IF EXISTS "Public read access for field-ops-reports" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated uploads for field-ops-reports" ON storage.objects;

-- Policy: Allow public read access to all files in the 'field-ops-reports' bucket.
CREATE POLICY "Public read access for field-ops-reports"
ON storage.objects FOR SELECT
USING ( bucket_id = 'field-ops-reports' );

-- Policy: Allow any authenticated user to upload files to the 'field-ops-reports' bucket.
CREATE POLICY "Allow authenticated uploads for field-ops-reports"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK ( bucket_id = 'field-ops-reports' );
```

### Uploading the Application Logo

The application logo is loaded from your Supabase Storage to improve performance. Please follow these steps:

1.  **Get the logo file.** You can use your own company logo.
2.  **Upload to Supabase.** Navigate to your `field-ops-photos` bucket in the Supabase dashboard and upload your logo file. We recommend naming it `logo.webp`.
3.  **Get the Public URL.** After uploading, click on the file to view its details and copy its **public URL**. It will look something like `https://<your-project-id>.supabase.co/storage/v1/object/public/field-ops-photos/logo.webp`.
4.  **Update the code.** Open the files `App.tsx` and `components/layout/Sidebar.tsx`. In both files, find the `LOGO_URL` constant at the top and replace the placeholder URL with the one you just copied.

## 6. Run the Application

Once the above steps are completed, you can run the application. It will now connect to your Supabase project for data storage and retrieval.

---

## 7. Troubleshooting

### Users can log in, but the app shows an error or logs them out

This can happen if you created users in Supabase Authentication *before* running the database schema script from Step 3. The `auth.users` table will have users, but the public `users` table will be empty.

The application now automatically creates a profile on first login to fix this going forward. However, to fix your current database state, you can run the following script in your Supabase **SQL Editor** to copy any missing users into the public `users` table.

```sql
-- This script will backfill your public.users table with any
-- users that exist in auth.users but are missing a public profile.
INSERT INTO public.users (id, email, name, role)
SELECT
    id,
    email,
    raw_user_meta_data->>'name',
    'Auditor' -- Default role for backfilled users
FROM
    auth.users
WHERE
    id NOT IN (SELECT id FROM public.users);
```
