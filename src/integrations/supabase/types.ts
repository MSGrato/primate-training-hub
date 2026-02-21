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
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      agent_train_feedback: {
        Row: {
          created_at: string
          id: string
          intent: string | null
          prompt: string
          rating: number
          response_summary: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          intent?: string | null
          prompt: string
          rating: number
          response_summary: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          intent?: string | null
          prompt?: string
          rating?: number
          response_summary?: string
          user_id?: string
        }
        Relationships: []
      }
      job_tags: {
        Row: {
          created_at: string
          id: string
          name: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
        }
        Relationships: []
      }
      job_title_tags: {
        Row: {
          id: string
          job_tag_id: string
          job_title_id: string
        }
        Insert: {
          id?: string
          job_tag_id: string
          job_title_id: string
        }
        Update: {
          id?: string
          job_tag_id?: string
          job_title_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "job_title_tags_job_tag_id_fkey"
            columns: ["job_tag_id"]
            isOneToOne: false
            referencedRelation: "job_tags"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "job_title_tags_job_title_id_fkey"
            columns: ["job_title_id"]
            isOneToOne: false
            referencedRelation: "job_titles"
            referencedColumns: ["id"]
          },
        ]
      }
      job_titles: {
        Row: {
          created_at: string
          description: string | null
          id: string
          name: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          name: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          name?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          full_name: string
          id: string
          is_active: boolean
          job_title_id: string | null
          net_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          full_name: string
          id?: string
          is_active?: boolean
          job_title_id?: string | null
          net_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          full_name?: string
          id?: string
          is_active?: boolean
          job_title_id?: string | null
          net_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_profiles_job_title"
            columns: ["job_title_id"]
            isOneToOne: false
            referencedRelation: "job_titles"
            referencedColumns: ["id"]
          },
        ]
      }
      supervisor_employee_mappings: {
        Row: {
          employee_id: string
          id: string
          supervisor_id: string
        }
        Insert: {
          employee_id: string
          id?: string
          supervisor_id: string
        }
        Update: {
          employee_id?: string
          id?: string
          supervisor_id?: string
        }
        Relationships: []
      }
      training_completions: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          completed_at: string
          created_at: string
          id: string
          status: Database["public"]["Enums"]["approval_status"]
          training_id: string
          user_id: string
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          completed_at?: string
          created_at?: string
          id?: string
          status?: Database["public"]["Enums"]["approval_status"]
          training_id: string
          user_id: string
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          completed_at?: string
          created_at?: string
          id?: string
          status?: Database["public"]["Enums"]["approval_status"]
          training_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "training_completions_training_id_fkey"
            columns: ["training_id"]
            isOneToOne: false
            referencedRelation: "trainings"
            referencedColumns: ["id"]
          },
        ]
      }
      training_tag_assignments: {
        Row: {
          id: string
          job_tag_id: string
          training_id: string
        }
        Insert: {
          id?: string
          job_tag_id: string
          training_id: string
        }
        Update: {
          id?: string
          job_tag_id?: string
          training_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "training_tag_assignments_job_tag_id_fkey"
            columns: ["job_tag_id"]
            isOneToOne: false
            referencedRelation: "job_tags"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "training_tag_assignments_training_id_fkey"
            columns: ["training_id"]
            isOneToOne: false
            referencedRelation: "trainings"
            referencedColumns: ["id"]
          },
        ]
      }
      trainings: {
        Row: {
          category: Database["public"]["Enums"]["training_category"]
          content_type: string | null
          content_url: string | null
          created_at: string
          description: string | null
          frequency: Database["public"]["Enums"]["training_frequency"]
          id: string
          title: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          category: Database["public"]["Enums"]["training_category"]
          content_type?: string | null
          content_url?: string | null
          created_at?: string
          description?: string | null
          frequency?: Database["public"]["Enums"]["training_frequency"]
          id?: string
          title: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          category?: Database["public"]["Enums"]["training_category"]
          content_type?: string | null
          content_url?: string | null
          created_at?: string
          description?: string | null
          frequency?: Database["public"]["Enums"]["training_frequency"]
          id?: string
          title?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      user_training_assignments: {
        Row: {
          assigned_at: string
          id: string
          training_id: string
          user_id: string
        }
        Insert: {
          assigned_at?: string
          id?: string
          training_id: string
          user_id: string
        }
        Update: {
          assigned_at?: string
          id?: string
          training_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_training_assignments_training_id_fkey"
            columns: ["training_id"]
            isOneToOne: false
            referencedRelation: "trainings"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      assign_required_trainings_for_all_users: { Args: never; Returns: number }
      assign_required_trainings_for_user: {
        Args: { p_user_id: string }
        Returns: number
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "employee" | "supervisor" | "coordinator"
      approval_status: "pending" | "approved" | "rejected"
      training_category: "onboarding" | "on_the_job" | "sop"
      training_frequency: "one_time" | "annual" | "semi_annual" | "as_needed"
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
    Enums: {
      app_role: ["employee", "supervisor", "coordinator"],
      approval_status: ["pending", "approved", "rejected"],
      training_category: ["onboarding", "on_the_job", "sop"],
      training_frequency: ["one_time", "annual", "semi_annual", "as_needed"],
    },
  },
} as const
