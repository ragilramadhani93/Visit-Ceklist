export enum Role {
  Admin = 'Admin',
  Auditor = 'Auditor',
}

export interface User {
  id: string;
  name: string | null;
  email: string;
  role: Role;
  avatar_url: string | null;
  location: string | null;
}

export type QuestionType = 'yes-no' | 'multiple-choice' | 'text' | 'number' | 'date' | 'photo' | 'signature';

export interface ChecklistItemBase {
  id: string;
  question: string;
  type: QuestionType;
  options?: string[];
  required: boolean;
  requireNote?: boolean;
  minPhotos?: number; // Replaces requireLivePhoto
}

export interface ChecklistItem extends ChecklistItemBase {
  value: any;
  photoEvidence?: string[]; // Can now hold multiple photos
  finding?: Task | null;
  finding_id?: string | null; // Stores the ID of the created task
  aiAnalysisResult?: string;
  aiAnalysisStatus?: 'idle' | 'analyzing' | 'complete' | 'error';
  note?: string;
}

export interface Checklist {
  id: string;
  title: string;
  location: string | null;
  assigned_to: string | null; // User ID
  due_date: string | null;
  status: 'pending' | 'in-progress' | 'completed' | null;
  items: ChecklistItem[];
  check_in_time?: string;
  check_out_time?: string;
  auditor_signature?: string; // URL
  report_url?: string; // URL
  created_at?: string;
}

export interface ChecklistTemplate {
  id: string;
  title: string;
  items: ChecklistItemBase[];
}


export enum TaskPriority {
  Low = 'Low',
  Medium = 'Medium',
  High = 'High',
}

export interface Task {
  id: string;
  title: string;
  checklist_item_id: string | null;
  priority: TaskPriority | null;
  assigned_to: string | null; // User ID
  due_date: string | null;
  status: 'open' | 'in-progress' | 'resolved' | null;
  description: string | null;
  photo: string | null; // URL
  proof_of_fix: string | null; // URL
  checklist_id: string | null;
  created_at: string;
}

export interface Outlet {
  id: string;
  name: string;
  address: string | null;
  manager_id: string | null;
}

export type View = 'checklists' | 'findings' | 'reports' | 'admin_dashboard' | 'auditor_dashboard' | 'user_management' | 'templates' | 'outlet_management' | 'assignments';