export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      audit_log: {
        Row: {
          action: string
          changed_fields: Json | null
          id: string
          ip_address: string | null
          record_id: string
          table_name: string
          timestamp: string
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          action: string
          changed_fields?: Json | null
          id?: string
          ip_address?: string | null
          record_id: string
          table_name: string
          timestamp?: string
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          action?: string
          changed_fields?: Json | null
          id?: string
          ip_address?: string | null
          record_id?: string
          table_name?: string
          timestamp?: string
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_log_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_log_2025_05: {
        Row: {
          action: string
          changed_fields: Json | null
          id: string
          ip_address: string | null
          record_id: string
          table_name: string
          timestamp: string
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          action: string
          changed_fields?: Json | null
          id?: string
          ip_address?: string | null
          record_id: string
          table_name: string
          timestamp?: string
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          action?: string
          changed_fields?: Json | null
          id?: string
          ip_address?: string | null
          record_id?: string
          table_name?: string
          timestamp?: string
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      audit_log_2025_06: {
        Row: {
          action: string
          changed_fields: Json | null
          id: string
          ip_address: string | null
          record_id: string
          table_name: string
          timestamp: string
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          action: string
          changed_fields?: Json | null
          id?: string
          ip_address?: string | null
          record_id: string
          table_name: string
          timestamp?: string
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          action?: string
          changed_fields?: Json | null
          id?: string
          ip_address?: string | null
          record_id?: string
          table_name?: string
          timestamp?: string
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      audit_log_2025_07: {
        Row: {
          action: string
          changed_fields: Json | null
          id: string
          ip_address: string | null
          record_id: string
          table_name: string
          timestamp: string
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          action: string
          changed_fields?: Json | null
          id?: string
          ip_address?: string | null
          record_id: string
          table_name: string
          timestamp?: string
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          action?: string
          changed_fields?: Json | null
          id?: string
          ip_address?: string | null
          record_id?: string
          table_name?: string
          timestamp?: string
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      audit_log_2025_08: {
        Row: {
          action: string
          changed_fields: Json | null
          id: string
          ip_address: string | null
          record_id: string
          table_name: string
          timestamp: string
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          action: string
          changed_fields?: Json | null
          id?: string
          ip_address?: string | null
          record_id: string
          table_name: string
          timestamp?: string
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          action?: string
          changed_fields?: Json | null
          id?: string
          ip_address?: string | null
          record_id?: string
          table_name?: string
          timestamp?: string
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      audit_log_2025_09: {
        Row: {
          action: string
          changed_fields: Json | null
          id: string
          ip_address: string | null
          record_id: string
          table_name: string
          timestamp: string
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          action: string
          changed_fields?: Json | null
          id?: string
          ip_address?: string | null
          record_id: string
          table_name: string
          timestamp?: string
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          action?: string
          changed_fields?: Json | null
          id?: string
          ip_address?: string | null
          record_id?: string
          table_name?: string
          timestamp?: string
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      audit_log_2025_10: {
        Row: {
          action: string
          changed_fields: Json | null
          id: string
          ip_address: string | null
          record_id: string
          table_name: string
          timestamp: string
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          action: string
          changed_fields?: Json | null
          id?: string
          ip_address?: string | null
          record_id: string
          table_name: string
          timestamp?: string
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          action?: string
          changed_fields?: Json | null
          id?: string
          ip_address?: string | null
          record_id?: string
          table_name?: string
          timestamp?: string
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      audit_log_2025_11: {
        Row: {
          action: string
          changed_fields: Json | null
          id: string
          ip_address: string | null
          record_id: string
          table_name: string
          timestamp: string
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          action: string
          changed_fields?: Json | null
          id?: string
          ip_address?: string | null
          record_id: string
          table_name: string
          timestamp?: string
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          action?: string
          changed_fields?: Json | null
          id?: string
          ip_address?: string | null
          record_id?: string
          table_name?: string
          timestamp?: string
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      audit_log_2025_12: {
        Row: {
          action: string
          changed_fields: Json | null
          id: string
          ip_address: string | null
          record_id: string
          table_name: string
          timestamp: string
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          action: string
          changed_fields?: Json | null
          id?: string
          ip_address?: string | null
          record_id: string
          table_name: string
          timestamp?: string
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          action?: string
          changed_fields?: Json | null
          id?: string
          ip_address?: string | null
          record_id?: string
          table_name?: string
          timestamp?: string
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      audit_log_2026_01: {
        Row: {
          action: string
          changed_fields: Json | null
          id: string
          ip_address: string | null
          record_id: string
          table_name: string
          timestamp: string
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          action: string
          changed_fields?: Json | null
          id?: string
          ip_address?: string | null
          record_id: string
          table_name: string
          timestamp?: string
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          action?: string
          changed_fields?: Json | null
          id?: string
          ip_address?: string | null
          record_id?: string
          table_name?: string
          timestamp?: string
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      audit_log_2026_02: {
        Row: {
          action: string
          changed_fields: Json | null
          id: string
          ip_address: string | null
          record_id: string
          table_name: string
          timestamp: string
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          action: string
          changed_fields?: Json | null
          id?: string
          ip_address?: string | null
          record_id: string
          table_name: string
          timestamp?: string
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          action?: string
          changed_fields?: Json | null
          id?: string
          ip_address?: string | null
          record_id?: string
          table_name?: string
          timestamp?: string
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      audit_log_2026_03: {
        Row: {
          action: string
          changed_fields: Json | null
          id: string
          ip_address: string | null
          record_id: string
          table_name: string
          timestamp: string
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          action: string
          changed_fields?: Json | null
          id?: string
          ip_address?: string | null
          record_id: string
          table_name: string
          timestamp?: string
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          action?: string
          changed_fields?: Json | null
          id?: string
          ip_address?: string | null
          record_id?: string
          table_name?: string
          timestamp?: string
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      audit_log_2026_04: {
        Row: {
          action: string
          changed_fields: Json | null
          id: string
          ip_address: string | null
          record_id: string
          table_name: string
          timestamp: string
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          action: string
          changed_fields?: Json | null
          id?: string
          ip_address?: string | null
          record_id: string
          table_name: string
          timestamp?: string
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          action?: string
          changed_fields?: Json | null
          id?: string
          ip_address?: string | null
          record_id?: string
          table_name?: string
          timestamp?: string
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      audit_log_2026_05: {
        Row: {
          action: string
          changed_fields: Json | null
          id: string
          ip_address: string | null
          record_id: string
          table_name: string
          timestamp: string
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          action: string
          changed_fields?: Json | null
          id?: string
          ip_address?: string | null
          record_id: string
          table_name: string
          timestamp?: string
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          action?: string
          changed_fields?: Json | null
          id?: string
          ip_address?: string | null
          record_id?: string
          table_name?: string
          timestamp?: string
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      audit_log_2026_06: {
        Row: {
          action: string
          changed_fields: Json | null
          id: string
          ip_address: string | null
          record_id: string
          table_name: string
          timestamp: string
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          action: string
          changed_fields?: Json | null
          id?: string
          ip_address?: string | null
          record_id: string
          table_name: string
          timestamp?: string
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          action?: string
          changed_fields?: Json | null
          id?: string
          ip_address?: string | null
          record_id?: string
          table_name?: string
          timestamp?: string
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      audit_log_2026_07: {
        Row: {
          action: string
          changed_fields: Json | null
          id: string
          ip_address: string | null
          record_id: string
          table_name: string
          timestamp: string
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          action: string
          changed_fields?: Json | null
          id?: string
          ip_address?: string | null
          record_id: string
          table_name: string
          timestamp?: string
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          action?: string
          changed_fields?: Json | null
          id?: string
          ip_address?: string | null
          record_id?: string
          table_name?: string
          timestamp?: string
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      audit_log_2026_08: {
        Row: {
          action: string
          changed_fields: Json | null
          id: string
          ip_address: string | null
          record_id: string
          table_name: string
          timestamp: string
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          action: string
          changed_fields?: Json | null
          id?: string
          ip_address?: string | null
          record_id: string
          table_name: string
          timestamp?: string
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          action?: string
          changed_fields?: Json | null
          id?: string
          ip_address?: string | null
          record_id?: string
          table_name?: string
          timestamp?: string
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      audit_log_2026_09: {
        Row: {
          action: string
          changed_fields: Json | null
          id: string
          ip_address: string | null
          record_id: string
          table_name: string
          timestamp: string
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          action: string
          changed_fields?: Json | null
          id?: string
          ip_address?: string | null
          record_id: string
          table_name: string
          timestamp?: string
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          action?: string
          changed_fields?: Json | null
          id?: string
          ip_address?: string | null
          record_id?: string
          table_name?: string
          timestamp?: string
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      audit_log_2026_10: {
        Row: {
          action: string
          changed_fields: Json | null
          id: string
          ip_address: string | null
          record_id: string
          table_name: string
          timestamp: string
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          action: string
          changed_fields?: Json | null
          id?: string
          ip_address?: string | null
          record_id: string
          table_name: string
          timestamp?: string
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          action?: string
          changed_fields?: Json | null
          id?: string
          ip_address?: string | null
          record_id?: string
          table_name?: string
          timestamp?: string
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      audit_log_2026_11: {
        Row: {
          action: string
          changed_fields: Json | null
          id: string
          ip_address: string | null
          record_id: string
          table_name: string
          timestamp: string
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          action: string
          changed_fields?: Json | null
          id?: string
          ip_address?: string | null
          record_id: string
          table_name: string
          timestamp?: string
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          action?: string
          changed_fields?: Json | null
          id?: string
          ip_address?: string | null
          record_id?: string
          table_name?: string
          timestamp?: string
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      audit_log_2026_12: {
        Row: {
          action: string
          changed_fields: Json | null
          id: string
          ip_address: string | null
          record_id: string
          table_name: string
          timestamp: string
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          action: string
          changed_fields?: Json | null
          id?: string
          ip_address?: string | null
          record_id: string
          table_name: string
          timestamp?: string
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          action?: string
          changed_fields?: Json | null
          id?: string
          ip_address?: string | null
          record_id?: string
          table_name?: string
          timestamp?: string
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      audit_log_2027_01: {
        Row: {
          action: string
          changed_fields: Json | null
          id: string
          ip_address: string | null
          record_id: string
          table_name: string
          timestamp: string
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          action: string
          changed_fields?: Json | null
          id?: string
          ip_address?: string | null
          record_id: string
          table_name: string
          timestamp?: string
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          action?: string
          changed_fields?: Json | null
          id?: string
          ip_address?: string | null
          record_id?: string
          table_name?: string
          timestamp?: string
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      audit_log_2027_02: {
        Row: {
          action: string
          changed_fields: Json | null
          id: string
          ip_address: string | null
          record_id: string
          table_name: string
          timestamp: string
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          action: string
          changed_fields?: Json | null
          id?: string
          ip_address?: string | null
          record_id: string
          table_name: string
          timestamp?: string
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          action?: string
          changed_fields?: Json | null
          id?: string
          ip_address?: string | null
          record_id?: string
          table_name?: string
          timestamp?: string
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      audit_log_2027_03: {
        Row: {
          action: string
          changed_fields: Json | null
          id: string
          ip_address: string | null
          record_id: string
          table_name: string
          timestamp: string
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          action: string
          changed_fields?: Json | null
          id?: string
          ip_address?: string | null
          record_id: string
          table_name: string
          timestamp?: string
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          action?: string
          changed_fields?: Json | null
          id?: string
          ip_address?: string | null
          record_id?: string
          table_name?: string
          timestamp?: string
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      audit_log_2027_04: {
        Row: {
          action: string
          changed_fields: Json | null
          id: string
          ip_address: string | null
          record_id: string
          table_name: string
          timestamp: string
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          action: string
          changed_fields?: Json | null
          id?: string
          ip_address?: string | null
          record_id: string
          table_name: string
          timestamp?: string
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          action?: string
          changed_fields?: Json | null
          id?: string
          ip_address?: string | null
          record_id?: string
          table_name?: string
          timestamp?: string
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      audit_log_2027_05: {
        Row: {
          action: string
          changed_fields: Json | null
          id: string
          ip_address: string | null
          record_id: string
          table_name: string
          timestamp: string
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          action: string
          changed_fields?: Json | null
          id?: string
          ip_address?: string | null
          record_id: string
          table_name: string
          timestamp?: string
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          action?: string
          changed_fields?: Json | null
          id?: string
          ip_address?: string | null
          record_id?: string
          table_name?: string
          timestamp?: string
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      audit_log_default: {
        Row: {
          action: string
          changed_fields: Json | null
          id: string
          ip_address: string | null
          record_id: string
          table_name: string
          timestamp: string
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          action: string
          changed_fields?: Json | null
          id?: string
          ip_address?: string | null
          record_id: string
          table_name: string
          timestamp?: string
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          action?: string
          changed_fields?: Json | null
          id?: string
          ip_address?: string | null
          record_id?: string
          table_name?: string
          timestamp?: string
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      banks: {
        Row: {
          color: string
          created_at: string
          id: string
          is_active: boolean
          is_system: boolean
          key: string
          lender_type: string
          logo_url: string | null
          name_en: string
          name_he: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          color?: string
          created_at?: string
          id?: string
          is_active?: boolean
          is_system?: boolean
          key: string
          lender_type?: string
          logo_url?: string | null
          name_en: string
          name_he: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          color?: string
          created_at?: string
          id?: string
          is_active?: boolean
          is_system?: boolean
          key?: string
          lender_type?: string
          logo_url?: string | null
          name_en?: string
          name_he?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      borrower_incomes: {
        Row: {
          amount_monthly: number | null
          borrower_id: string
          created_at: string
          created_by: string | null
          deleted_at: string | null
          deleted_by: string | null
          employment_start_date: string | null
          id: string
          income_type_id: string | null
          is_primary: boolean
          metadata: Json
          notes: string | null
          source_name: string | null
          tenure_months: number | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          amount_monthly?: number | null
          borrower_id: string
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          employment_start_date?: string | null
          id?: string
          income_type_id?: string | null
          is_primary?: boolean
          metadata?: Json
          notes?: string | null
          source_name?: string | null
          tenure_months?: number | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          amount_monthly?: number | null
          borrower_id?: string
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          employment_start_date?: string | null
          id?: string
          income_type_id?: string | null
          is_primary?: boolean
          metadata?: Json
          notes?: string | null
          source_name?: string | null
          tenure_months?: number | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "borrower_incomes_borrower_id_fkey"
            columns: ["borrower_id"]
            isOneToOne: false
            referencedRelation: "borrowers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "borrower_incomes_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "borrower_incomes_deleted_by_fkey"
            columns: ["deleted_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "borrower_incomes_income_type_id_fkey"
            columns: ["income_type_id"]
            isOneToOne: false
            referencedRelation: "income_types"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "borrower_incomes_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      borrower_obligations: {
        Row: {
          borrower_id: string
          created_at: string
          created_by: string | null
          deleted_at: string | null
          deleted_by: string | null
          description: string | null
          end_date: string | null
          id: string
          lender: string | null
          loan_amount: number | null
          metadata: Json
          monthly_payment: number | null
          months_remaining: number | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          borrower_id: string
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          description?: string | null
          end_date?: string | null
          id?: string
          lender?: string | null
          loan_amount?: number | null
          metadata?: Json
          monthly_payment?: number | null
          months_remaining?: number | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          borrower_id?: string
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          description?: string | null
          end_date?: string | null
          id?: string
          lender?: string | null
          loan_amount?: number | null
          metadata?: Json
          monthly_payment?: number | null
          months_remaining?: number | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "borrower_obligations_borrower_id_fkey"
            columns: ["borrower_id"]
            isOneToOne: false
            referencedRelation: "borrowers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "borrower_obligations_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "borrower_obligations_deleted_by_fkey"
            columns: ["deleted_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "borrower_obligations_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      borrowers: {
        Row: {
          additional_citizenships: string | null
          address: string | null
          birth_date: string | null
          children_count: number | null
          citizenship: string | null
          city: string | null
          created_at: string
          created_by: string | null
          credit_rating: string | null
          deleted_at: string | null
          email: string | null
          employer_name: string | null
          employment_status: string | null
          first_name: string | null
          foreign_residence_country: string | null
          gender: string | null
          id: string
          id_expiry_date: string | null
          id_issue_date: string | null
          landline_phone: string | null
          last_name: string | null
          marital_status: string | null
          metadata: Json
          national_id: string | null
          notes: string | null
          owns_other_property: boolean | null
          phone: string | null
          preferred_language: string | null
          related_to_sellers: boolean | null
          relationship_in_case: string | null
          residency_type: string | null
          updated_at: string
          updated_by: string | null
          version: number
        }
        Insert: {
          additional_citizenships?: string | null
          address?: string | null
          birth_date?: string | null
          children_count?: number | null
          citizenship?: string | null
          city?: string | null
          created_at?: string
          created_by?: string | null
          credit_rating?: string | null
          deleted_at?: string | null
          email?: string | null
          employer_name?: string | null
          employment_status?: string | null
          first_name?: string | null
          foreign_residence_country?: string | null
          gender?: string | null
          id?: string
          id_expiry_date?: string | null
          id_issue_date?: string | null
          landline_phone?: string | null
          last_name?: string | null
          marital_status?: string | null
          metadata?: Json
          national_id?: string | null
          notes?: string | null
          owns_other_property?: boolean | null
          phone?: string | null
          preferred_language?: string | null
          related_to_sellers?: boolean | null
          relationship_in_case?: string | null
          residency_type?: string | null
          updated_at?: string
          updated_by?: string | null
          version?: number
        }
        Update: {
          additional_citizenships?: string | null
          address?: string | null
          birth_date?: string | null
          children_count?: number | null
          citizenship?: string | null
          city?: string | null
          created_at?: string
          created_by?: string | null
          credit_rating?: string | null
          deleted_at?: string | null
          email?: string | null
          employer_name?: string | null
          employment_status?: string | null
          first_name?: string | null
          foreign_residence_country?: string | null
          gender?: string | null
          id?: string
          id_expiry_date?: string | null
          id_issue_date?: string | null
          landline_phone?: string | null
          last_name?: string | null
          marital_status?: string | null
          metadata?: Json
          national_id?: string | null
          notes?: string | null
          owns_other_property?: boolean | null
          phone?: string | null
          preferred_language?: string | null
          related_to_sellers?: boolean | null
          relationship_in_case?: string | null
          residency_type?: string | null
          updated_at?: string
          updated_by?: string | null
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "borrowers_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "borrowers_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      case_bank_statuses: {
        Row: {
          color: string
          created_at: string
          id: string
          is_active: boolean
          is_system: boolean
          key: string
          name_en: string
          name_he: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          color?: string
          created_at?: string
          id?: string
          is_active?: boolean
          is_system?: boolean
          key: string
          name_en: string
          name_he: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          color?: string
          created_at?: string
          id?: string
          is_active?: boolean
          is_system?: boolean
          key?: string
          name_en?: string
          name_he?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      case_banks: {
        Row: {
          bank_id: string
          bank_status_id: string | null
          banker_email: string | null
          banker_name: string | null
          banker_phone: string | null
          case_id: string
          created_at: string
          created_by: string | null
          deleted_at: string | null
          id: string
          is_primary: boolean
          notes: string | null
          response_date: string | null
          submission_date: string | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          bank_id: string
          bank_status_id?: string | null
          banker_email?: string | null
          banker_name?: string | null
          banker_phone?: string | null
          case_id: string
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          id?: string
          is_primary?: boolean
          notes?: string | null
          response_date?: string | null
          submission_date?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          bank_id?: string
          bank_status_id?: string | null
          banker_email?: string | null
          banker_name?: string | null
          banker_phone?: string | null
          case_id?: string
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          id?: string
          is_primary?: boolean
          notes?: string | null
          response_date?: string | null
          submission_date?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "case_banks_bank_id_fkey"
            columns: ["bank_id"]
            isOneToOne: false
            referencedRelation: "banks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "case_banks_bank_status_id_fkey"
            columns: ["bank_status_id"]
            isOneToOne: false
            referencedRelation: "case_bank_statuses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "case_banks_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "cases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "case_banks_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "case_banks_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      case_borrowers: {
        Row: {
          borrower_id: string
          case_id: string
          created_at: string
          id: string
          is_primary: boolean
          role_in_case: string
        }
        Insert: {
          borrower_id: string
          case_id: string
          created_at?: string
          id?: string
          is_primary?: boolean
          role_in_case?: string
        }
        Update: {
          borrower_id?: string
          case_id?: string
          created_at?: string
          id?: string
          is_primary?: boolean
          role_in_case?: string
        }
        Relationships: [
          {
            foreignKeyName: "case_borrowers_borrower_id_fkey"
            columns: ["borrower_id"]
            isOneToOne: false
            referencedRelation: "borrowers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "case_borrowers_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "cases"
            referencedColumns: ["id"]
          },
        ]
      }
      case_checklist_items: {
        Row: {
          case_id: string
          created_at: string
          created_by: string | null
          document_category_id: string | null
          done_at: string | null
          done_by: string | null
          id: string
          is_done: boolean
          is_required: boolean
          label: string | null
          required_at_stage_id: string | null
          sort_order: number
          source: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          case_id: string
          created_at?: string
          created_by?: string | null
          document_category_id?: string | null
          done_at?: string | null
          done_by?: string | null
          id?: string
          is_done?: boolean
          is_required?: boolean
          label?: string | null
          required_at_stage_id?: string | null
          sort_order?: number
          source?: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          case_id?: string
          created_at?: string
          created_by?: string | null
          document_category_id?: string | null
          done_at?: string | null
          done_by?: string | null
          id?: string
          is_done?: boolean
          is_required?: boolean
          label?: string | null
          required_at_stage_id?: string | null
          sort_order?: number
          source?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "case_checklist_items_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "cases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "case_checklist_items_document_category_id_fkey"
            columns: ["document_category_id"]
            isOneToOne: false
            referencedRelation: "document_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "case_checklist_items_required_at_stage_id_fkey"
            columns: ["required_at_stage_id"]
            isOneToOne: false
            referencedRelation: "case_statuses"
            referencedColumns: ["id"]
          },
        ]
      }
      case_expenses: {
        Row: {
          amount: number | null
          case_id: string
          created_at: string
          created_by: string | null
          deleted_at: string | null
          deleted_by: string | null
          description: string | null
          expense_date: string | null
          id: string
          receipt_drive_url: string | null
          receipt_mime: string | null
          receipt_name: string | null
          receipt_path: string | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          amount?: number | null
          case_id: string
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          description?: string | null
          expense_date?: string | null
          id?: string
          receipt_drive_url?: string | null
          receipt_mime?: string | null
          receipt_name?: string | null
          receipt_path?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          amount?: number | null
          case_id?: string
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          description?: string | null
          expense_date?: string | null
          id?: string
          receipt_drive_url?: string | null
          receipt_mime?: string | null
          receipt_name?: string | null
          receipt_path?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "case_expenses_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "cases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "case_expenses_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "case_expenses_deleted_by_fkey"
            columns: ["deleted_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "case_expenses_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      case_financials: {
        Row: {
          case_id: string
          created_at: string
          created_by: string | null
          expected_income: number | null
          fee_amount: number | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          case_id: string
          created_at?: string
          created_by?: string | null
          expected_income?: number | null
          fee_amount?: number | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          case_id?: string
          created_at?: string
          created_by?: string | null
          expected_income?: number | null
          fee_amount?: number | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "case_financials_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: true
            referencedRelation: "cases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "case_financials_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "case_financials_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      case_statuses: {
        Row: {
          color: string
          created_at: string
          default_duration_days: number | null
          id: string
          is_active: boolean
          is_system: boolean
          is_terminal: boolean
          key: string
          name_en: string
          name_he: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          color?: string
          created_at?: string
          default_duration_days?: number | null
          id?: string
          is_active?: boolean
          is_system?: boolean
          is_terminal?: boolean
          key: string
          name_en: string
          name_he: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          color?: string
          created_at?: string
          default_duration_days?: number | null
          id?: string
          is_active?: boolean
          is_system?: boolean
          is_terminal?: boolean
          key?: string
          name_en?: string
          name_he?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      case_type_documents: {
        Row: {
          case_type_id: string
          created_at: string
          document_category_id: string
          is_required: boolean
          required_at_stage_id: string | null
          sort_order: number
          updated_at: string
        }
        Insert: {
          case_type_id: string
          created_at?: string
          document_category_id: string
          is_required?: boolean
          required_at_stage_id?: string | null
          sort_order?: number
          updated_at?: string
        }
        Update: {
          case_type_id?: string
          created_at?: string
          document_category_id?: string
          is_required?: boolean
          required_at_stage_id?: string | null
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "case_type_documents_case_type_id_fkey"
            columns: ["case_type_id"]
            isOneToOne: false
            referencedRelation: "case_types"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "case_type_documents_document_category_id_fkey"
            columns: ["document_category_id"]
            isOneToOne: false
            referencedRelation: "document_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "case_type_documents_required_at_stage_id_fkey"
            columns: ["required_at_stage_id"]
            isOneToOne: false
            referencedRelation: "case_statuses"
            referencedColumns: ["id"]
          },
        ]
      }
      case_types: {
        Row: {
          color: string
          created_at: string
          id: string
          is_active: boolean
          is_system: boolean
          key: string
          name_en: string
          name_he: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          color?: string
          created_at?: string
          id?: string
          is_active?: boolean
          is_system?: boolean
          key: string
          name_en: string
          name_he: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          color?: string
          created_at?: string
          id?: string
          is_active?: boolean
          is_system?: boolean
          key?: string
          name_en?: string
          name_he?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      cases: {
        Row: {
          assigned_advisor_id: string | null
          case_blocker: string | null
          case_number: string
          case_type_other_text: string | null
          case_type_primary_id: string | null
          case_type_secondary_id: string | null
          city: string | null
          created_at: string
          created_by: string | null
          deleted_at: string | null
          equity: number | null
          id: string
          insurance_status: string | null
          is_archived: boolean
          metadata: Json
          primary_borrower_id: string | null
          property_value: number | null
          referrer_name: string | null
          request_details: string | null
          requested_mortgage_amount: number | null
          short_note: string | null
          status_id: string | null
          target_date: string | null
          updated_at: string
          updated_by: string | null
          version: number
        }
        Insert: {
          assigned_advisor_id?: string | null
          case_blocker?: string | null
          case_number?: string
          case_type_other_text?: string | null
          case_type_primary_id?: string | null
          case_type_secondary_id?: string | null
          city?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          equity?: number | null
          id?: string
          insurance_status?: string | null
          is_archived?: boolean
          metadata?: Json
          primary_borrower_id?: string | null
          property_value?: number | null
          referrer_name?: string | null
          request_details?: string | null
          requested_mortgage_amount?: number | null
          short_note?: string | null
          status_id?: string | null
          target_date?: string | null
          updated_at?: string
          updated_by?: string | null
          version?: number
        }
        Update: {
          assigned_advisor_id?: string | null
          case_blocker?: string | null
          case_number?: string
          case_type_other_text?: string | null
          case_type_primary_id?: string | null
          case_type_secondary_id?: string | null
          city?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          equity?: number | null
          id?: string
          insurance_status?: string | null
          is_archived?: boolean
          metadata?: Json
          primary_borrower_id?: string | null
          property_value?: number | null
          referrer_name?: string | null
          request_details?: string | null
          requested_mortgage_amount?: number | null
          short_note?: string | null
          status_id?: string | null
          target_date?: string | null
          updated_at?: string
          updated_by?: string | null
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "cases_assigned_advisor_id_fkey"
            columns: ["assigned_advisor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cases_case_type_primary_id_fkey"
            columns: ["case_type_primary_id"]
            isOneToOne: false
            referencedRelation: "case_types"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cases_case_type_secondary_id_fkey"
            columns: ["case_type_secondary_id"]
            isOneToOne: false
            referencedRelation: "case_types"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cases_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cases_status_id_fkey"
            columns: ["status_id"]
            isOneToOne: false
            referencedRelation: "case_statuses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cases_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_cases_primary_borrower"
            columns: ["primary_borrower_id"]
            isOneToOne: false
            referencedRelation: "borrowers"
            referencedColumns: ["id"]
          },
        ]
      }
      document_categories: {
        Row: {
          created_at: string
          drive_folder: string
          id: string
          is_active: boolean
          is_system: boolean
          key: string
          name_en: string
          name_he: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          drive_folder: string
          id?: string
          is_active?: boolean
          is_system?: boolean
          key: string
          name_en: string
          name_he: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          drive_folder?: string
          id?: string
          is_active?: boolean
          is_system?: boolean
          key?: string
          name_en?: string
          name_he?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      document_drive_tombstones: {
        Row: {
          case_id: string
          deleted_at: string
          deleted_by: string | null
          deleted_document_id: string | null
          drive_file_id: string
        }
        Insert: {
          case_id: string
          deleted_at?: string
          deleted_by?: string | null
          deleted_document_id?: string | null
          drive_file_id: string
        }
        Update: {
          case_id?: string
          deleted_at?: string
          deleted_by?: string | null
          deleted_document_id?: string | null
          drive_file_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "document_drive_tombstones_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "cases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "document_drive_tombstones_deleted_by_fkey"
            columns: ["deleted_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      documents: {
        Row: {
          borrower_id: string | null
          case_id: string
          category_id: string | null
          created_at: string
          deleted_at: string | null
          drive_file_id: string | null
          drive_file_url: string | null
          expiry_date: string | null
          file_name: string
          file_size: number | null
          id: string
          metadata: Json
          mime_type: string | null
          notes: string | null
          status: string
          updated_at: string
          upload_date: string
          uploaded_by: string | null
          verified_at: string | null
          verified_by: string | null
        }
        Insert: {
          borrower_id?: string | null
          case_id: string
          category_id?: string | null
          created_at?: string
          deleted_at?: string | null
          drive_file_id?: string | null
          drive_file_url?: string | null
          expiry_date?: string | null
          file_name: string
          file_size?: number | null
          id?: string
          metadata?: Json
          mime_type?: string | null
          notes?: string | null
          status?: string
          updated_at?: string
          upload_date?: string
          uploaded_by?: string | null
          verified_at?: string | null
          verified_by?: string | null
        }
        Update: {
          borrower_id?: string | null
          case_id?: string
          category_id?: string | null
          created_at?: string
          deleted_at?: string | null
          drive_file_id?: string | null
          drive_file_url?: string | null
          expiry_date?: string | null
          file_name?: string
          file_size?: number | null
          id?: string
          metadata?: Json
          mime_type?: string | null
          notes?: string | null
          status?: string
          updated_at?: string
          upload_date?: string
          uploaded_by?: string | null
          verified_at?: string | null
          verified_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "documents_borrower_id_fkey"
            columns: ["borrower_id"]
            isOneToOne: false
            referencedRelation: "borrowers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documents_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "cases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documents_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "document_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documents_uploaded_by_fkey"
            columns: ["uploaded_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documents_verified_by_fkey"
            columns: ["verified_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      holidays: {
        Row: {
          created_at: string
          date: string
          id: string
          is_work_day: boolean
          name_en: string
          name_he: string
          skip_reminders: boolean
          year: number
        }
        Insert: {
          created_at?: string
          date: string
          id?: string
          is_work_day?: boolean
          name_en: string
          name_he: string
          skip_reminders?: boolean
          year: number
        }
        Update: {
          created_at?: string
          date?: string
          id?: string
          is_work_day?: boolean
          name_en?: string
          name_he?: string
          skip_reminders?: boolean
          year?: number
        }
        Relationships: []
      }
      import_jobs: {
        Row: {
          column_mapping: Json | null
          completed_at: string | null
          created_at: string
          error_rows: number | null
          errors: Json | null
          file_name: string
          file_size: number | null
          id: string
          status: string
          success_rows: number | null
          total_rows: number | null
          type: string
          user_id: string
        }
        Insert: {
          column_mapping?: Json | null
          completed_at?: string | null
          created_at?: string
          error_rows?: number | null
          errors?: Json | null
          file_name: string
          file_size?: number | null
          id?: string
          status?: string
          success_rows?: number | null
          total_rows?: number | null
          type: string
          user_id: string
        }
        Update: {
          column_mapping?: Json | null
          completed_at?: string | null
          created_at?: string
          error_rows?: number | null
          errors?: Json | null
          file_name?: string
          file_size?: number | null
          id?: string
          status?: string
          success_rows?: number | null
          total_rows?: number | null
          type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "import_jobs_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      income_types: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          is_system: boolean
          key: string
          name_en: string
          name_he: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          is_system?: boolean
          key: string
          name_en: string
          name_he: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          is_system?: boolean
          key?: string
          name_en?: string
          name_he?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      leads: {
        Row: {
          assigned_to: string | null
          converted_at: string | null
          converted_to_case_id: string | null
          created_at: string
          created_by: string | null
          deleted_at: string | null
          email: string | null
          first_name: string | null
          id: string
          last_name: string | null
          metadata: Json
          national_id: string | null
          notes: string | null
          phone: string | null
          status: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          assigned_to?: string | null
          converted_at?: string | null
          converted_to_case_id?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          email?: string | null
          first_name?: string | null
          id?: string
          last_name?: string | null
          metadata?: Json
          national_id?: string | null
          notes?: string | null
          phone?: string | null
          status?: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          assigned_to?: string | null
          converted_at?: string | null
          converted_to_case_id?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          email?: string | null
          first_name?: string | null
          id?: string
          last_name?: string | null
          metadata?: Json
          national_id?: string | null
          notes?: string | null
          phone?: string | null
          status?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_leads_converted_case"
            columns: ["converted_to_case_id"]
            isOneToOne: false
            referencedRelation: "cases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leads_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leads_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leads_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      message_templates: {
        Row: {
          body: string
          channel: string
          created_at: string
          created_by: string | null
          deleted_at: string | null
          deleted_by: string | null
          id: string
          is_active: boolean
          name: string
          subject: string | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          body?: string
          channel?: string
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          id?: string
          is_active?: boolean
          name: string
          subject?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          body?: string
          channel?: string
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          id?: string
          is_active?: boolean
          name?: string
          subject?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "message_templates_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "message_templates_deleted_by_fkey"
            columns: ["deleted_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "message_templates_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      mortgage_scenarios: {
        Row: {
          advisor_conclusion: string | null
          case_id: string | null
          created_at: string
          created_by: string | null
          deleted_at: string | null
          deleted_by: string | null
          equity: number
          id: string
          inputs: Json
          kind: string
          mortgage_amount: number
          primary_borrower_id: string | null
          property_kind: string
          property_value: number
          result_snapshot: Json
          term_months: number
          title: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          advisor_conclusion?: string | null
          case_id?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          equity: number
          id?: string
          inputs?: Json
          kind: string
          mortgage_amount: number
          primary_borrower_id?: string | null
          property_kind: string
          property_value: number
          result_snapshot?: Json
          term_months: number
          title: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          advisor_conclusion?: string | null
          case_id?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          equity?: number
          id?: string
          inputs?: Json
          kind?: string
          mortgage_amount?: number
          primary_borrower_id?: string | null
          property_kind?: string
          property_value?: number
          result_snapshot?: Json
          term_months?: number
          title?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "mortgage_scenarios_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "cases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mortgage_scenarios_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mortgage_scenarios_deleted_by_fkey"
            columns: ["deleted_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mortgage_scenarios_primary_borrower_id_fkey"
            columns: ["primary_borrower_id"]
            isOneToOne: false
            referencedRelation: "borrowers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mortgage_scenarios_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_preferences: {
        Row: {
          email_task_assigned: boolean
          email_task_completed: boolean
          updated_at: string
          user_id: string
        }
        Insert: {
          email_task_assigned?: boolean
          email_task_completed?: boolean
          updated_at?: string
          user_id: string
        }
        Update: {
          email_task_assigned?: boolean
          email_task_completed?: boolean
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notification_preferences_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          actor_id: string | null
          case_id: string | null
          created_at: string
          data: Json
          id: string
          read_at: string | null
          task_id: string | null
          type: string
          user_id: string
        }
        Insert: {
          actor_id?: string | null
          case_id?: string | null
          created_at?: string
          data?: Json
          id?: string
          read_at?: string | null
          task_id?: string | null
          type: string
          user_id: string
        }
        Update: {
          actor_id?: string | null
          case_id?: string | null
          created_at?: string
          data?: Json
          id?: string
          read_at?: string | null
          task_id?: string | null
          type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "cases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      office_integrations: {
        Row: {
          access_token: string | null
          connected_at: string | null
          connected_by: string | null
          connected_email: string | null
          connected_external_user_id: string | null
          created_at: string
          drive_root_folder_id: string | null
          drive_root_folder_name: string
          id: string
          last_error: string | null
          last_synced_at: string | null
          metadata: Json
          provider: string
          refresh_token: string | null
          scopes: string[] | null
          status: string
          token_expires_at: string | null
          updated_at: string
        }
        Insert: {
          access_token?: string | null
          connected_at?: string | null
          connected_by?: string | null
          connected_email?: string | null
          connected_external_user_id?: string | null
          created_at?: string
          drive_root_folder_id?: string | null
          drive_root_folder_name?: string
          id?: string
          last_error?: string | null
          last_synced_at?: string | null
          metadata?: Json
          provider: string
          refresh_token?: string | null
          scopes?: string[] | null
          status?: string
          token_expires_at?: string | null
          updated_at?: string
        }
        Update: {
          access_token?: string | null
          connected_at?: string | null
          connected_by?: string | null
          connected_email?: string | null
          connected_external_user_id?: string | null
          created_at?: string
          drive_root_folder_id?: string | null
          drive_root_folder_name?: string
          id?: string
          last_error?: string | null
          last_synced_at?: string | null
          metadata?: Json
          provider?: string
          refresh_token?: string | null
          scopes?: string[] | null
          status?: string
          token_expires_at?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "office_integrations_connected_by_fkey"
            columns: ["connected_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      office_settings: {
        Row: {
          address_city: string | null
          address_postal_code: string | null
          address_street: string | null
          audit_log_retention_days: number
          bank_account_bank: string | null
          bank_account_branch: string | null
          bank_account_name: string | null
          bank_account_number: string | null
          currency: string
          date_format: string
          default_language: string
          default_task_time: string
          deleted_records_retention_days: number
          document_expiry_warning_days: number
          email_header_image_url: string | null
          email_main: string | null
          email_reply_to_address: string | null
          email_sender_address: string | null
          email_sender_name: string | null
          email_service_provider: string
          id: number
          metadata: Json
          office_logo_url: string | null
          office_name: string
          office_tagline: string | null
          phone_fax: string | null
          phone_main: string | null
          primary_color: string
          regulatory_thresholds: Json
          secondary_color: string
          sla_status_thresholds: Json
          task_reminder_days_before: number
          tax_id: string | null
          timezone: string
          updated_at: string
          updated_by: string | null
          website_url: string | null
          working_days: Json
          working_hours_end: string
          working_hours_start: string
        }
        Insert: {
          address_city?: string | null
          address_postal_code?: string | null
          address_street?: string | null
          audit_log_retention_days?: number
          bank_account_bank?: string | null
          bank_account_branch?: string | null
          bank_account_name?: string | null
          bank_account_number?: string | null
          currency?: string
          date_format?: string
          default_language?: string
          default_task_time?: string
          deleted_records_retention_days?: number
          document_expiry_warning_days?: number
          email_header_image_url?: string | null
          email_main?: string | null
          email_reply_to_address?: string | null
          email_sender_address?: string | null
          email_sender_name?: string | null
          email_service_provider?: string
          id?: number
          metadata?: Json
          office_logo_url?: string | null
          office_name?: string
          office_tagline?: string | null
          phone_fax?: string | null
          phone_main?: string | null
          primary_color?: string
          regulatory_thresholds?: Json
          secondary_color?: string
          sla_status_thresholds?: Json
          task_reminder_days_before?: number
          tax_id?: string | null
          timezone?: string
          updated_at?: string
          updated_by?: string | null
          website_url?: string | null
          working_days?: Json
          working_hours_end?: string
          working_hours_start?: string
        }
        Update: {
          address_city?: string | null
          address_postal_code?: string | null
          address_street?: string | null
          audit_log_retention_days?: number
          bank_account_bank?: string | null
          bank_account_branch?: string | null
          bank_account_name?: string | null
          bank_account_number?: string | null
          currency?: string
          date_format?: string
          default_language?: string
          default_task_time?: string
          deleted_records_retention_days?: number
          document_expiry_warning_days?: number
          email_header_image_url?: string | null
          email_main?: string | null
          email_reply_to_address?: string | null
          email_sender_address?: string | null
          email_sender_name?: string | null
          email_service_provider?: string
          id?: number
          metadata?: Json
          office_logo_url?: string | null
          office_name?: string
          office_tagline?: string | null
          phone_fax?: string | null
          phone_main?: string | null
          primary_color?: string
          regulatory_thresholds?: Json
          secondary_color?: string
          sla_status_thresholds?: Json
          task_reminder_days_before?: number
          tax_id?: string | null
          timezone?: string
          updated_at?: string
          updated_by?: string | null
          website_url?: string | null
          working_days?: Json
          working_hours_end?: string
          working_hours_start?: string
        }
        Relationships: [
          {
            foreignKeyName: "office_settings_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      permissions: {
        Row: {
          category: string
          created_at: string
          description_en: string | null
          description_he: string | null
          id: string
          is_system: boolean
          key: string
          name_en: string
          name_he: string
        }
        Insert: {
          category: string
          created_at?: string
          description_en?: string | null
          description_he?: string | null
          id?: string
          is_system?: boolean
          key: string
          name_en: string
          name_he: string
        }
        Update: {
          category?: string
          created_at?: string
          description_en?: string | null
          description_he?: string | null
          id?: string
          is_system?: boolean
          key?: string
          name_en?: string
          name_he?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          created_by: string | null
          dashboard_config: Json
          deleted_at: string | null
          email: string | null
          first_name: string | null
          google_calendar_connected: boolean
          google_calendar_refresh_token: string | null
          id: string
          is_active: boolean
          language: string
          last_name: string | null
          metadata: Json
          phone: string | null
          role_id: string | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          dashboard_config?: Json
          deleted_at?: string | null
          email?: string | null
          first_name?: string | null
          google_calendar_connected?: boolean
          google_calendar_refresh_token?: string | null
          id: string
          is_active?: boolean
          language?: string
          last_name?: string | null
          metadata?: Json
          phone?: string | null
          role_id?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          dashboard_config?: Json
          deleted_at?: string | null
          email?: string | null
          first_name?: string | null
          google_calendar_connected?: boolean
          google_calendar_refresh_token?: string | null
          id?: string
          is_active?: boolean
          language?: string
          last_name?: string | null
          metadata?: Json
          phone?: string | null
          role_id?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "profiles_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profiles_role_id_fkey"
            columns: ["role_id"]
            isOneToOne: false
            referencedRelation: "roles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profiles_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      rate_limit_counters: {
        Row: {
          action_key: string
          count: number
          subject_key: string
          window_start: string
        }
        Insert: {
          action_key: string
          count?: number
          subject_key: string
          window_start: string
        }
        Update: {
          action_key?: string
          count?: number
          subject_key?: string
          window_start?: string
        }
        Relationships: []
      }
      reminder_rules: {
        Row: {
          action_type: string
          assigned_to_role_id: string | null
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          is_active: boolean
          name: string
          task_description_template: string | null
          task_title_template: string | null
          trigger_params: Json
          trigger_type: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          action_type?: string
          assigned_to_role_id?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          is_active?: boolean
          name: string
          task_description_template?: string | null
          task_title_template?: string | null
          trigger_params?: Json
          trigger_type: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          action_type?: string
          assigned_to_role_id?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          is_active?: boolean
          name?: string
          task_description_template?: string | null
          task_title_template?: string | null
          trigger_params?: Json
          trigger_type?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "reminder_rules_assigned_to_role_id_fkey"
            columns: ["assigned_to_role_id"]
            isOneToOne: false
            referencedRelation: "roles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reminder_rules_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reminder_rules_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      role_permissions: {
        Row: {
          created_at: string
          is_granted: boolean
          permission_id: string
          role_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          is_granted?: boolean
          permission_id: string
          role_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          is_granted?: boolean
          permission_id?: string
          role_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "role_permissions_permission_id_fkey"
            columns: ["permission_id"]
            isOneToOne: false
            referencedRelation: "permissions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "role_permissions_role_id_fkey"
            columns: ["role_id"]
            isOneToOne: false
            referencedRelation: "roles"
            referencedColumns: ["id"]
          },
        ]
      }
      roles: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          is_system: boolean
          key: string
          name_en: string
          name_he: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          is_system?: boolean
          key: string
          name_en: string
          name_he: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          is_system?: boolean
          key?: string
          name_en?: string
          name_he?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      scenario_tracks: {
        Row: {
          amount: number
          annual_rate_pct: number
          cpi_annual_pct: number | null
          created_at: string
          created_by: string | null
          deleted_at: string | null
          deleted_by: string | null
          grace_months: number | null
          id: string
          mix_label: string
          repayment_type: string
          scenario_id: string
          sort_order: number
          term_months: number
          track_type: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          amount: number
          annual_rate_pct: number
          cpi_annual_pct?: number | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          grace_months?: number | null
          id?: string
          mix_label?: string
          repayment_type: string
          scenario_id: string
          sort_order?: number
          term_months: number
          track_type: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          amount?: number
          annual_rate_pct?: number
          cpi_annual_pct?: number | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          grace_months?: number | null
          id?: string
          mix_label?: string
          repayment_type?: string
          scenario_id?: string
          sort_order?: number
          term_months?: number
          track_type?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "scenario_tracks_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "scenario_tracks_deleted_by_fkey"
            columns: ["deleted_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "scenario_tracks_scenario_id_fkey"
            columns: ["scenario_id"]
            isOneToOne: false
            referencedRelation: "mortgage_scenarios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "scenario_tracks_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      stage_durations: {
        Row: {
          case_id: string
          created_at: string
          duration_days: number | null
          entered_at: string
          exited_at: string | null
          id: string
          status_id: string
        }
        Insert: {
          case_id: string
          created_at?: string
          duration_days?: number | null
          entered_at?: string
          exited_at?: string | null
          id?: string
          status_id: string
        }
        Update: {
          case_id?: string
          created_at?: string
          duration_days?: number | null
          entered_at?: string
          exited_at?: string | null
          id?: string
          status_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "stage_durations_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "cases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stage_durations_status_id_fkey"
            columns: ["status_id"]
            isOneToOne: false
            referencedRelation: "case_statuses"
            referencedColumns: ["id"]
          },
        ]
      }
      tasks: {
        Row: {
          assigned_to: string | null
          automation_rule_id: string | null
          case_id: string | null
          completed_at: string | null
          completed_by: string | null
          created_at: string
          created_by: string | null
          deleted_at: string | null
          description: string | null
          due_date: string | null
          google_calendar_event_id: string | null
          id: string
          is_automated: boolean
          lead_id: string | null
          metadata: Json
          priority: string
          snoozed_until: string | null
          status: string
          tags: string[]
          title: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          assigned_to?: string | null
          automation_rule_id?: string | null
          case_id?: string | null
          completed_at?: string | null
          completed_by?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          description?: string | null
          due_date?: string | null
          google_calendar_event_id?: string | null
          id?: string
          is_automated?: boolean
          lead_id?: string | null
          metadata?: Json
          priority?: string
          snoozed_until?: string | null
          status?: string
          tags?: string[]
          title: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          assigned_to?: string | null
          automation_rule_id?: string | null
          case_id?: string | null
          completed_at?: string | null
          completed_by?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          description?: string | null
          due_date?: string | null
          google_calendar_event_id?: string | null
          id?: string
          is_automated?: boolean
          lead_id?: string | null
          metadata?: Json
          priority?: string
          snoozed_until?: string | null
          status?: string
          tags?: string[]
          title?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tasks_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_automation_rule_id_fkey"
            columns: ["automation_rule_id"]
            isOneToOne: false
            referencedRelation: "reminder_rules"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "cases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_completed_by_fkey"
            columns: ["completed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_permission_overrides: {
        Row: {
          created_at: string
          created_by: string | null
          is_granted: boolean
          permission_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          is_granted: boolean
          permission_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          is_granted?: boolean
          permission_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_permission_overrides_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_permission_overrides_permission_id_fkey"
            columns: ["permission_id"]
            isOneToOne: false
            referencedRelation: "permissions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_permission_overrides_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      can_view_case: { Args: { p_case_id: string }; Returns: boolean }
      cases_dashboard_bootstrap: { Args: never; Returns: Json }
      cleanup_old_audit_logs: { Args: never; Returns: number }
      cleanup_rate_limit_counters: { Args: never; Returns: number }
      cleanup_soft_deleted_records: { Args: never; Returns: Json }
      consume_rate_limit: {
        Args: {
          p_action: string
          p_max: number
          p_subject: string
          p_window_seconds: number
        }
        Returns: boolean
      }
      convert_lead_to_case: { Args: { p_lead_id: string }; Returns: string }
      create_case_draft: {
        Args: { p_borrowers: Json; p_request_details: string }
        Returns: string
      }
      create_case_with_financials: {
        Args: {
          p_assigned_advisor_id: string
          p_case_type_primary_id: string
          p_case_type_secondary_id: string
          p_equity: number
          p_expected_income: number
          p_fee_amount: number
          p_property_value: number
          p_referrer_name: string
          p_request_details: string
          p_requested_mortgage_amount: number
          p_status_id: string
        }
        Returns: string
      }
      ensure_audit_log_partitions_ahead: {
        Args: { p_months?: number }
        Returns: number
      }
      generate_case_number: { Args: never; Returns: string }
      has_permission: { Args: { perm_key: string }; Returns: boolean }
      has_permissions: { Args: { perm_keys: string[] }; Returns: Json }
      import_cases: { Args: { p_rows: Json }; Returns: Json }
      insert_overdue_notifications: { Args: { p_rows: Json }; Returns: number }
      is_active_profile: { Args: { uid: string }; Returns: boolean }
      is_admin: { Args: never; Returns: boolean }
      layout_bootstrap: { Args: never; Returns: Json }
      list_deleted_cases: {
        Args: { p_cutoff: string }
        Returns: {
          assigned_advisor_first_name: string
          assigned_advisor_last_name: string
          case_number: string
          deleted_at: string
          deleted_by_first_name: string
          deleted_by_last_name: string
          id: string
          primary_borrower_first_name: string
          primary_borrower_last_name: string
          status_color: string
          status_name_en: string
          status_name_he: string
        }[]
      }
      permanently_delete_case: {
        Args: { p_case_id: string; p_confirm_case_number: string }
        Returns: boolean
      }
      restore_backup_snapshot: { Args: { p_snapshot: Json }; Returns: Json }
      restore_case: { Args: { p_case_id: string }; Returns: boolean }
      save_borrower_for_case: {
        Args: {
          p_birth_date: string
          p_borrower_id: string
          p_case_id: string
          p_email: string
          p_first_name: string
          p_is_primary: boolean
          p_last_name: string
          p_national_id: string
          p_phone: string
        }
        Returns: string
      }
      save_borrower_for_case_full: {
        Args: {
          p_borrower_id: string
          p_case_id: string
          p_fields: Json
          p_is_primary: boolean
          p_role: string
        }
        Returns: string
      }
      save_mortgage_scenario: { Args: { p_payload: Json }; Returns: string }
      save_notification_settings: {
        Args: {
          p_email_task_assigned: boolean
          p_email_task_completed: boolean
          p_sla?: Json
        }
        Returns: undefined
      }
      save_regulatory_thresholds: {
        Args: { p_thresholds: Json }
        Returns: undefined
      }
      add_case_checklist_item: {
        Args: { p_case_id: string; p_label: string }
        Returns: string
      }
      get_or_create_case_checklist: {
        Args: { p_case_id: string }
        Returns: Json
      }
      remove_case_checklist_item: {
        Args: { p_case_id: string; p_item_id: string }
        Returns: boolean
      }
      reorder_case_checklist_items: {
        Args: { p_case_id: string; p_ids: string[] }
        Returns: boolean
      }
      set_primary_bank: {
        Args: { p_bank_id: string; p_case_id: string; p_user_id: string }
        Returns: undefined
      }
      toggle_case_checklist_item: {
        Args: { p_case_id: string; p_done: boolean; p_item_id: string }
        Returns: boolean
      }
      set_request_audit_context: { Args: never; Returns: undefined }
      soft_delete_borrower_income: {
        Args: { p_case_id: string; p_income_id: string }
        Returns: boolean
      }
      soft_delete_borrower_obligation: {
        Args: { p_case_id: string; p_obligation_id: string }
        Returns: boolean
      }
      soft_delete_case: { Args: { p_case_id: string }; Returns: boolean }
      soft_delete_case_expense: {
        Args: { p_case_id: string; p_expense_id: string }
        Returns: boolean
      }
      soft_delete_scenario: {
        Args: { p_scenario_id: string }
        Returns: boolean
      }
      update_borrower_in_case: {
        Args: { p_borrower_id: string; p_case_id: string; p_patch: Json }
        Returns: boolean
      }
      update_case_drive_meta: {
        Args: { p_case_id: string; p_patch: Json }
        Returns: undefined
      }
      update_document_metadata: {
        Args: { p_document_id: string; p_patch: Json }
        Returns: undefined
      }
      upsert_case_financials: {
        Args: {
          p_case_id: string
          p_expected_income: number
          p_fee_amount: number
          p_user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
