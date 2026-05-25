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
      repos: {
        Row: {
          id: string
          owner: string
          name: string
          full_name: string
          description: string | null
          stars: number
          language: string | null
          github_app_installation_id: number | null
          webhook_active: boolean
          last_polled_at: string | null
          created_at: string
          updated_at: string
          platform: 'github' | 'hugging_face'
          hf_author: string | null
          hf_pipeline_tag: string | null
          hf_likes: number | null
          hf_downloads: number | null
        }
        Insert: {
          id?: string
          owner: string
          name: string
          description?: string | null
          stars?: number
          language?: string | null
          github_app_installation_id?: number | null
          webhook_active?: boolean
          last_polled_at?: string | null
          created_at?: string
          updated_at?: string
          platform?: 'github' | 'hugging_face'
          hf_author?: string | null
          hf_pipeline_tag?: string | null
          hf_likes?: number | null
          hf_downloads?: number | null
        }
        Update: {
          id?: string
          owner?: string
          name?: string
          description?: string | null
          stars?: number
          language?: string | null
          github_app_installation_id?: number | null
          webhook_active?: boolean
          last_polled_at?: string | null
          updated_at?: string
          platform?: 'github' | 'hugging_face'
          hf_author?: string | null
          hf_pipeline_tag?: string | null
          hf_likes?: number | null
          hf_downloads?: number | null
        }
        Relationships: []
      }
      releases: {
        Row: {
          id: string
          repo_id: string
          github_id: number | null
          tag_name: string
          name: string | null
          body: string | null
          published_at: string | null
          is_prerelease: boolean
          is_draft: boolean
          processed_at: string | null
          processing_status: 'pending' | 'processing' | 'done' | 'failed' | 'skipped' | 'queued'
          created_at: string
          hf_commit_sha: string | null
          source_platform: 'github' | 'hugging_face'
        }
        Insert: {
          id?: string
          repo_id: string
          github_id?: number | null
          tag_name: string
          name?: string | null
          body?: string | null
          published_at?: string | null
          is_prerelease?: boolean
          is_draft?: boolean
          processed_at?: string | null
          processing_status?: 'pending' | 'processing' | 'done' | 'failed' | 'skipped' | 'queued'
          created_at?: string
          hf_commit_sha?: string | null
          source_platform?: 'github' | 'hugging_face'
        }
        Update: {
          id?: string
          repo_id?: string
          github_id?: number | null
          tag_name?: string
          name?: string | null
          body?: string | null
          published_at?: string | null
          is_prerelease?: boolean
          is_draft?: boolean
          processed_at?: string | null
          processing_status?: 'pending' | 'processing' | 'done' | 'failed' | 'skipped' | 'queued'
          hf_commit_sha?: string | null
          source_platform?: 'github' | 'hugging_face'
        }
        Relationships: [
          {
            foreignKeyName: 'releases_repo_id_fkey'
            columns: ['repo_id']
            isOneToOne: false
            referencedRelation: 'repos'
            referencedColumns: ['id']
          }
        ]
      }
      articles: {
        Row: {
          id: string
          release_id: string
          repo_id: string
          title: string
          one_liner: string
          what_changed: string
          what_to_do: string
          citations: Json
          severity: number
          categories: string[]
          quality_score: number | null
          is_quarantined: boolean
          quarantine_reason: string | null
          published_at: string | null
          embedding: unknown | null
          model_version: string | null
          content_hash: string | null
          maintainer_edited: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          release_id: string
          repo_id: string
          title: string
          one_liner: string
          what_changed: string
          what_to_do: string
          citations?: Json
          severity: number
          categories?: string[]
          quality_score?: number | null
          is_quarantined?: boolean
          quarantine_reason?: string | null
          published_at?: string | null
          embedding?: unknown | null
          model_version?: string | null
          content_hash?: string | null
          maintainer_edited?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          title?: string
          one_liner?: string
          what_changed?: string
          what_to_do?: string
          citations?: Json
          severity?: number
          categories?: string[]
          quality_score?: number | null
          is_quarantined?: boolean
          quarantine_reason?: string | null
          published_at?: string | null
          model_version?: string | null
          content_hash?: string | null
          maintainer_edited?: boolean
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'articles_repo_id_fkey'
            columns: ['repo_id']
            isOneToOne: false
            referencedRelation: 'repos'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'articles_release_id_fkey'
            columns: ['release_id']
            isOneToOne: false
            referencedRelation: 'releases'
            referencedColumns: ['id']
          }
        ]
      }
      updates: {
        Row: {
          id: string
          release_id: string
          repo_id: string
          one_liner: string
          severity: number
          categories: string[]
          published_at: string | null
          created_at: string
        }
        Insert: {
          id?: string
          release_id: string
          repo_id: string
          one_liner: string
          severity: number
          categories?: string[]
          published_at?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          one_liner?: string
          severity?: number
          categories?: string[]
          published_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: 'updates_repo_id_fkey'
            columns: ['repo_id']
            isOneToOne: false
            referencedRelation: 'repos'
            referencedColumns: ['id']
          }
        ]
      }
      users: {
        Row: {
          id: string
          email: string
          github_username: string | null
          github_user_id: number | null
          plan: 'free' | 'subscriber' | 'maintainer'
          paddle_customer_id: string | null
          timezone: string
          digest_day: string
          digest_enabled: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          email: string
          github_username?: string | null
          github_user_id?: number | null
          plan?: 'free' | 'subscriber' | 'maintainer'
          paddle_customer_id?: string | null
          timezone?: string
          digest_day?: string
          digest_enabled?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          email?: string
          github_username?: string | null
          github_user_id?: number | null
          plan?: 'free' | 'subscriber' | 'maintainer'
          paddle_customer_id?: string | null
          timezone?: string
          digest_day?: string
          digest_enabled?: boolean
          updated_at?: string
        }
        Relationships: []
      }
      follows: {
        Row: {
          id: string
          user_id: string
          repo_id: string
          alert_threshold: number
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          repo_id: string
          alert_threshold?: number
          created_at?: string
        }
        Update: {
          alert_threshold?: number
        }
        Relationships: [
          {
            foreignKeyName: 'follows_user_id_fkey'
            columns: ['user_id']
            isOneToOne: false
            referencedRelation: 'users'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'follows_repo_id_fkey'
            columns: ['repo_id']
            isOneToOne: false
            referencedRelation: 'repos'
            referencedColumns: ['id']
          }
        ]
      }
      digests: {
        Row: {
          id: string
          user_id: string
          week_start: string
          article_ids: string[]
          update_ids: string[]
          sent_at: string | null
          open_count: number
          click_count: number
          resend_message_id: string | null
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          week_start: string
          article_ids?: string[]
          update_ids?: string[]
          sent_at?: string | null
          open_count?: number
          click_count?: number
          resend_message_id?: string | null
          created_at?: string
        }
        Update: {
          article_ids?: string[]
          update_ids?: string[]
          sent_at?: string | null
          open_count?: number
          click_count?: number
          resend_message_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: 'digests_user_id_fkey'
            columns: ['user_id']
            isOneToOne: false
            referencedRelation: 'users'
            referencedColumns: ['id']
          }
        ]
      }
      alerts: {
        Row: {
          id: string
          user_id: string
          article_id: string
          sent_at: string | null
          resend_message_id: string | null
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          article_id: string
          sent_at?: string | null
          resend_message_id?: string | null
          created_at?: string
        }
        Update: {
          sent_at?: string | null
          resend_message_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: 'alerts_user_id_fkey'
            columns: ['user_id']
            isOneToOne: false
            referencedRelation: 'users'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'alerts_article_id_fkey'
            columns: ['article_id']
            isOneToOne: false
            referencedRelation: 'articles'
            referencedColumns: ['id']
          }
        ]
      }
      maintainer_claims: {
        Row: {
          id: string
          user_id: string
          repo_id: string
          status: 'pending' | 'verified' | 'rejected' | 'expired'
          verified_at: string | null
          paddle_subscription_id: string | null
          branding: Json
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          repo_id: string
          status?: 'pending' | 'verified' | 'rejected' | 'expired'
          verified_at?: string | null
          paddle_subscription_id?: string | null
          branding?: Json
          created_at?: string
        }
        Update: {
          status?: 'pending' | 'verified' | 'rejected' | 'expired'
          verified_at?: string | null
          paddle_subscription_id?: string | null
          branding?: Json
        }
        Relationships: [
          {
            foreignKeyName: 'maintainer_claims_user_id_fkey'
            columns: ['user_id']
            isOneToOne: false
            referencedRelation: 'users'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'maintainer_claims_repo_id_fkey'
            columns: ['repo_id']
            isOneToOne: false
            referencedRelation: 'repos'
            referencedColumns: ['id']
          }
        ]
      }
      maintainer_edits: {
        Row: {
          id: string
          article_id: string | null
          update_id: string | null
          user_id: string
          field: string
          old_value: string | null
          new_value: string
          created_at: string
        }
        Insert: {
          id?: string
          article_id?: string | null
          update_id?: string | null
          user_id: string
          field: string
          old_value?: string | null
          new_value: string
          created_at?: string
        }
        Update: {
          new_value?: string
        }
        Relationships: [
          {
            foreignKeyName: 'maintainer_edits_user_id_fkey'
            columns: ['user_id']
            isOneToOne: false
            referencedRelation: 'users'
            referencedColumns: ['id']
          }
        ]
      }
      quality_events: {
        Row: {
          id: string
          article_id: string | null
          event_type: string
          source: string | null
          user_id: string | null
          details: Json
          resolved_at: string | null
          created_at: string
        }
        Insert: {
          id?: string
          article_id?: string | null
          event_type: string
          source?: string | null
          user_id?: string | null
          details?: Json
          resolved_at?: string | null
          created_at?: string
        }
        Update: {
          resolved_at?: string | null
          details?: Json
        }
        Relationships: []
      }
    }
    Views: Record<string, never>
    Functions: Record<string, never>
    Enums: Record<string, never>
    CompositeTypes: Record<string, never>
  }
}
