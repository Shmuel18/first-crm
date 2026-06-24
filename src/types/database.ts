export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: {
      approval_rulesets: {
        Row: {
          bank_id: string | null
          created_at: string
          created_by: string | null
          deleted_at: string | null
          deleted_by: string | null
          id: string
          is_active: boolean
          name: string
          rules_json: Json
          updated_at: string
          updated_by: string | null
          version: number
        }
        Insert: {
          bank_id?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          id?: string
          is_active?: boolean
          name: string
          rules_json?: Json
          updated_at?: string
          updated_by?: string | null
          version?: number
        }
        Update: {
          bank_id?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          id?: string
          is_active?: boolean
          name?: string
          rules_json?: Json
          updated_at?: string
          updated_by?: string | null
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "approval_rulesets_bank_id_fkey"
            columns: ["bank_id"]
            isOneToOne: false
            referencedRelation: "banks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "approval_rulesets_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "approval_rulesets_deleted_by_fkey"
            columns: ["deleted_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "approval_rulesets_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
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
      bank_offer_tracks: {
        Row: {
          amount: number
          annual_rate_pct: number
          cpi_annual_assumption_pct: number | null
          created_at: string
          created_by: string | null
          deleted_at: string | null
          deleted_by: string | null
          id: string
          offer_id: string
          prime_margin_pct: number | null
          rate_change_period_months: number | null
          repayment_type: string
          sort_order: number
          term_months: number
          track_type: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          amount: number
          annual_rate_pct: number
          cpi_annual_assumption_pct?: number | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          id?: string
          offer_id: string
          prime_margin_pct?: number | null
          rate_change_period_months?: number | null
          repayment_type: string
          sort_order?: number
          term_months: number
          track_type: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          amount?: number
          annual_rate_pct?: number
          cpi_annual_assumption_pct?: number | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          id?: string
          offer_id?: string
          prime_margin_pct?: number | null
          rate_change_period_months?: number | null
          repayment_type?: string
          sort_order?: number
          term_months?: number
          track_type?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "bank_offer_tracks_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bank_offer_tracks_deleted_by_fkey"
            columns: ["deleted_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bank_offer_tracks_offer_id_fkey"
            columns: ["offer_id"]
            isOneToOne: false
            referencedRelation: "bank_offers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bank_offer_tracks_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      bank_offers: {
        Row: {
          approval_type: string
          bank_id: string
          branch_name: string | null
          case_id: string
          contact_name: string | null
          created_at: string
          created_by: string | null
          deleted_at: string | null
          deleted_by: string | null
          expires_at: string | null
          id: string
          notes: string | null
          offer_date: string
          source_document_id: string | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          approval_type: string
          bank_id: string
          branch_name?: string | null
          case_id: string
          contact_name?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          expires_at?: string | null
          id?: string
          notes?: string | null
          offer_date: string
          source_document_id?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          approval_type?: string
          bank_id?: string
          branch_name?: string | null
          case_id?: string
          contact_name?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          expires_at?: string | null
          id?: string
          notes?: string | null
          offer_date?: string
          source_document_id?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "bank_offers_bank_id_fkey"
            columns: ["bank_id"]
            isOneToOne: false
            referencedRelation: "banks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bank_offers_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "cases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bank_offers_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bank_offers_deleted_by_fkey"
            columns: ["deleted_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bank_offers_source_document_id_fkey"
            columns: ["source_document_id"]
            isOneToOne: false
            referencedRelation: "documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bank_offers_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
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
      case_associated_advisors: {
        Row: {
          added_at: string
          added_by: string | null
          advisor_id: string
          case_id: string
        }
        Insert: {
          added_at?: string
          added_by?: string | null
          advisor_id: string
          case_id: string
        }
        Update: {
          added_at?: string
          added_by?: string | null
          advisor_id?: string
          case_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "case_associated_advisors_added_by_fkey"
            columns: ["added_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "case_associated_advisors_advisor_id_fkey"
            columns: ["advisor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "case_associated_advisors_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "cases"
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
      case_block_preferences: {
        Row: {
          prefs: Json
          updated_at: string
          user_id: string
        }
        Insert: {
          prefs?: Json
          updated_at?: string
          user_id: string
        }
        Update: {
          prefs?: Json
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "case_block_preferences_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
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
            foreignKeyName: "case_checklist_items_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
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
            foreignKeyName: "case_checklist_items_done_by_fkey"
            columns: ["done_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "case_checklist_items_required_at_stage_id_fkey"
            columns: ["required_at_stage_id"]
            isOneToOne: false
            referencedRelation: "case_statuses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "case_checklist_items_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      case_comments: {
        Row: {
          author_id: string
          body: string
          case_id: string
          created_at: string
          edited_at: string | null
          id: string
        }
        Insert: {
          author_id: string
          body: string
          case_id: string
          created_at?: string
          edited_at?: string | null
          id?: string
        }
        Update: {
          author_id?: string
          body?: string
          case_id?: string
          created_at?: string
          edited_at?: string | null
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "case_comments_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "case_comments_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "cases"
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
          receipt_drive_id: string | null
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
          receipt_drive_id?: string | null
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
          receipt_drive_id?: string | null
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
      case_fee_payments: {
        Row: {
          amount: number | null
          case_id: string
          created_at: string
          created_by: string | null
          deleted_at: string | null
          deleted_by: string | null
          id: string
          label: string | null
          note: string | null
          paid_on: string | null
          payment_method: string | null
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
          id?: string
          label?: string | null
          note?: string | null
          paid_on?: string | null
          payment_method?: string | null
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
          id?: string
          label?: string | null
          note?: string | null
          paid_on?: string | null
          payment_method?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "case_fee_payments_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "cases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "case_fee_payments_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "case_fee_payments_deleted_by_fkey"
            columns: ["deleted_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "case_fee_payments_updated_by_fkey"
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
          fee_paid: boolean
          fee_paid_at: string | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          case_id: string
          created_at?: string
          created_by?: string | null
          expected_income?: number | null
          fee_amount?: number | null
          fee_paid?: boolean
          fee_paid_at?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          case_id?: string
          created_at?: string
          created_by?: string | null
          expected_income?: number | null
          fee_amount?: number | null
          fee_paid?: boolean
          fee_paid_at?: string | null
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
      case_payouts: {
        Row: {
          amount: number | null
          case_id: string
          created_at: string
          created_by: string | null
          deleted_at: string | null
          deleted_by: string | null
          id: string
          recipient: string | null
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
          id?: string
          recipient?: string | null
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
          id?: string
          recipient?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "case_payouts_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "cases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "case_payouts_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "case_payouts_deleted_by_fkey"
            columns: ["deleted_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "case_payouts_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      case_properties: {
        Row: {
          case_id: string
          case_type_other_text: string | null
          case_type_primary_id: string | null
          city: string | null
          created_at: string
          created_by: string | null
          deleted_at: string | null
          deleted_by: string | null
          gush_helka: string | null
          id: string
          property_value: number | null
          requested_mortgage_amount: number | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          case_id: string
          case_type_other_text?: string | null
          case_type_primary_id?: string | null
          city?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          gush_helka?: string | null
          id?: string
          property_value?: number | null
          requested_mortgage_amount?: number | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          case_id?: string
          case_type_other_text?: string | null
          case_type_primary_id?: string | null
          city?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          gush_helka?: string | null
          id?: string
          property_value?: number | null
          requested_mortgage_amount?: number | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "case_properties_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "cases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "case_properties_case_type_primary_id_fkey"
            columns: ["case_type_primary_id"]
            isOneToOne: false
            referencedRelation: "case_types"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "case_properties_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "case_properties_deleted_by_fkey"
            columns: ["deleted_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "case_properties_updated_by_fkey"
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
          appraiser_name: string | null
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
          gush_helka: string | null
          id: string
          insurance_agent_name: string | null
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
          appraiser_name?: string | null
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
          gush_helka?: string | null
          id?: string
          insurance_agent_name?: string | null
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
          appraiser_name?: string | null
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
          gush_helka?: string | null
          id?: string
          insurance_agent_name?: string | null
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
      checklist_templates: {
        Row: {
          created_at: string
          created_by: string | null
          group_key: string
          id: string
          is_active: boolean
          is_system: boolean
          items: Json
          name_en: string
          name_he: string
          sort_order: number
          template_key: string | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          group_key?: string
          id?: string
          is_active?: boolean
          is_system?: boolean
          items?: Json
          name_en?: string
          name_he: string
          sort_order?: number
          template_key?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          group_key?: string
          id?: string
          is_active?: boolean
          is_system?: boolean
          items?: Json
          name_en?: string
          name_he?: string
          sort_order?: number
          template_key?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "checklist_templates_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "checklist_templates_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      client_email_log: {
        Row: {
          body: string
          case_id: string
          created_at: string
          id: string
          kind: string
          recipient_email: string
          sent_by: string | null
          subject: string
        }
        Insert: {
          body?: string
          case_id: string
          created_at?: string
          id?: string
          kind: string
          recipient_email: string
          sent_by?: string | null
          subject: string
        }
        Update: {
          body?: string
          case_id?: string
          created_at?: string
          id?: string
          kind?: string
          recipient_email?: string
          sent_by?: string | null
          subject?: string
        }
        Relationships: [
          {
            foreignKeyName: "client_email_log_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "cases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_email_log_sent_by_fkey"
            columns: ["sent_by"]
            isOneToOne: false
            referencedRelation: "profiles"
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
      erasure_orphan_log: {
        Row: {
          deleted_at: string | null
          drive_file_id: string | null
          entity: string
          id: number
          logged_at: string
          row_id: string
          storage_path: string | null
        }
        Insert: {
          deleted_at?: string | null
          drive_file_id?: string | null
          entity: string
          id?: never
          logged_at?: string
          row_id: string
          storage_path?: string | null
        }
        Update: {
          deleted_at?: string | null
          drive_file_id?: string | null
          entity?: string
          id?: never
          logged_at?: string
          row_id?: string
          storage_path?: string | null
        }
        Relationships: []
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
      market_data_points: {
        Row: {
          created_at: string
          created_by: string | null
          deleted_at: string | null
          deleted_by: string | null
          fetched_at: string
          id: string
          is_manual_override: boolean
          override_reason: string | null
          period_end: string | null
          period_start: string
          series_key: string
          source_etag: string | null
          source_hash: string | null
          source_id: string
          source_published_at: string | null
          updated_at: string
          updated_by: string | null
          value_json: Json
          value_numeric: number | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          fetched_at?: string
          id?: string
          is_manual_override?: boolean
          override_reason?: string | null
          period_end?: string | null
          period_start: string
          series_key: string
          source_etag?: string | null
          source_hash?: string | null
          source_id: string
          source_published_at?: string | null
          updated_at?: string
          updated_by?: string | null
          value_json?: Json
          value_numeric?: number | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          fetched_at?: string
          id?: string
          is_manual_override?: boolean
          override_reason?: string | null
          period_end?: string | null
          period_start?: string
          series_key?: string
          source_etag?: string | null
          source_hash?: string | null
          source_id?: string
          source_published_at?: string | null
          updated_at?: string
          updated_by?: string | null
          value_json?: Json
          value_numeric?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "market_data_points_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "market_data_points_deleted_by_fkey"
            columns: ["deleted_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "market_data_points_source_id_fkey"
            columns: ["source_id"]
            isOneToOne: false
            referencedRelation: "market_data_sources"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "market_data_points_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      maaser_payments: {
        Row: {
          amount: number
          created_at: string
          created_by: string | null
          deleted_at: string | null
          deleted_by: string | null
          id: string
          note: string | null
          paid_on: string
          recipient: string | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          amount: number
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          id?: string
          note?: string | null
          paid_on?: string
          recipient?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          amount?: number
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          id?: string
          note?: string | null
          paid_on?: string
          recipient?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "maaser_payments_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "maaser_payments_deleted_by_fkey"
            columns: ["deleted_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "maaser_payments_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      market_data_snapshots: {
        Row: {
          created_at: string
          created_by: string | null
          freshness_json: Json
          id: string
          snapshot_json: Json
          source_versions: Json
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          freshness_json?: Json
          id?: string
          snapshot_json?: Json
          source_versions?: Json
        }
        Update: {
          created_at?: string
          created_by?: string | null
          freshness_json?: Json
          id?: string
          snapshot_json?: Json
          source_versions?: Json
        }
        Relationships: [
          {
            foreignKeyName: "market_data_snapshots_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      market_data_sources: {
        Row: {
          access_method: string
          created_at: string
          created_by: string | null
          deleted_at: string | null
          deleted_by: string | null
          expected_frequency: string
          id: string
          is_enabled: boolean
          last_failure_at: string | null
          last_failure_code: string | null
          last_success_at: string | null
          name_en: string
          name_he: string
          source_key: string
          source_url: string
          stale_after_hours: number
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          access_method: string
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          expected_frequency: string
          id?: string
          is_enabled?: boolean
          last_failure_at?: string | null
          last_failure_code?: string | null
          last_success_at?: string | null
          name_en: string
          name_he: string
          source_key: string
          source_url: string
          stale_after_hours: number
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          access_method?: string
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          expected_frequency?: string
          id?: string
          is_enabled?: boolean
          last_failure_at?: string | null
          last_failure_code?: string | null
          last_success_at?: string | null
          name_en?: string
          name_he?: string
          source_key?: string
          source_url?: string
          stale_after_hours?: number
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "market_data_sources_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "market_data_sources_deleted_by_fkey"
            columns: ["deleted_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "market_data_sources_updated_by_fkey"
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
          data_as_of: string | null
          deleted_at: string | null
          deleted_by: string | null
          engine_version: string
          equity: number
          id: string
          inputs: Json
          is_primary: boolean
          kind: string
          market_snapshot_id: string | null
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
          data_as_of?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          engine_version?: string
          equity: number
          id?: string
          inputs?: Json
          is_primary?: boolean
          kind: string
          market_snapshot_id?: string | null
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
          data_as_of?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          engine_version?: string
          equity?: number
          id?: string
          inputs?: Json
          is_primary?: boolean
          kind?: string
          market_snapshot_id?: string | null
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
            foreignKeyName: "mortgage_scenarios_market_snapshot_id_fkey"
            columns: ["market_snapshot_id"]
            isOneToOne: false
            referencedRelation: "market_data_snapshots"
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
          email_case_status_overdue: boolean
          email_mentions: boolean
          email_task_assigned: boolean
          email_task_completed: boolean
          email_task_reminder: boolean
          updated_at: string
          user_id: string
        }
        Insert: {
          email_case_status_overdue?: boolean
          email_mentions?: boolean
          email_task_assigned?: boolean
          email_task_completed?: boolean
          email_task_reminder?: boolean
          updated_at?: string
          user_id: string
        }
        Update: {
          email_case_status_overdue?: boolean
          email_mentions?: boolean
          email_task_assigned?: boolean
          email_task_completed?: boolean
          email_task_reminder?: boolean
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
          documentation_celebrations_enabled: boolean
          document_expiry_warning_days: number
          email_header_image_url: string | null
          email_main: string | null
          email_reply_to_address: string | null
          email_sender_address: string | null
          email_sender_name: string | null
          email_service_provider: string
          id: number
          last_backup_at: string | null
          last_erasure_at: string | null
          metadata: Json
          office_logo_url: string | null
          office_name: string
          office_tagline: string | null
          phone_fax: string | null
          phone_main: string | null
          primary_color: string
          regulatory_thresholds: Json
          retention_purge_enabled: boolean
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
          documentation_celebrations_enabled?: boolean
          document_expiry_warning_days?: number
          email_header_image_url?: string | null
          email_main?: string | null
          email_reply_to_address?: string | null
          email_sender_address?: string | null
          email_sender_name?: string | null
          email_service_provider?: string
          id?: number
          last_backup_at?: string | null
          last_erasure_at?: string | null
          metadata?: Json
          office_logo_url?: string | null
          office_name?: string
          office_tagline?: string | null
          phone_fax?: string | null
          phone_main?: string | null
          primary_color?: string
          regulatory_thresholds?: Json
          retention_purge_enabled?: boolean
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
          documentation_celebrations_enabled?: boolean
          document_expiry_warning_days?: number
          email_header_image_url?: string | null
          email_main?: string | null
          email_reply_to_address?: string | null
          email_sender_address?: string | null
          email_sender_name?: string | null
          email_service_provider?: string
          id?: number
          last_backup_at?: string | null
          last_erasure_at?: string | null
          metadata?: Json
          office_logo_url?: string | null
          office_name?: string
          office_tagline?: string | null
          phone_fax?: string | null
          phone_main?: string | null
          primary_color?: string
          regulatory_thresholds?: Json
          retention_purge_enabled?: boolean
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
          is_protected: boolean
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
          is_protected?: boolean
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
          is_protected?: boolean
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
      purchase_tax_brackets: {
        Row: {
          buyer_profile: string
          created_at: string
          created_by: string | null
          deleted_at: string | null
          deleted_by: string | null
          from_amount: number
          id: string
          is_manual: boolean
          rate_pct: number
          source_id: string | null
          source_url: string | null
          to_amount: number | null
          updated_at: string
          updated_by: string | null
          valid_from: string
          valid_to: string | null
        }
        Insert: {
          buyer_profile: string
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          from_amount: number
          id?: string
          is_manual?: boolean
          rate_pct: number
          source_id?: string | null
          source_url?: string | null
          to_amount?: number | null
          updated_at?: string
          updated_by?: string | null
          valid_from: string
          valid_to?: string | null
        }
        Update: {
          buyer_profile?: string
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          from_amount?: number
          id?: string
          is_manual?: boolean
          rate_pct?: number
          source_id?: string | null
          source_url?: string | null
          to_amount?: number | null
          updated_at?: string
          updated_by?: string | null
          valid_from?: string
          valid_to?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "purchase_tax_brackets_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_tax_brackets_deleted_by_fkey"
            columns: ["deleted_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_tax_brackets_source_id_fkey"
            columns: ["source_id"]
            isOneToOne: false
            referencedRelation: "market_data_sources"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_tax_brackets_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      push_subscriptions: {
        Row: {
          auth: string
          created_at: string
          endpoint: string
          id: number
          last_seen_at: string
          p256dh: string
          user_agent: string | null
          user_id: string
        }
        Insert: {
          auth: string
          created_at?: string
          endpoint: string
          id?: never
          last_seen_at?: string
          p256dh: string
          user_agent?: string | null
          user_id: string
        }
        Update: {
          auth?: string
          created_at?: string
          endpoint?: string
          id?: never
          last_seen_at?: string
          p256dh?: string
          user_agent?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "push_subscriptions_user_id_fkey"
            columns: ["user_id"]
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
      schema_version: {
        Row: {
          applied_at: string
          version: number
        }
        Insert: {
          applied_at?: string
          version: number
        }
        Update: {
          applied_at?: string
          version?: number
        }
        Relationships: []
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
      system_email_templates: {
        Row: {
          body: string
          cta_label: string
          heading: string
          is_enabled: boolean
          locale: string
          subject: string
          template_key: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          body: string
          cta_label: string
          heading: string
          is_enabled?: boolean
          locale: string
          subject: string
          template_key: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          body?: string
          cta_label?: string
          heading?: string
          is_enabled?: boolean
          locale?: string
          subject?: string
          template_key?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "system_email_templates_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      task_assignment_history: {
        Row: {
          assigned_at: string
          assigned_by: string | null
          assigned_from: string | null
          assigned_to: string | null
          id: string
          task_id: string
        }
        Insert: {
          assigned_at?: string
          assigned_by?: string | null
          assigned_from?: string | null
          assigned_to?: string | null
          id?: string
          task_id: string
        }
        Update: {
          assigned_at?: string
          assigned_by?: string | null
          assigned_from?: string | null
          assigned_to?: string | null
          id?: string
          task_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "task_assignment_history_assigned_by_fkey"
            columns: ["assigned_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_assignment_history_assigned_from_fkey"
            columns: ["assigned_from"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_assignment_history_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_assignment_history_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      task_attachments: {
        Row: {
          created_at: string
          drive_file_id: string | null
          drive_file_url: string | null
          file_name: string
          file_size: number
          id: string
          mime_type: string
          storage_path: string
          task_id: string
          uploaded_by: string | null
        }
        Insert: {
          created_at?: string
          drive_file_id?: string | null
          drive_file_url?: string | null
          file_name: string
          file_size: number
          id?: string
          mime_type: string
          storage_path: string
          task_id: string
          uploaded_by?: string | null
        }
        Update: {
          created_at?: string
          drive_file_id?: string | null
          drive_file_url?: string | null
          file_name?: string
          file_size?: number
          id?: string
          mime_type?: string
          storage_path?: string
          task_id?: string
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "task_attachments_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_attachments_uploaded_by_fkey"
            columns: ["uploaded_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      task_comments: {
        Row: {
          author_id: string
          body: string
          created_at: string
          deleted_at: string | null
          edited_at: string | null
          event_type: string
          id: string
          metadata: Json | null
          task_id: string
        }
        Insert: {
          author_id: string
          body: string
          created_at?: string
          deleted_at?: string | null
          edited_at?: string | null
          event_type?: string
          id?: string
          metadata?: Json | null
          task_id: string
        }
        Update: {
          author_id?: string
          body?: string
          created_at?: string
          deleted_at?: string | null
          edited_at?: string | null
          event_type?: string
          id?: string
          metadata?: Json | null
          task_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "task_comments_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_comments_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      tasks: {
        Row: {
          assigned_at: string | null
          assigned_by: string | null
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
          is_private: boolean
          lead_id: string | null
          metadata: Json
          priority: string
          snoozed_until: string | null
          status: string
          title: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          assigned_at?: string | null
          assigned_by?: string | null
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
          is_private?: boolean
          lead_id?: string | null
          metadata?: Json
          priority?: string
          snoozed_until?: string | null
          status?: string
          title: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          assigned_at?: string | null
          assigned_by?: string | null
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
          is_private?: boolean
          lead_id?: string | null
          metadata?: Json
          priority?: string
          snoozed_until?: string | null
          status?: string
          title?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tasks_assigned_by_fkey"
            columns: ["assigned_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
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
      _assert_can_edit_case: { Args: { p_case_id: string }; Returns: undefined }
      active_admin_emails: { Args: never; Returns: string[] }
      add_case_checklist_item: {
        Args: { p_case_id: string; p_label: string }
        Returns: string
      }
      add_empty_borrower_to_case: {
        Args: { p_case_id: string }
        Returns: string
      }
      admin_delete_member: { Args: { p_user_id: string }; Returns: undefined }
      applied_schema_version: { Args: never; Returns: number }
      bootstrap_first_admin: { Args: { p_email: string }; Returns: string }
      can_edit_case: { Args: { p_case_id: string }; Returns: boolean }
      can_view_case: { Args: { p_case_id: string }; Returns: boolean }
      can_view_case_for: {
        Args: { p_case_id: string; p_user_id: string }
        Returns: boolean
      }
      can_view_task: { Args: { p_task_id: string }; Returns: boolean }
      can_view_task_for: {
        Args: { p_task_id: string; p_user_id: string }
        Returns: boolean
      }
      cases_dashboard_bootstrap: { Args: never; Returns: Json }
      cleanup_old_audit_logs: { Args: never; Returns: number }
      cleanup_old_audit_logs_impl: { Args: never; Returns: number }
      cleanup_rate_limit_counters: { Args: never; Returns: number }
      cleanup_soft_deleted_records: { Args: never; Returns: Json }
      cleanup_soft_deleted_records_impl: { Args: never; Returns: Json }
      collections_overview: {
        Args: never
        Returns: {
          assigned_advisor_id: string | null
          case_id: string
          case_number: string
          collected: number
          expenses: number
          fee_amount: number | null
          last_payment_on: string | null
          payment_count: number
        }[]
      }
      consume_public_contact_rate_limit: {
        Args: { p_subject: string }
        Returns: boolean
      }
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
      current_user_active: { Args: never; Returns: boolean }
      delete_failed_case: { Args: { p_case_id: string }; Returns: boolean }
      ensure_audit_log_partitions_ahead: {
        Args: { p_months?: number }
        Returns: number
      }
      generate_case_number: { Args: never; Returns: string }
      get_last_backup_at: { Args: never; Returns: string }
      get_last_erasure_at: { Args: never; Returns: string }
      get_or_create_case_checklist: {
        Args: { p_case_id: string }
        Returns: Json
      }
      get_statistics_monthly_trend: {
        Args: { p_months?: number }
        Returns: Json
      }
      get_statistics_summary: {
        Args: { p_from?: string; p_period?: string; p_to?: string }
        Returns: Json
      }
      has_permission: { Args: { perm_key: string }; Returns: boolean }
      has_permission_for: {
        Args: { p_user_id: string; perm_key: string }
        Returns: boolean
      }
      has_permissions: { Args: { perm_keys: string[] }; Returns: Json }
      import_cases: { Args: { p_rows: Json }; Returns: Json }
      insert_overdue_notifications: { Args: { p_rows: Json }; Returns: number }
      is_active_profile: { Args: { uid: string }; Returns: boolean }
      is_admin: { Args: never; Returns: boolean }
      is_case_associated_advisor: {
        Args: { p_case_id: string }
        Returns: boolean
      }
      is_case_task_member: { Args: { p_case_id: string }; Returns: boolean }
      layout_bootstrap: { Args: never; Returns: Json }
      list_active_advisors: {
        Args: never
        Returns: {
          first_name: string
          id: string
          last_name: string
        }[]
      }
      list_case_mentionable_profiles: {
        Args: { p_case_id: string }
        Returns: {
          first_name: string
          id: string
          last_name: string
        }[]
      }
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
      list_task_mentionable_profiles: {
        Args: { p_task_id: string }
        Returns: {
          first_name: string
          id: string
          last_name: string
        }[]
      }
      notify_admins_backup_stale: {
        Args: { p_last_backup_at?: string }
        Returns: number
      }
      notify_admins_erasure_stale: {
        Args: { p_last_erasure_at?: string }
        Returns: number
      }
      permanently_delete_case: {
        Args: { p_case_id: string; p_confirm_case_number: string }
        Returns: boolean
      }
      reassign_task: {
        Args: { p_assignee_id: string; p_note?: string; p_task_id: string }
        Returns: Json
      }
      record_backup_success: { Args: never; Returns: undefined }
      record_erasure_success: { Args: never; Returns: undefined }
      refund_rate_limit: {
        Args: { p_action: string; p_subject: string; p_window_seconds: number }
        Returns: undefined
      }
      remove_case_checklist_item: {
        Args: { p_case_id: string; p_item_id: string }
        Returns: boolean
      }
      reorder_case_checklist_items: {
        Args: { p_case_id: string; p_ids: string[] }
        Returns: boolean
      }
      restore_backup_snapshot: { Args: { p_snapshot: Json }; Returns: Json }
      restore_case: { Args: { p_case_id: string }; Returns: boolean }
      retention_purge_enabled: { Args: never; Returns: boolean }
      revoke_user_sessions: { Args: { p_user_id: string }; Returns: number }
      save_borrower_for_case_full: {
        Args: {
          p_borrower_id: string
          p_case_id: string
          p_expected_version?: number
          p_fields: Json
          p_is_primary: boolean
          p_role: string
        }
        Returns: string
      }
      save_mortgage_scenario: { Args: { p_payload: Json }; Returns: string }
      save_notification_settings: {
        Args: {
          p_email_case_status_overdue?: boolean
          p_email_mentions?: boolean
          p_email_task_assigned: boolean
          p_email_task_completed: boolean
          p_email_task_reminder?: boolean
          p_sla?: Json
        }
        Returns: undefined
      }
      save_regulatory_thresholds: {
        Args: { p_thresholds: Json }
        Returns: undefined
      }
      set_primary_bank: {
        Args: { p_bank_id: string; p_case_id: string; p_user_id: string }
        Returns: undefined
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
      soft_delete_fee_payment: {
        Args: { p_case_id: string; p_payment_id: string }
        Returns: boolean
      }
      soft_delete_case_payout: {
        Args: { p_case_id: string; p_payout_id: string }
        Returns: boolean
      }
      soft_delete_maaser_payment: {
        Args: { p_id: string }
        Returns: boolean
      }
      soft_delete_case_property: {
        Args: { p_case_id: string; p_property_id: string }
        Returns: boolean
      }
      soft_delete_document_with_tombstone: {
        Args: { p_case_id: string; p_document_id: string; p_user_id: string }
        Returns: undefined
      }
      soft_delete_lead: { Args: { p_lead_id: string }; Returns: undefined }
      set_primary_scenario: {
        Args: { p_scenario_id: string; p_is_primary?: boolean }
        Returns: boolean
      }
      soft_delete_scenario: {
        Args: { p_scenario_id: string }
        Returns: boolean
      }
      soft_delete_task_comment: {
        Args: { p_comment_id: string }
        Returns: undefined
      }
      submit_public_intake:
        | { Args: { p_payload: Json }; Returns: string }
        | {
            Args: {
              p_ip?: string
              p_payload: Json
              p_policy_version?: string
              p_source?: string
            }
            Returns: string
          }
      toggle_case_checklist_item: {
        Args: { p_case_id: string; p_done: boolean; p_item_id: string }
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
