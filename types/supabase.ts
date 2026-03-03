export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      users: {
        Row: {
          id: string
          name: string | null
          email: string
          role: "Admin" | "Auditor"
          avatar_url: string | null
          location: string | null
          created_at: string
        }
        Insert: {
          id?: string
          name: string | null
          email: string
          role: "Admin" | "Auditor"
          avatar_url?: string | null
          location?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          name?: string | null
          email?: string
          role?: "Admin" | "Auditor"
          avatar_url?: string | null
          location?: string | null
          created_at?: string
        }
      }
      outlets: {
        Row: {
          id: string
          name: string
          address: string | null
          manager_id: string | null
          created_at: string
        }
        Insert: {
          id?: string
          name: string
          address?: string | null
          manager_id?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          name?: string
          address?: string | null
          manager_id?: string | null
          created_at?: string
        }
      }
      checklists: {
        Row: {
          id: string
          title: string
          location: string | null
          assigned_to: string | null
          due_date: string | null
          status: "pending" | "in-progress" | "completed" | null
          items: Json | null
          check_in_time: string | null
          check_out_time: string | null
          auditor_signature: string | null
          report_url: string | null
          created_at: string
        }
        Insert: {
          id?: string
          title: string
          location?: string | null
          assigned_to?: string | null
          due_date?: string | null
          status?: "pending" | "in-progress" | "completed" | null
          items?: Json | null
          check_in_time?: string | null
          check_out_time?: string | null
          auditor_signature?: string | null
          report_url?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          title?: string
          location?: string | null
          assigned_to?: string | null
          due_date?: string | null
          status?: "pending" | "in-progress" | "completed" | null
          items?: Json | null
          check_in_time?: string | null
          check_out_time?: string | null
          auditor_signature?: string | null
          report_url?: string | null
          created_at?: string
        }
      }
      tasks: {
        Row: {
          id: string
          title: string
          checklist_item_id: string | null
          priority: "Low" | "Medium" | "High" | null
          assigned_to: string | null
          due_date: string | null
          status: "open" | "in-progress" | "resolved" | null
          description: string | null
          photo: string | null
          proof_of_fix: string | null
          checklist_id: string | null
          created_at: string
        }
        Insert: {
          id?: string
          title: string
          checklist_item_id?: string | null
          priority?: "Low" | "Medium" | "High" | null
          assigned_to?: string | null
          due_date?: string | null
          status?: "open" | "in-progress" | "resolved" | null
          description?: string | null
          photo?: string | null
          proof_of_fix?: string | null
          checklist_id?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          title?: string
          checklist_item_id?: string | null
          priority?: "Low" | "Medium" | "High" | null
          assigned_to?: string | null
          due_date?: string | null
          status?: "open" | "in-progress" | "resolved" | null
          description?: string | null
          photo?: string | null
          proof_of_fix?: string | null
          checklist_id?: string | null
          created_at?: string
        }
      }
      checklist_templates: {
        Row: {
          id: string
          title: string
          items: Json | null
          created_at: string
        }
        Insert: {
          id?: string
          title: string
          items?: Json | null
          created_at?: string
        }
        Update: {
          id?: string
          title?: string
          items?: Json | null
          created_at?: string
        }
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      role: "Admin" | "Auditor"
      task_priority: "Low" | "Medium" | "High"
      task_status: "open" | "in-progress" | "resolved"
      checklist_status: "pending" | "in-progress" | "completed"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}
