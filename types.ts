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
  photoSource?: 'live' | 'upload';
  evidenceType?: 'photo' | 'video';
  category?: string;
  weight?: number;
  scoring_enabled?: boolean;
}

export interface ChecklistItem extends ChecklistItemBase {
  value: any;
  score?: number; // 0, 1, 2, 3
  photoEvidence?: string[]; // Can now hold multiple photos
  finding?: Task | null;
  finding_id?: string | null; // Stores the ID of the created task
  aiAnalysisResult?: string;
  aiAnalysisStatus?: 'idle' | 'analyzing' | 'complete' | 'error';
  note?: string;
}

export interface CategorySetting {
  name: string;
  weight: number;
}

export interface ChecklistTemplate {
  id: string;
  title: string;
  items: ChecklistItemBase[];
  scoring_enabled?: boolean;
  category_settings?: CategorySetting[];
}

export interface Checklist {
  id?: string;
  title: string;
  location: string;
  assigned_to: string;
  due_date: string;
  status: 'pending' | 'in-progress' | 'completed';
  items: ChecklistItem[];
  scoring_enabled?: boolean;
  category_settings?: CategorySetting[];
  score_percentage?: number;
  total_score?: number;
  max_score?: number;
  check_in_time?: string | null;
  check_out_time?: string | null;
  auditor_signature?: string | null;
  auditor_selfie?: string | null;
  report_url?: string | null;
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
  latitude?: number | null;
  longitude?: number | null;
  radius?: number | null;
}

export type View = 'login' | 'admin_dashboard' | 'auditor_dashboard' | 'checklists' | 'findings' | 'user_management' | 'templates' | 'outlet_management' | 'assignments' | 'reports' | 'whatsapp_config' | 'missed_reports';
