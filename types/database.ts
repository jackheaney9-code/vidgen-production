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
      profiles: {
        Row: {
          id: string
          email: string
          credits: number
          stripe_customer_id: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          email: string
          credits?: number
          stripe_customer_id?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          email?: string
          credits?: number
          stripe_customer_id?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      generations: {
        Row: {
          id: string
          user_id: string
          status: string
          product_name: string
          product_description: string
          target_audience: string
          style: string
          product_image_path: string
          script: string | null
          video_url: string | null
          voiceover_url: string | null
          final_video_url: string | null
          error_message: string | null
          runway_task_id: string | null
          credit_charged: boolean
          credit_refunded: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          status?: string
          product_name: string
          product_description: string
          target_audience: string
          style: string
          product_image_path: string
          script?: string | null
          video_url?: string | null
          voiceover_url?: string | null
          final_video_url?: string | null
          error_message?: string | null
          runway_task_id?: string | null
          credit_charged?: boolean
          credit_refunded?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          status?: string
          product_name?: string
          product_description?: string
          target_audience?: string
          style?: string
          product_image_path?: string
          script?: string | null
          video_url?: string | null
          voiceover_url?: string | null
          final_video_url?: string | null
          error_message?: string | null
          runway_task_id?: string | null
          credit_charged?: boolean
          credit_refunded?: boolean
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "generations_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      purchases: {
        Row: {
          id: string
          user_id: string
          stripe_session_id: string
          credits_purchased: number
          amount_paid: number
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          stripe_session_id: string
          credits_purchased: number
          amount_paid: number
          created_at?: string
        }
        Update: {
          stripe_session_id?: string
          credits_purchased?: number
          amount_paid?: number
        }
        Relationships: [
          {
            foreignKeyName: "purchases_user_id_fkey"
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
      apply_credit_delta: {
        Args: {
          p_delta: number
        }
        Returns: Database["public"]["Tables"]["profiles"]["Row"]
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
