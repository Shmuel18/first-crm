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
          address: string | null
          birth_date: string | null
          children_count: number | null
          citizenship: string | null
          created_at: string
          created_by: string | null
          credit_rating: string | null
          deleted_at: string | null
          email: string | null
          employer_name: string | null
          employment_status: string | null
          first_name: string | null
          id: string
          last_name: string | null
          marital_status: string | null
          metadata: Json
          national_id: string | null
          notes: string | null
          owns_other_property: boolean | null
          phone: string | null
          residency_type: string | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          address?: string | null
          birth_date?: string | null
          children_count?: number | null
          citizenship?: string | null
          created_at?: string
          created_by?: string | null
          credit_rating?: string | null
          deleted_at?: string | null
          email?: string | null
          employer_name?: string | null
          employment_status?: string | null
          first_name?: string | null
          id?: string
          last_name?: string | null
          marital_status?: string | null
          metadata?: Json
          national_id?: string | null
          notes?: string | null
          owns_other_property?: boolean | null
          phone?: string | null
          residency_type?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          address?: string | null
          birth_date?: string | null
          children_count?: number | null
          citizenship?: string | null
          created_at?: string
          created_by?: string | null
          credit_rating?: string | null
          deleted_at?: string | null
          email?: string | null
          employer_name?: string | null
          employment_status?: string | null
          first_name?: string | null
          id?: string
          last_name?: string | null
          marital_status?: string | null
          metadata?: Json
          national_id?: string | null
          notes?: string | null
          owns_other_property?: boolean | null
          phone?: string | null
          residency_type?: string | null
          updated_at?: string
          updated_by?: string | null
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
          is_primary: boolean
          role_in_case: string
        }
        Insert: {
          borrower_id: string
          case_id: string
          created_at?: string
          is_primary?: boolean
          role_in_case?: string
        }
        Update: {
          borrower_id?: string
          case_id?: string
          created_at?: string
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
          case_type_primary_id: string | null
          case_type_secondary_id: string | null
          created_at: string
          created_by: string | null
          deleted_at: string | null
          equity: number | null
          expected_income: number | null
          fee_amount: number | null
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
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          assigned_advisor_id?: string | null
          case_blocker?: string | null
          case_number?: string
          case_type_primary_id?: string | null
          case_type_secondary_id?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          equity?: number | null
          expected_income?: number | null
          fee_amount?: number | null
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
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          assigned_advisor_id?: string | null
          case_blocker?: string | null
          case_number?: string
          case_type_primary_id?: string | null
          case_type_secondary_id?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          equity?: number | null
          expected_income?: number | null
          fee_amount?: number | null
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
          updated_at?: string
          updated_by?: string | null
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
          secondary_color: string
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
          secondary_color?: string
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
          secondary_color?: string
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
      cleanup_old_audit_logs: { Args: never; Returns: number }
      cleanup_soft_deleted_records: { Args: never; Returns: Json }
      generate_case_number: { Args: never; Returns: string }
      has_permission: { Args: { perm_key: string }; Returns: boolean }
      is_admin: { Args: never; Returns: boolean }
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
