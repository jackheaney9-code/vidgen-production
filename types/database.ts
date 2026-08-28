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
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          email: string
          credits?: number
          created_at?: string
          updated_at?: string
        }
        Update: {
          email?: string
          credits?: number
          updated_at?: string
        }
        Relationships: []
      }
      ads: {
        Row: {
          id: string
          user_id: string
          product_name: string
          product_description: string
          audience: string
          style: string
          product_image_path: string
          script: Json | null
          video_path: string | null
          voice_path: string | null
          final_path: string | null
          status: string
          error: string | null
          credit_deducted: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          product_name: string
          product_description: string
          audience: string
          style: string
          product_image_path: string
          script?: Json | null
          video_path?: string | null
          voice_path?: string | null
          final_path?: string | null
          status?: string
          error?: string | null
          credit_deducted?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          product_name?: string
          product_description?: string
          audience?: string
          style?: string
          product_image_path?: string
          script?: Json | null
          video_path?: string | null
          voice_path?: string | null
          final_path?: string | null
          status?: string
          error?: string | null
          credit_deducted?: boolean
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ads_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      credit_transactions: {
        Row: {
          id: string
          user_id: string
          amount: number
          reason: string
          ad_id: string | null
          stripe_session_id: string | null
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          amount: number
          reason: string
          ad_id?: string | null
          stripe_session_id?: string | null
          created_at?: string
        }
        Update: {
          amount?: number
          reason?: string
          ad_id?: string | null
          stripe_session_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "credit_transactions_user_id_fkey"
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
          p_reason: string
          p_ad_id?: string | null
          p_stripe_session_id?: string | null
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
