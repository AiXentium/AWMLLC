export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5";
  };
  public: {
    Tables: {
      ai_action_approvals: {
        Row: {
          action_type: string;
          conversation_id: string | null;
          created_at: string;
          decided_at: string | null;
          decided_by: string | null;
          id: string;
          message_id: string | null;
          payload: Json;
          preview: Json;
          project_id: string | null;
          requested_by: string;
          result: Json;
          status: string;
          summary: string;
          updated_at: string;
        };
        Insert: {
          action_type: string;
          conversation_id?: string | null;
          created_at?: string;
          decided_at?: string | null;
          decided_by?: string | null;
          id?: string;
          message_id?: string | null;
          payload?: Json;
          preview?: Json;
          project_id?: string | null;
          requested_by: string;
          result?: Json;
          status?: string;
          summary: string;
          updated_at?: string;
        };
        Update: {
          action_type?: string;
          conversation_id?: string | null;
          created_at?: string;
          decided_at?: string | null;
          decided_by?: string | null;
          id?: string;
          message_id?: string | null;
          payload?: Json;
          preview?: Json;
          project_id?: string | null;
          requested_by?: string;
          result?: Json;
          status?: string;
          summary?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "ai_action_approvals_conversation_id_fkey";
            columns: ["conversation_id"];
            isOneToOne: false;
            referencedRelation: "ai_conversations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "ai_action_approvals_message_id_fkey";
            columns: ["message_id"];
            isOneToOne: false;
            referencedRelation: "ai_messages";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "ai_action_approvals_project_id_fkey";
            columns: ["project_id"];
            isOneToOne: false;
            referencedRelation: "projects";
            referencedColumns: ["id"];
          },
        ];
      };
      ai_agent_routing: {
        Row: {
          agent_key: string;
          agent_label: string;
          created_at: string;
          id: string;
          message_id: string;
          reason: string | null;
          score: number | null;
        };
        Insert: {
          agent_key: string;
          agent_label: string;
          created_at?: string;
          id?: string;
          message_id: string;
          reason?: string | null;
          score?: number | null;
        };
        Update: {
          agent_key?: string;
          agent_label?: string;
          created_at?: string;
          id?: string;
          message_id?: string;
          reason?: string | null;
          score?: number | null;
        };
        Relationships: [
          {
            foreignKeyName: "ai_agent_routing_message_id_fkey";
            columns: ["message_id"];
            isOneToOne: false;
            referencedRelation: "ai_messages";
            referencedColumns: ["id"];
          },
        ];
      };
      ai_conversations: {
        Row: {
          archived: boolean;
          created_at: string;
          deleted_at: string | null;
          id: string;
          last_message_at: string;
          pinned: boolean;
          project_id: string | null;
          scope: string;
          title: string | null;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          archived?: boolean;
          created_at?: string;
          deleted_at?: string | null;
          id?: string;
          last_message_at?: string;
          pinned?: boolean;
          project_id?: string | null;
          scope?: string;
          title?: string | null;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          archived?: boolean;
          created_at?: string;
          deleted_at?: string | null;
          id?: string;
          last_message_at?: string;
          pinned?: boolean;
          project_id?: string | null;
          scope?: string;
          title?: string | null;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "ai_conversations_project_id_fkey";
            columns: ["project_id"];
            isOneToOne: false;
            referencedRelation: "projects";
            referencedColumns: ["id"];
          },
        ];
      };
      ai_detections: {
        Row: {
          approved_item_id: string | null;
          bbox: Json;
          category: string;
          confidence: number | null;
          conversation_id: string | null;
          created_at: string;
          created_by: string | null;
          height_in: number | null;
          id: string;
          label: string | null;
          page_id: string | null;
          product_type: string | null;
          project_id: string;
          quantity: number;
          raw: Json;
          reasoning: string | null;
          reviewed_at: string | null;
          reviewed_by: string | null;
          status: string;
          updated_at: string;
          width_in: number | null;
        };
        Insert: {
          approved_item_id?: string | null;
          bbox?: Json;
          category?: string;
          confidence?: number | null;
          conversation_id?: string | null;
          created_at?: string;
          created_by?: string | null;
          height_in?: number | null;
          id?: string;
          label?: string | null;
          page_id?: string | null;
          product_type?: string | null;
          project_id: string;
          quantity?: number;
          raw?: Json;
          reasoning?: string | null;
          reviewed_at?: string | null;
          reviewed_by?: string | null;
          status?: string;
          updated_at?: string;
          width_in?: number | null;
        };
        Update: {
          approved_item_id?: string | null;
          bbox?: Json;
          category?: string;
          confidence?: number | null;
          conversation_id?: string | null;
          created_at?: string;
          created_by?: string | null;
          height_in?: number | null;
          id?: string;
          label?: string | null;
          page_id?: string | null;
          product_type?: string | null;
          project_id?: string;
          quantity?: number;
          raw?: Json;
          reasoning?: string | null;
          reviewed_at?: string | null;
          reviewed_by?: string | null;
          status?: string;
          updated_at?: string;
          width_in?: number | null;
        };
        Relationships: [
          {
            foreignKeyName: "ai_detections_approved_item_id_fkey";
            columns: ["approved_item_id"];
            isOneToOne: false;
            referencedRelation: "takeoff_items";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "ai_detections_page_id_fkey";
            columns: ["page_id"];
            isOneToOne: false;
            referencedRelation: "pages";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "ai_detections_project_id_fkey";
            columns: ["project_id"];
            isOneToOne: false;
            referencedRelation: "projects";
            referencedColumns: ["id"];
          },
        ];
      };
      ai_feedback: {
        Row: {
          comment: string | null;
          created_at: string;
          id: string;
          message_id: string;
          rating: string;
          user_id: string;
        };
        Insert: {
          comment?: string | null;
          created_at?: string;
          id?: string;
          message_id: string;
          rating: string;
          user_id: string;
        };
        Update: {
          comment?: string | null;
          created_at?: string;
          id?: string;
          message_id?: string;
          rating?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "ai_feedback_message_id_fkey";
            columns: ["message_id"];
            isOneToOne: false;
            referencedRelation: "ai_messages";
            referencedColumns: ["id"];
          },
        ];
      };
      ai_generated_drafts: {
        Row: {
          body: string;
          conversation_id: string | null;
          created_at: string;
          created_by: string;
          deleted_at: string | null;
          draft_type: string;
          id: string;
          metadata: Json;
          project_id: string | null;
          status: string;
          title: string;
          updated_at: string;
        };
        Insert: {
          body: string;
          conversation_id?: string | null;
          created_at?: string;
          created_by: string;
          deleted_at?: string | null;
          draft_type: string;
          id?: string;
          metadata?: Json;
          project_id?: string | null;
          status?: string;
          title: string;
          updated_at?: string;
        };
        Update: {
          body?: string;
          conversation_id?: string | null;
          created_at?: string;
          created_by?: string;
          deleted_at?: string | null;
          draft_type?: string;
          id?: string;
          metadata?: Json;
          project_id?: string | null;
          status?: string;
          title?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "ai_generated_drafts_conversation_id_fkey";
            columns: ["conversation_id"];
            isOneToOne: false;
            referencedRelation: "ai_conversations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "ai_generated_drafts_project_id_fkey";
            columns: ["project_id"];
            isOneToOne: false;
            referencedRelation: "projects";
            referencedColumns: ["id"];
          },
        ];
      };
      ai_memory: {
        Row: {
          approved: boolean;
          approved_at: string | null;
          approved_by: string | null;
          content: string;
          created_at: string;
          disabled: boolean;
          id: string;
          project_id: string | null;
          scope: string;
          title: string | null;
          updated_at: string;
          user_id: string | null;
        };
        Insert: {
          approved?: boolean;
          approved_at?: string | null;
          approved_by?: string | null;
          content: string;
          created_at?: string;
          disabled?: boolean;
          id?: string;
          project_id?: string | null;
          scope?: string;
          title?: string | null;
          updated_at?: string;
          user_id?: string | null;
        };
        Update: {
          approved?: boolean;
          approved_at?: string | null;
          approved_by?: string | null;
          content?: string;
          created_at?: string;
          disabled?: boolean;
          id?: string;
          project_id?: string | null;
          scope?: string;
          title?: string | null;
          updated_at?: string;
          user_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "ai_memory_project_id_fkey";
            columns: ["project_id"];
            isOneToOne: false;
            referencedRelation: "projects";
            referencedColumns: ["id"];
          },
        ];
      };
      ai_message_sources: {
        Row: {
          created_at: string;
          detail: Json;
          entity_id: string | null;
          id: string;
          label: string;
          message_id: string;
          source_type: string;
        };
        Insert: {
          created_at?: string;
          detail?: Json;
          entity_id?: string | null;
          id?: string;
          label: string;
          message_id: string;
          source_type: string;
        };
        Update: {
          created_at?: string;
          detail?: Json;
          entity_id?: string | null;
          id?: string;
          label?: string;
          message_id?: string;
          source_type?: string;
        };
        Relationships: [
          {
            foreignKeyName: "ai_message_sources_message_id_fkey";
            columns: ["message_id"];
            isOneToOne: false;
            referencedRelation: "ai_messages";
            referencedColumns: ["id"];
          },
        ];
      };
      ai_messages: {
        Row: {
          agent_key: string | null;
          confidence: number | null;
          content: string;
          conversation_id: string;
          created_at: string;
          id: string;
          mode: string;
          role: string;
          sources: Json;
          tool_activity: Json;
        };
        Insert: {
          agent_key?: string | null;
          confidence?: number | null;
          content: string;
          conversation_id: string;
          created_at?: string;
          id?: string;
          mode?: string;
          role: string;
          sources?: Json;
          tool_activity?: Json;
        };
        Update: {
          agent_key?: string | null;
          confidence?: number | null;
          content?: string;
          conversation_id?: string;
          created_at?: string;
          id?: string;
          mode?: string;
          role?: string;
          sources?: Json;
          tool_activity?: Json;
        };
        Relationships: [
          {
            foreignKeyName: "ai_messages_conversation_id_fkey";
            columns: ["conversation_id"];
            isOneToOne: false;
            referencedRelation: "ai_conversations";
            referencedColumns: ["id"];
          },
        ];
      };
      ai_model_routes: {
        Row: {
          created_at: string;
          description: string | null;
          enabled: boolean;
          fallback_model: string | null;
          fallback_provider: string | null;
          id: string;
          label: string;
          max_output_tokens: number | null;
          model: string;
          provider: string;
          requires_vision: boolean;
          sort_order: number;
          task_category: string;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          description?: string | null;
          enabled?: boolean;
          fallback_model?: string | null;
          fallback_provider?: string | null;
          id?: string;
          label: string;
          max_output_tokens?: number | null;
          model: string;
          provider?: string;
          requires_vision?: boolean;
          sort_order?: number;
          task_category: string;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          description?: string | null;
          enabled?: boolean;
          fallback_model?: string | null;
          fallback_provider?: string | null;
          id?: string;
          label?: string;
          max_output_tokens?: number | null;
          model?: string;
          provider?: string;
          requires_vision?: boolean;
          sort_order?: number;
          task_category?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      ai_provider_configs: {
        Row: {
          allowed_roles: Database["public"]["Enums"]["app_role"][];
          created_at: string;
          display_name: string;
          enabled: boolean;
          id: string;
          key_configured: boolean;
          last_error: string | null;
          last_success_at: string | null;
          last_test_at: string | null;
          monthly_limit_usd: number | null;
          per_project_limit_usd: number | null;
          per_user_limit_usd: number | null;
          provider: string;
          secret_name: string;
          status: string;
          updated_at: string;
        };
        Insert: {
          allowed_roles?: Database["public"]["Enums"]["app_role"][];
          created_at?: string;
          display_name: string;
          enabled?: boolean;
          id?: string;
          key_configured?: boolean;
          last_error?: string | null;
          last_success_at?: string | null;
          last_test_at?: string | null;
          monthly_limit_usd?: number | null;
          per_project_limit_usd?: number | null;
          per_user_limit_usd?: number | null;
          provider: string;
          secret_name: string;
          status?: string;
          updated_at?: string;
        };
        Update: {
          allowed_roles?: Database["public"]["Enums"]["app_role"][];
          created_at?: string;
          display_name?: string;
          enabled?: boolean;
          id?: string;
          key_configured?: boolean;
          last_error?: string | null;
          last_success_at?: string | null;
          last_test_at?: string | null;
          monthly_limit_usd?: number | null;
          per_project_limit_usd?: number | null;
          per_user_limit_usd?: number | null;
          provider?: string;
          secret_name?: string;
          status?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      ai_runs: {
        Row: {
          agent_key: string | null;
          attempt: number;
          conversation_id: string | null;
          created_at: string;
          error_category: string | null;
          error_message: string | null;
          finished_at: string | null;
          id: string;
          idempotency_key: string | null;
          latency_ms: number | null;
          message_id: string | null;
          model: string | null;
          project_id: string | null;
          provider: string | null;
          started_at: string | null;
          status: string;
          task_category: string | null;
          updated_at: string;
          used_fallback: boolean;
          user_id: string;
        };
        Insert: {
          agent_key?: string | null;
          attempt?: number;
          conversation_id?: string | null;
          created_at?: string;
          error_category?: string | null;
          error_message?: string | null;
          finished_at?: string | null;
          id?: string;
          idempotency_key?: string | null;
          latency_ms?: number | null;
          message_id?: string | null;
          model?: string | null;
          project_id?: string | null;
          provider?: string | null;
          started_at?: string | null;
          status?: string;
          task_category?: string | null;
          updated_at?: string;
          used_fallback?: boolean;
          user_id: string;
        };
        Update: {
          agent_key?: string | null;
          attempt?: number;
          conversation_id?: string | null;
          created_at?: string;
          error_category?: string | null;
          error_message?: string | null;
          finished_at?: string | null;
          id?: string;
          idempotency_key?: string | null;
          latency_ms?: number | null;
          message_id?: string | null;
          model?: string | null;
          project_id?: string | null;
          provider?: string | null;
          started_at?: string | null;
          status?: string;
          task_category?: string | null;
          updated_at?: string;
          used_fallback?: boolean;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "ai_runs_conversation_id_fkey";
            columns: ["conversation_id"];
            isOneToOne: false;
            referencedRelation: "ai_conversations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "ai_runs_project_id_fkey";
            columns: ["project_id"];
            isOneToOne: false;
            referencedRelation: "projects";
            referencedColumns: ["id"];
          },
        ];
      };
      ai_tool_runs: {
        Row: {
          agent_key: string | null;
          conversation_id: string | null;
          created_at: string;
          duration_ms: number | null;
          error_message: string | null;
          id: string;
          input: Json;
          message_id: string | null;
          output: Json;
          project_id: string | null;
          requires_approval: boolean;
          status: string;
          tool_name: string;
          user_id: string;
        };
        Insert: {
          agent_key?: string | null;
          conversation_id?: string | null;
          created_at?: string;
          duration_ms?: number | null;
          error_message?: string | null;
          id?: string;
          input?: Json;
          message_id?: string | null;
          output?: Json;
          project_id?: string | null;
          requires_approval?: boolean;
          status?: string;
          tool_name: string;
          user_id: string;
        };
        Update: {
          agent_key?: string | null;
          conversation_id?: string | null;
          created_at?: string;
          duration_ms?: number | null;
          error_message?: string | null;
          id?: string;
          input?: Json;
          message_id?: string | null;
          output?: Json;
          project_id?: string | null;
          requires_approval?: boolean;
          status?: string;
          tool_name?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "ai_tool_runs_conversation_id_fkey";
            columns: ["conversation_id"];
            isOneToOne: false;
            referencedRelation: "ai_conversations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "ai_tool_runs_message_id_fkey";
            columns: ["message_id"];
            isOneToOne: false;
            referencedRelation: "ai_messages";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "ai_tool_runs_project_id_fkey";
            columns: ["project_id"];
            isOneToOne: false;
            referencedRelation: "projects";
            referencedColumns: ["id"];
          },
        ];
      };
      ai_usage: {
        Row: {
          created_at: string;
          estimated_cost_usd: number;
          id: string;
          input_tokens: number;
          latency_ms: number | null;
          model: string;
          output_tokens: number;
          project_id: string | null;
          provider: string;
          run_id: string | null;
          succeeded: boolean;
          task_category: string | null;
          used_fallback: boolean;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          estimated_cost_usd?: number;
          id?: string;
          input_tokens?: number;
          latency_ms?: number | null;
          model: string;
          output_tokens?: number;
          project_id?: string | null;
          provider: string;
          run_id?: string | null;
          succeeded?: boolean;
          task_category?: string | null;
          used_fallback?: boolean;
          user_id: string;
        };
        Update: {
          created_at?: string;
          estimated_cost_usd?: number;
          id?: string;
          input_tokens?: number;
          latency_ms?: number | null;
          model?: string;
          output_tokens?: number;
          project_id?: string | null;
          provider?: string;
          run_id?: string | null;
          succeeded?: boolean;
          task_category?: string | null;
          used_fallback?: boolean;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "ai_usage_project_id_fkey";
            columns: ["project_id"];
            isOneToOne: false;
            referencedRelation: "projects";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "ai_usage_run_id_fkey";
            columns: ["run_id"];
            isOneToOne: false;
            referencedRelation: "ai_runs";
            referencedColumns: ["id"];
          },
        ];
      };
      annotations: {
        Row: {
          created_at: string;
          created_by: string | null;
          deleted_at: string | null;
          geometry: Json;
          id: string;
          label: string | null;
          page_id: string;
          project_id: string;
          style: Json;
          takeoff_item_id: string | null;
          tool: string;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          created_by?: string | null;
          deleted_at?: string | null;
          geometry?: Json;
          id?: string;
          label?: string | null;
          page_id: string;
          project_id: string;
          style?: Json;
          takeoff_item_id?: string | null;
          tool: string;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          created_by?: string | null;
          deleted_at?: string | null;
          geometry?: Json;
          id?: string;
          label?: string | null;
          page_id?: string;
          project_id?: string;
          style?: Json;
          takeoff_item_id?: string | null;
          tool?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "annotations_page_id_fkey";
            columns: ["page_id"];
            isOneToOne: false;
            referencedRelation: "pages";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "annotations_project_id_fkey";
            columns: ["project_id"];
            isOneToOne: false;
            referencedRelation: "projects";
            referencedColumns: ["id"];
          },
        ];
      };
      app_user_connections: {
        Row: {
          account_email: string | null;
          account_name: string | null;
          connection_key_ciphertext: string;
          connector_id: string;
          created_at: string;
          id: string;
          scopes: string[];
          updated_at: string;
          user_id: string;
        };
        Insert: {
          account_email?: string | null;
          account_name?: string | null;
          connection_key_ciphertext: string;
          connector_id: string;
          created_at?: string;
          id?: string;
          scopes?: string[];
          updated_at?: string;
          user_id: string;
        };
        Update: {
          account_email?: string | null;
          account_name?: string | null;
          connection_key_ciphertext?: string;
          connector_id?: string;
          created_at?: string;
          id?: string;
          scopes?: string[];
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      audit_log: {
        Row: {
          action: string;
          created_at: string;
          detail: Json;
          entity_id: string | null;
          entity_type: string | null;
          id: string;
          project_id: string | null;
          user_id: string | null;
        };
        Insert: {
          action: string;
          created_at?: string;
          detail?: Json;
          entity_id?: string | null;
          entity_type?: string | null;
          id?: string;
          project_id?: string | null;
          user_id?: string | null;
        };
        Update: {
          action?: string;
          created_at?: string;
          detail?: Json;
          entity_id?: string | null;
          entity_type?: string | null;
          id?: string;
          project_id?: string | null;
          user_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "audit_log_project_id_fkey";
            columns: ["project_id"];
            isOneToOne: false;
            referencedRelation: "projects";
            referencedColumns: ["id"];
          },
        ];
      };
      cloud_exports: {
        Row: {
          action: string;
          created_at: string;
          created_by: string | null;
          export_id: string | null;
          file_type: string | null;
          filename: string;
          folder_name: string | null;
          folder_path: string | null;
          id: string;
          mime_type: string | null;
          project_id: string;
          provider: string;
          remote_id: string | null;
          remote_path: string | null;
          size_bytes: number | null;
          web_url: string | null;
        };
        Insert: {
          action?: string;
          created_at?: string;
          created_by?: string | null;
          export_id?: string | null;
          file_type?: string | null;
          filename: string;
          folder_name?: string | null;
          folder_path?: string | null;
          id?: string;
          mime_type?: string | null;
          project_id: string;
          provider: string;
          remote_id?: string | null;
          remote_path?: string | null;
          size_bytes?: number | null;
          web_url?: string | null;
        };
        Update: {
          action?: string;
          created_at?: string;
          created_by?: string | null;
          export_id?: string | null;
          file_type?: string | null;
          filename?: string;
          folder_name?: string | null;
          folder_path?: string | null;
          id?: string;
          mime_type?: string | null;
          project_id?: string;
          provider?: string;
          remote_id?: string | null;
          remote_path?: string | null;
          size_bytes?: number | null;
          web_url?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "cloud_exports_project_id_fkey";
            columns: ["project_id"];
            isOneToOne: false;
            referencedRelation: "projects";
            referencedColumns: ["id"];
          },
        ];
      };
      cloud_source_files: {
        Row: {
          checksum: string | null;
          created_at: string;
          document_id: string | null;
          id: string;
          imported_by: string | null;
          intake_file_id: string | null;
          last_checked_at: string | null;
          latest_modified_time: string | null;
          latest_rev: string | null;
          mime_type: string | null;
          project_id: string;
          provider: string;
          remote_content_hash: string | null;
          remote_id: string;
          remote_modified_time: string | null;
          remote_name: string;
          remote_path: string;
          remote_rev: string | null;
          revision_number: number;
          size_bytes: number | null;
          status: string;
          supersedes_source_file_id: string | null;
          sync_note: string | null;
          update_available: boolean;
          updated_at: string;
          web_url: string | null;
        };
        Insert: {
          checksum?: string | null;
          created_at?: string;
          document_id?: string | null;
          id?: string;
          imported_by?: string | null;
          intake_file_id?: string | null;
          last_checked_at?: string | null;
          latest_modified_time?: string | null;
          latest_rev?: string | null;
          mime_type?: string | null;
          project_id: string;
          provider: string;
          remote_content_hash?: string | null;
          remote_id: string;
          remote_modified_time?: string | null;
          remote_name: string;
          remote_path: string;
          remote_rev?: string | null;
          revision_number?: number;
          size_bytes?: number | null;
          status?: string;
          supersedes_source_file_id?: string | null;
          sync_note?: string | null;
          update_available?: boolean;
          updated_at?: string;
          web_url?: string | null;
        };
        Update: {
          checksum?: string | null;
          created_at?: string;
          document_id?: string | null;
          id?: string;
          imported_by?: string | null;
          intake_file_id?: string | null;
          last_checked_at?: string | null;
          latest_modified_time?: string | null;
          latest_rev?: string | null;
          mime_type?: string | null;
          project_id?: string;
          provider?: string;
          remote_content_hash?: string | null;
          remote_id?: string;
          remote_modified_time?: string | null;
          remote_name?: string;
          remote_path?: string;
          remote_rev?: string | null;
          revision_number?: number;
          size_bytes?: number | null;
          status?: string;
          supersedes_source_file_id?: string | null;
          sync_note?: string | null;
          update_available?: boolean;
          updated_at?: string;
          web_url?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "cloud_source_files_document_id_fkey";
            columns: ["document_id"];
            isOneToOne: false;
            referencedRelation: "documents";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "cloud_source_files_project_id_fkey";
            columns: ["project_id"];
            isOneToOne: false;
            referencedRelation: "projects";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "cloud_source_files_supersedes_source_file_id_fkey";
            columns: ["supersedes_source_file_id"];
            isOneToOne: false;
            referencedRelation: "cloud_source_files";
            referencedColumns: ["id"];
          },
        ];
      };
      combination_members: {
        Row: {
          combination_id: string;
          id: string;
          position: number;
          quantity: number;
          takeoff_item_id: string | null;
        };
        Insert: {
          combination_id: string;
          id?: string;
          position?: number;
          quantity?: number;
          takeoff_item_id?: string | null;
        };
        Update: {
          combination_id?: string;
          id?: string;
          position?: number;
          quantity?: number;
          takeoff_item_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "combination_members_combination_id_fkey";
            columns: ["combination_id"];
            isOneToOne: false;
            referencedRelation: "combinations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "combination_members_takeoff_item_id_fkey";
            columns: ["takeoff_item_id"];
            isOneToOne: false;
            referencedRelation: "takeoff_items";
            referencedColumns: ["id"];
          },
        ];
      };
      combinations: {
        Row: {
          created_at: string;
          id: string;
          layout: string;
          mark: string | null;
          mull_type: string | null;
          notes: string | null;
          project_id: string;
          reinforcement: string | null;
          status: Database["public"]["Enums"]["review_status"];
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          layout?: string;
          mark?: string | null;
          mull_type?: string | null;
          notes?: string | null;
          project_id: string;
          reinforcement?: string | null;
          status?: Database["public"]["Enums"]["review_status"];
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          layout?: string;
          mark?: string | null;
          mull_type?: string | null;
          notes?: string | null;
          project_id?: string;
          reinforcement?: string | null;
          status?: Database["public"]["Enums"]["review_status"];
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "combinations_project_id_fkey";
            columns: ["project_id"];
            isOneToOne: false;
            referencedRelation: "projects";
            referencedColumns: ["id"];
          },
        ];
      };
      company_settings: {
        Row: {
          address: string | null;
          company_name: string;
          created_at: string;
          default_report_notes: string | null;
          email: string | null;
          estimator_name: string | null;
          id: string;
          legal_name: string;
          license_number: string | null;
          logo_path: string | null;
          phone: string | null;
          updated_at: string;
          user_id: string;
          website: string | null;
        };
        Insert: {
          address?: string | null;
          company_name?: string;
          created_at?: string;
          default_report_notes?: string | null;
          email?: string | null;
          estimator_name?: string | null;
          id?: string;
          legal_name?: string;
          license_number?: string | null;
          logo_path?: string | null;
          phone?: string | null;
          updated_at?: string;
          user_id: string;
          website?: string | null;
        };
        Update: {
          address?: string | null;
          company_name?: string;
          created_at?: string;
          default_report_notes?: string | null;
          email?: string | null;
          estimator_name?: string | null;
          id?: string;
          legal_name?: string;
          license_number?: string | null;
          logo_path?: string | null;
          phone?: string | null;
          updated_at?: string;
          user_id?: string;
          website?: string | null;
        };
        Relationships: [];
      };
      contact_submissions: {
        Row: {
          assigned_to: string | null;
          budget_range: string | null;
          city: string | null;
          company: string | null;
          consent: boolean;
          converted_project_id: string | null;
          county: string | null;
          created_at: string;
          deadline: string | null;
          email: string;
          first_name: string | null;
          id: string;
          internal_notes: string | null;
          last_activity_at: string;
          last_name: string | null;
          message: string | null;
          name: string;
          phone: string | null;
          plan_link: string | null;
          preferred_contact: string | null;
          priority: string;
          product_interest: string | null;
          project_address: string | null;
          project_name: string | null;
          project_type: string | null;
          public_token: string;
          quantities: string | null;
          source: string;
          state: string | null;
          status: string;
          updated_at: string;
          zip_code: string | null;
        };
        Insert: {
          assigned_to?: string | null;
          budget_range?: string | null;
          city?: string | null;
          company?: string | null;
          consent?: boolean;
          converted_project_id?: string | null;
          county?: string | null;
          created_at?: string;
          deadline?: string | null;
          email: string;
          first_name?: string | null;
          id?: string;
          internal_notes?: string | null;
          last_activity_at?: string;
          last_name?: string | null;
          message?: string | null;
          name: string;
          phone?: string | null;
          plan_link?: string | null;
          preferred_contact?: string | null;
          priority?: string;
          product_interest?: string | null;
          project_address?: string | null;
          project_name?: string | null;
          project_type?: string | null;
          public_token?: string;
          quantities?: string | null;
          source?: string;
          state?: string | null;
          status?: string;
          updated_at?: string;
          zip_code?: string | null;
        };
        Update: {
          assigned_to?: string | null;
          budget_range?: string | null;
          city?: string | null;
          company?: string | null;
          consent?: boolean;
          converted_project_id?: string | null;
          county?: string | null;
          created_at?: string;
          deadline?: string | null;
          email?: string;
          first_name?: string | null;
          id?: string;
          internal_notes?: string | null;
          last_activity_at?: string;
          last_name?: string | null;
          message?: string | null;
          name?: string;
          phone?: string | null;
          plan_link?: string | null;
          preferred_contact?: string | null;
          priority?: string;
          product_interest?: string | null;
          project_address?: string | null;
          project_name?: string | null;
          project_type?: string | null;
          public_token?: string;
          quantities?: string | null;
          source?: string;
          state?: string | null;
          status?: string;
          updated_at?: string;
          zip_code?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "contact_submissions_converted_project_id_fkey";
            columns: ["converted_project_id"];
            isOneToOne: false;
            referencedRelation: "projects";
            referencedColumns: ["id"];
          },
        ];
      };
      customers: {
        Row: {
          address: string | null;
          company: string | null;
          created_at: string;
          created_by: string | null;
          email: string | null;
          id: string;
          name: string;
          notes: string | null;
          phone: string | null;
          updated_at: string;
        };
        Insert: {
          address?: string | null;
          company?: string | null;
          created_at?: string;
          created_by?: string | null;
          email?: string | null;
          id?: string;
          name: string;
          notes?: string | null;
          phone?: string | null;
          updated_at?: string;
        };
        Update: {
          address?: string | null;
          company?: string | null;
          created_at?: string;
          created_by?: string | null;
          email?: string | null;
          id?: string;
          name?: string;
          notes?: string | null;
          phone?: string | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      document_versions: {
        Row: {
          created_at: string;
          created_by: string | null;
          document_id: string;
          id: string;
          label: string | null;
          notes: string | null;
          storage_path: string | null;
          version_number: number;
        };
        Insert: {
          created_at?: string;
          created_by?: string | null;
          document_id: string;
          id?: string;
          label?: string | null;
          notes?: string | null;
          storage_path?: string | null;
          version_number?: number;
        };
        Update: {
          created_at?: string;
          created_by?: string | null;
          document_id?: string;
          id?: string;
          label?: string | null;
          notes?: string | null;
          storage_path?: string | null;
          version_number?: number;
        };
        Relationships: [
          {
            foreignKeyName: "document_versions_document_id_fkey";
            columns: ["document_id"];
            isOneToOne: false;
            referencedRelation: "documents";
            referencedColumns: ["id"];
          },
        ];
      };
      documents: {
        Row: {
          building: string | null;
          category: string | null;
          checksum: string | null;
          created_at: string;
          created_by: string | null;
          deleted_at: string | null;
          deleted_by: string | null;
          deletion_reason: string | null;
          error_message: string | null;
          id: string;
          intake_file_id: string | null;
          kind: string;
          lock_reason: string | null;
          locked_at: string | null;
          locked_by: string | null;
          mime_type: string | null;
          name: string;
          original_filename: string | null;
          original_parent_id: string | null;
          page_count: number | null;
          pages_failed: number;
          pages_processed: number;
          project_id: string;
          restore_status: string;
          revision: string | null;
          size_bytes: number | null;
          source_archive: string | null;
          source_folder: string | null;
          status: string;
          storage_path: string | null;
          supersedes_document_id: string | null;
          updated_at: string;
        };
        Insert: {
          building?: string | null;
          category?: string | null;
          checksum?: string | null;
          created_at?: string;
          created_by?: string | null;
          deleted_at?: string | null;
          deleted_by?: string | null;
          deletion_reason?: string | null;
          error_message?: string | null;
          id?: string;
          intake_file_id?: string | null;
          kind?: string;
          lock_reason?: string | null;
          locked_at?: string | null;
          locked_by?: string | null;
          mime_type?: string | null;
          name: string;
          original_filename?: string | null;
          original_parent_id?: string | null;
          page_count?: number | null;
          pages_failed?: number;
          pages_processed?: number;
          project_id: string;
          restore_status?: string;
          revision?: string | null;
          size_bytes?: number | null;
          source_archive?: string | null;
          source_folder?: string | null;
          status?: string;
          storage_path?: string | null;
          supersedes_document_id?: string | null;
          updated_at?: string;
        };
        Update: {
          building?: string | null;
          category?: string | null;
          checksum?: string | null;
          created_at?: string;
          created_by?: string | null;
          deleted_at?: string | null;
          deleted_by?: string | null;
          deletion_reason?: string | null;
          error_message?: string | null;
          id?: string;
          intake_file_id?: string | null;
          kind?: string;
          lock_reason?: string | null;
          locked_at?: string | null;
          locked_by?: string | null;
          mime_type?: string | null;
          name?: string;
          original_filename?: string | null;
          original_parent_id?: string | null;
          page_count?: number | null;
          pages_failed?: number;
          pages_processed?: number;
          project_id?: string;
          restore_status?: string;
          revision?: string | null;
          size_bytes?: number | null;
          source_archive?: string | null;
          source_folder?: string | null;
          status?: string;
          storage_path?: string | null;
          supersedes_document_id?: string | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "documents_intake_file_id_fkey";
            columns: ["intake_file_id"];
            isOneToOne: false;
            referencedRelation: "intake_files";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "documents_project_id_fkey";
            columns: ["project_id"];
            isOneToOne: false;
            referencedRelation: "projects";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "documents_supersedes_document_id_fkey";
            columns: ["supersedes_document_id"];
            isOneToOne: false;
            referencedRelation: "documents";
            referencedColumns: ["id"];
          },
        ];
      };
      drive_exports: {
        Row: {
          action: string;
          created_at: string;
          created_by: string | null;
          drive_file_id: string;
          drive_folder_id: string | null;
          drive_folder_name: string | null;
          drive_web_view_link: string | null;
          export_id: string | null;
          file_type: string | null;
          filename: string;
          id: string;
          mime_type: string | null;
          project_id: string;
          size_bytes: number | null;
        };
        Insert: {
          action?: string;
          created_at?: string;
          created_by?: string | null;
          drive_file_id: string;
          drive_folder_id?: string | null;
          drive_folder_name?: string | null;
          drive_web_view_link?: string | null;
          export_id?: string | null;
          file_type?: string | null;
          filename: string;
          id?: string;
          mime_type?: string | null;
          project_id: string;
          size_bytes?: number | null;
        };
        Update: {
          action?: string;
          created_at?: string;
          created_by?: string | null;
          drive_file_id?: string;
          drive_folder_id?: string | null;
          drive_folder_name?: string | null;
          drive_web_view_link?: string | null;
          export_id?: string | null;
          file_type?: string | null;
          filename?: string;
          id?: string;
          mime_type?: string | null;
          project_id?: string;
          size_bytes?: number | null;
        };
        Relationships: [
          {
            foreignKeyName: "drive_exports_export_id_fkey";
            columns: ["export_id"];
            isOneToOne: false;
            referencedRelation: "exports";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "drive_exports_project_id_fkey";
            columns: ["project_id"];
            isOneToOne: false;
            referencedRelation: "projects";
            referencedColumns: ["id"];
          },
        ];
      };
      drive_source_files: {
        Row: {
          checksum: string | null;
          created_at: string;
          document_id: string | null;
          drive_file_id: string;
          drive_folder_id: string | null;
          drive_folder_name: string | null;
          drive_md5: string | null;
          drive_mime_type: string | null;
          drive_modified_time: string | null;
          drive_name: string;
          drive_web_view_link: string | null;
          id: string;
          imported_by: string | null;
          intake_file_id: string | null;
          last_checked_at: string | null;
          latest_modified_time: string | null;
          project_id: string;
          size_bytes: number | null;
          status: string;
          update_available: boolean;
          updated_at: string;
        };
        Insert: {
          checksum?: string | null;
          created_at?: string;
          document_id?: string | null;
          drive_file_id: string;
          drive_folder_id?: string | null;
          drive_folder_name?: string | null;
          drive_md5?: string | null;
          drive_mime_type?: string | null;
          drive_modified_time?: string | null;
          drive_name: string;
          drive_web_view_link?: string | null;
          id?: string;
          imported_by?: string | null;
          intake_file_id?: string | null;
          last_checked_at?: string | null;
          latest_modified_time?: string | null;
          project_id: string;
          size_bytes?: number | null;
          status?: string;
          update_available?: boolean;
          updated_at?: string;
        };
        Update: {
          checksum?: string | null;
          created_at?: string;
          document_id?: string | null;
          drive_file_id?: string;
          drive_folder_id?: string | null;
          drive_folder_name?: string | null;
          drive_md5?: string | null;
          drive_mime_type?: string | null;
          drive_modified_time?: string | null;
          drive_name?: string;
          drive_web_view_link?: string | null;
          id?: string;
          imported_by?: string | null;
          intake_file_id?: string | null;
          last_checked_at?: string | null;
          latest_modified_time?: string | null;
          project_id?: string;
          size_bytes?: number | null;
          status?: string;
          update_available?: boolean;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "drive_source_files_document_id_fkey";
            columns: ["document_id"];
            isOneToOne: false;
            referencedRelation: "documents";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "drive_source_files_intake_file_id_fkey";
            columns: ["intake_file_id"];
            isOneToOne: false;
            referencedRelation: "intake_files";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "drive_source_files_project_id_fkey";
            columns: ["project_id"];
            isOneToOne: false;
            referencedRelation: "projects";
            referencedColumns: ["id"];
          },
        ];
      };
      exports: {
        Row: {
          created_at: string;
          created_by: string | null;
          deleted_at: string | null;
          deleted_by: string | null;
          deletion_reason: string | null;
          error_message: string | null;
          export_type: string;
          filename: string | null;
          id: string;
          original_parent_id: string | null;
          project_id: string;
          restore_status: string;
          size_bytes: number | null;
          status: string;
          storage_path: string | null;
        };
        Insert: {
          created_at?: string;
          created_by?: string | null;
          deleted_at?: string | null;
          deleted_by?: string | null;
          deletion_reason?: string | null;
          error_message?: string | null;
          export_type: string;
          filename?: string | null;
          id?: string;
          original_parent_id?: string | null;
          project_id: string;
          restore_status?: string;
          size_bytes?: number | null;
          status?: string;
          storage_path?: string | null;
        };
        Update: {
          created_at?: string;
          created_by?: string | null;
          deleted_at?: string | null;
          deleted_by?: string | null;
          deletion_reason?: string | null;
          error_message?: string | null;
          export_type?: string;
          filename?: string | null;
          id?: string;
          original_parent_id?: string | null;
          project_id?: string;
          restore_status?: string;
          size_bytes?: number | null;
          status?: string;
          storage_path?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "exports_project_id_fkey";
            columns: ["project_id"];
            isOneToOne: false;
            referencedRelation: "projects";
            referencedColumns: ["id"];
          },
        ];
      };
      file_connectors: {
        Row: {
          config: Json;
          created_at: string;
          display_name: string;
          id: string;
          provider: string;
          status: string;
          updated_at: string;
        };
        Insert: {
          config?: Json;
          created_at?: string;
          display_name: string;
          id?: string;
          provider: string;
          status?: string;
          updated_at?: string;
        };
        Update: {
          config?: Json;
          created_at?: string;
          display_name?: string;
          id?: string;
          provider?: string;
          status?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      incoming_files: {
        Row: {
          archived: boolean;
          assigned_to: string | null;
          checksum: string | null;
          created_at: string;
          deleted_at: string | null;
          deleted_by: string | null;
          deletion_reason: string | null;
          id: string;
          is_duplicate: boolean;
          mime_type: string | null;
          original_filename: string | null;
          original_parent_id: string | null;
          project_id: string | null;
          restore_status: string;
          scan_detail: string | null;
          scan_status: Database["public"]["Enums"]["file_scan_status"];
          size_bytes: number | null;
          source: string;
          storage_path: string | null;
          stored_filename: string | null;
          submission_id: string | null;
          updated_at: string;
        };
        Insert: {
          archived?: boolean;
          assigned_to?: string | null;
          checksum?: string | null;
          created_at?: string;
          deleted_at?: string | null;
          deleted_by?: string | null;
          deletion_reason?: string | null;
          id?: string;
          is_duplicate?: boolean;
          mime_type?: string | null;
          original_filename?: string | null;
          original_parent_id?: string | null;
          project_id?: string | null;
          restore_status?: string;
          scan_detail?: string | null;
          scan_status?: Database["public"]["Enums"]["file_scan_status"];
          size_bytes?: number | null;
          source?: string;
          storage_path?: string | null;
          stored_filename?: string | null;
          submission_id?: string | null;
          updated_at?: string;
        };
        Update: {
          archived?: boolean;
          assigned_to?: string | null;
          checksum?: string | null;
          created_at?: string;
          deleted_at?: string | null;
          deleted_by?: string | null;
          deletion_reason?: string | null;
          id?: string;
          is_duplicate?: boolean;
          mime_type?: string | null;
          original_filename?: string | null;
          original_parent_id?: string | null;
          project_id?: string | null;
          restore_status?: string;
          scan_detail?: string | null;
          scan_status?: Database["public"]["Enums"]["file_scan_status"];
          size_bytes?: number | null;
          source?: string;
          storage_path?: string | null;
          stored_filename?: string | null;
          submission_id?: string | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "incoming_files_project_id_fkey";
            columns: ["project_id"];
            isOneToOne: false;
            referencedRelation: "projects";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "incoming_files_submission_id_fkey";
            columns: ["submission_id"];
            isOneToOne: false;
            referencedRelation: "contact_submissions";
            referencedColumns: ["id"];
          },
        ];
      };
      intake_files: {
        Row: {
          archived_at: string | null;
          checksum: string | null;
          created_at: string;
          deleted_at: string | null;
          deleted_by: string | null;
          deletion_reason: string | null;
          document_id: string | null;
          duplicate_of: string | null;
          error_message: string | null;
          id: string;
          job_id: string;
          mime_type: string | null;
          original_filename: string;
          original_parent_id: string | null;
          parent_file_id: string | null;
          project_id: string;
          reason: string | null;
          restore_status: string;
          size_bytes: number | null;
          source_archive: string | null;
          source_folder: string | null;
          source_kind: string;
          status: string;
          storage_path: string | null;
          updated_at: string;
        };
        Insert: {
          archived_at?: string | null;
          checksum?: string | null;
          created_at?: string;
          deleted_at?: string | null;
          deleted_by?: string | null;
          deletion_reason?: string | null;
          document_id?: string | null;
          duplicate_of?: string | null;
          error_message?: string | null;
          id?: string;
          job_id: string;
          mime_type?: string | null;
          original_filename: string;
          original_parent_id?: string | null;
          parent_file_id?: string | null;
          project_id: string;
          reason?: string | null;
          restore_status?: string;
          size_bytes?: number | null;
          source_archive?: string | null;
          source_folder?: string | null;
          source_kind?: string;
          status?: string;
          storage_path?: string | null;
          updated_at?: string;
        };
        Update: {
          archived_at?: string | null;
          checksum?: string | null;
          created_at?: string;
          deleted_at?: string | null;
          deleted_by?: string | null;
          deletion_reason?: string | null;
          document_id?: string | null;
          duplicate_of?: string | null;
          error_message?: string | null;
          id?: string;
          job_id?: string;
          mime_type?: string | null;
          original_filename?: string;
          original_parent_id?: string | null;
          parent_file_id?: string | null;
          project_id?: string;
          reason?: string | null;
          restore_status?: string;
          size_bytes?: number | null;
          source_archive?: string | null;
          source_folder?: string | null;
          source_kind?: string;
          status?: string;
          storage_path?: string | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "intake_files_document_id_fkey";
            columns: ["document_id"];
            isOneToOne: false;
            referencedRelation: "documents";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "intake_files_duplicate_of_fkey";
            columns: ["duplicate_of"];
            isOneToOne: false;
            referencedRelation: "documents";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "intake_files_job_id_fkey";
            columns: ["job_id"];
            isOneToOne: false;
            referencedRelation: "intake_jobs";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "intake_files_parent_file_id_fkey";
            columns: ["parent_file_id"];
            isOneToOne: false;
            referencedRelation: "intake_files";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "intake_files_project_id_fkey";
            columns: ["project_id"];
            isOneToOne: false;
            referencedRelation: "projects";
            referencedColumns: ["id"];
          },
        ];
      };
      intake_jobs: {
        Row: {
          accepted_count: number;
          created_at: string;
          created_by: string | null;
          duplicate_count: number;
          failed_count: number;
          id: string;
          ignored_count: number;
          label: string | null;
          project_id: string;
          status: string;
          total_files: number;
          updated_at: string;
        };
        Insert: {
          accepted_count?: number;
          created_at?: string;
          created_by?: string | null;
          duplicate_count?: number;
          failed_count?: number;
          id?: string;
          ignored_count?: number;
          label?: string | null;
          project_id: string;
          status?: string;
          total_files?: number;
          updated_at?: string;
        };
        Update: {
          accepted_count?: number;
          created_at?: string;
          created_by?: string | null;
          duplicate_count?: number;
          failed_count?: number;
          id?: string;
          ignored_count?: number;
          label?: string | null;
          project_id?: string;
          status?: string;
          total_files?: number;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "intake_jobs_project_id_fkey";
            columns: ["project_id"];
            isOneToOne: false;
            referencedRelation: "projects";
            referencedColumns: ["id"];
          },
        ];
      };
      intake_settings: {
        Row: {
          created_at: string;
          id: boolean;
          max_archive_entries: number;
          max_compression_ratio: number;
          max_pdf_bytes: number;
          max_uncompressed_bytes: number;
          max_zip_bytes: number;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          id?: boolean;
          max_archive_entries?: number;
          max_compression_ratio?: number;
          max_pdf_bytes?: number;
          max_uncompressed_bytes?: number;
          max_zip_bytes?: number;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          id?: boolean;
          max_archive_entries?: number;
          max_compression_ratio?: number;
          max_pdf_bytes?: number;
          max_uncompressed_bytes?: number;
          max_zip_bytes?: number;
          updated_at?: string;
        };
        Relationships: [];
      };
      jurisdiction_records: {
        Row: {
          adopted_code: string | null;
          ahj_name: string | null;
          amendments: string | null;
          created_at: string;
          debris_region: string | null;
          design_wind_speed: string | null;
          egress_requirements: string | null;
          energy_requirements: string | null;
          id: string;
          impact_required: boolean | null;
          permit_notes: string | null;
          project_id: string;
          safety_glazing_notes: string | null;
          source_url: string | null;
          updated_at: string;
          upper_floor_restrictions: string | null;
          verified_at: string | null;
          verified_by: string | null;
        };
        Insert: {
          adopted_code?: string | null;
          ahj_name?: string | null;
          amendments?: string | null;
          created_at?: string;
          debris_region?: string | null;
          design_wind_speed?: string | null;
          egress_requirements?: string | null;
          energy_requirements?: string | null;
          id?: string;
          impact_required?: boolean | null;
          permit_notes?: string | null;
          project_id: string;
          safety_glazing_notes?: string | null;
          source_url?: string | null;
          updated_at?: string;
          upper_floor_restrictions?: string | null;
          verified_at?: string | null;
          verified_by?: string | null;
        };
        Update: {
          adopted_code?: string | null;
          ahj_name?: string | null;
          amendments?: string | null;
          created_at?: string;
          debris_region?: string | null;
          design_wind_speed?: string | null;
          egress_requirements?: string | null;
          energy_requirements?: string | null;
          id?: string;
          impact_required?: boolean | null;
          permit_notes?: string | null;
          project_id?: string;
          safety_glazing_notes?: string | null;
          source_url?: string | null;
          updated_at?: string;
          upper_floor_restrictions?: string | null;
          verified_at?: string | null;
          verified_by?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "jurisdiction_records_project_id_fkey";
            columns: ["project_id"];
            isOneToOne: false;
            referencedRelation: "projects";
            referencedColumns: ["id"];
          },
        ];
      };
      page_scales: {
        Row: {
          calibrated_by: string | null;
          created_at: string;
          id: string;
          page_id: string;
          pixels_per_unit: number | null;
          project_id: string;
          scale_label: string | null;
          units: string;
          updated_at: string;
        };
        Insert: {
          calibrated_by?: string | null;
          created_at?: string;
          id?: string;
          page_id: string;
          pixels_per_unit?: number | null;
          project_id: string;
          scale_label?: string | null;
          units?: string;
          updated_at?: string;
        };
        Update: {
          calibrated_by?: string | null;
          created_at?: string;
          id?: string;
          page_id?: string;
          pixels_per_unit?: number | null;
          project_id?: string;
          scale_label?: string | null;
          units?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "page_scales_page_id_fkey";
            columns: ["page_id"];
            isOneToOne: true;
            referencedRelation: "pages";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "page_scales_project_id_fkey";
            columns: ["project_id"];
            isOneToOne: false;
            referencedRelation: "projects";
            referencedColumns: ["id"];
          },
        ];
      };
      pages: {
        Row: {
          building: string | null;
          classification: string | null;
          created_at: string;
          deleted_at: string | null;
          deleted_by: string | null;
          deletion_reason: string | null;
          discipline: string | null;
          document_id: string;
          excluded_at: string | null;
          excluded_by: string | null;
          exclusion_reason: string | null;
          floor: string | null;
          height: number | null;
          id: string;
          original_parent_id: string | null;
          page_number: number;
          processing_error: string | null;
          project_id: string;
          restore_status: string;
          revision: string | null;
          rotation: number | null;
          sheet_number: string | null;
          state: string;
          tags: string[] | null;
          thumbnail_path: string | null;
          title: string | null;
          updated_at: string;
          width: number | null;
        };
        Insert: {
          building?: string | null;
          classification?: string | null;
          created_at?: string;
          deleted_at?: string | null;
          deleted_by?: string | null;
          deletion_reason?: string | null;
          discipline?: string | null;
          document_id: string;
          excluded_at?: string | null;
          excluded_by?: string | null;
          exclusion_reason?: string | null;
          floor?: string | null;
          height?: number | null;
          id?: string;
          original_parent_id?: string | null;
          page_number: number;
          processing_error?: string | null;
          project_id: string;
          restore_status?: string;
          revision?: string | null;
          rotation?: number | null;
          sheet_number?: string | null;
          state?: string;
          tags?: string[] | null;
          thumbnail_path?: string | null;
          title?: string | null;
          updated_at?: string;
          width?: number | null;
        };
        Update: {
          building?: string | null;
          classification?: string | null;
          created_at?: string;
          deleted_at?: string | null;
          deleted_by?: string | null;
          deletion_reason?: string | null;
          discipline?: string | null;
          document_id?: string;
          excluded_at?: string | null;
          excluded_by?: string | null;
          exclusion_reason?: string | null;
          floor?: string | null;
          height?: number | null;
          id?: string;
          original_parent_id?: string | null;
          page_number?: number;
          processing_error?: string | null;
          project_id?: string;
          restore_status?: string;
          revision?: string | null;
          rotation?: number | null;
          sheet_number?: string | null;
          state?: string;
          tags?: string[] | null;
          thumbnail_path?: string | null;
          title?: string | null;
          updated_at?: string;
          width?: number | null;
        };
        Relationships: [
          {
            foreignKeyName: "pages_document_id_fkey";
            columns: ["document_id"];
            isOneToOne: false;
            referencedRelation: "documents";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "pages_project_id_fkey";
            columns: ["project_id"];
            isOneToOne: false;
            referencedRelation: "projects";
            referencedColumns: ["id"];
          },
        ];
      };
      plan_analysis_issues: {
        Row: {
          created_at: string;
          id: string;
          kind: string;
          message: string;
          page_id: string | null;
          page_number: number | null;
          project_id: string;
          run_id: string | null;
          severity: string;
          source_sheet: string | null;
        };
        Insert: {
          created_at?: string;
          id?: string;
          kind?: string;
          message: string;
          page_id?: string | null;
          page_number?: number | null;
          project_id: string;
          run_id?: string | null;
          severity?: string;
          source_sheet?: string | null;
        };
        Update: {
          created_at?: string;
          id?: string;
          kind?: string;
          message?: string;
          page_id?: string | null;
          page_number?: number | null;
          project_id?: string;
          run_id?: string | null;
          severity?: string;
          source_sheet?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "plan_analysis_issues_page_id_fkey";
            columns: ["page_id"];
            isOneToOne: false;
            referencedRelation: "pages";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "plan_analysis_issues_project_id_fkey";
            columns: ["project_id"];
            isOneToOne: false;
            referencedRelation: "projects";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "plan_analysis_issues_run_id_fkey";
            columns: ["run_id"];
            isOneToOne: false;
            referencedRelation: "plan_analysis_runs";
            referencedColumns: ["id"];
          },
        ];
      };
      plan_analysis_runs: {
        Row: {
          approved_at: string | null;
          approved_by: string | null;
          confidence: number | null;
          created_at: string;
          created_by: string | null;
          document_id: string | null;
          door_count: number;
          error_message: string | null;
          id: string;
          model: string | null;
          project_id: string;
          provider: string | null;
          schedules_found: number;
          sheets_analyzed: number;
          sheets_selected: number;
          sheets_total: number;
          stage_message: string | null;
          status: string;
          updated_at: string;
          used_vision: boolean;
          window_count: number;
          working_set_id: string | null;
        };
        Insert: {
          approved_at?: string | null;
          approved_by?: string | null;
          confidence?: number | null;
          created_at?: string;
          created_by?: string | null;
          document_id?: string | null;
          door_count?: number;
          error_message?: string | null;
          id?: string;
          model?: string | null;
          project_id: string;
          provider?: string | null;
          schedules_found?: number;
          sheets_analyzed?: number;
          sheets_selected?: number;
          sheets_total?: number;
          stage_message?: string | null;
          status?: string;
          updated_at?: string;
          used_vision?: boolean;
          window_count?: number;
          working_set_id?: string | null;
        };
        Update: {
          approved_at?: string | null;
          approved_by?: string | null;
          confidence?: number | null;
          created_at?: string;
          created_by?: string | null;
          document_id?: string | null;
          door_count?: number;
          error_message?: string | null;
          id?: string;
          model?: string | null;
          project_id?: string;
          provider?: string | null;
          schedules_found?: number;
          sheets_analyzed?: number;
          sheets_selected?: number;
          sheets_total?: number;
          stage_message?: string | null;
          status?: string;
          updated_at?: string;
          used_vision?: boolean;
          window_count?: number;
          working_set_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "plan_analysis_runs_document_id_fkey";
            columns: ["document_id"];
            isOneToOne: false;
            referencedRelation: "documents";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "plan_analysis_runs_project_id_fkey";
            columns: ["project_id"];
            isOneToOne: false;
            referencedRelation: "projects";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "plan_analysis_runs_working_set_id_fkey";
            columns: ["working_set_id"];
            isOneToOne: false;
            referencedRelation: "working_sets";
            referencedColumns: ["id"];
          },
        ];
      };
      plan_schedule_entries: {
        Row: {
          callout_matches: number;
          callout_sheets: string[] | null;
          confidence: number;
          created_at: string;
          deleted_at: string | null;
          deleted_by: string | null;
          deletion_reason: string | null;
          document_id: string | null;
          glazing: string | null;
          height: string | null;
          id: string;
          mark: string | null;
          material: string | null;
          notes: string | null;
          operation: string | null;
          original_parent_id: string | null;
          page_id: string | null;
          page_number: number | null;
          project_id: string;
          quantity: number;
          restore_status: string;
          run_id: string | null;
          schedule_type: string;
          source_sheet: string | null;
          type_label: string | null;
          width: string | null;
        };
        Insert: {
          callout_matches?: number;
          callout_sheets?: string[] | null;
          confidence?: number;
          created_at?: string;
          deleted_at?: string | null;
          deleted_by?: string | null;
          deletion_reason?: string | null;
          document_id?: string | null;
          glazing?: string | null;
          height?: string | null;
          id?: string;
          mark?: string | null;
          material?: string | null;
          notes?: string | null;
          operation?: string | null;
          original_parent_id?: string | null;
          page_id?: string | null;
          page_number?: number | null;
          project_id: string;
          quantity?: number;
          restore_status?: string;
          run_id?: string | null;
          schedule_type?: string;
          source_sheet?: string | null;
          type_label?: string | null;
          width?: string | null;
        };
        Update: {
          callout_matches?: number;
          callout_sheets?: string[] | null;
          confidence?: number;
          created_at?: string;
          deleted_at?: string | null;
          deleted_by?: string | null;
          deletion_reason?: string | null;
          document_id?: string | null;
          glazing?: string | null;
          height?: string | null;
          id?: string;
          mark?: string | null;
          material?: string | null;
          notes?: string | null;
          operation?: string | null;
          original_parent_id?: string | null;
          page_id?: string | null;
          page_number?: number | null;
          project_id?: string;
          quantity?: number;
          restore_status?: string;
          run_id?: string | null;
          schedule_type?: string;
          source_sheet?: string | null;
          type_label?: string | null;
          width?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "plan_schedule_entries_document_id_fkey";
            columns: ["document_id"];
            isOneToOne: false;
            referencedRelation: "documents";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "plan_schedule_entries_page_id_fkey";
            columns: ["page_id"];
            isOneToOne: false;
            referencedRelation: "pages";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "plan_schedule_entries_project_id_fkey";
            columns: ["project_id"];
            isOneToOne: false;
            referencedRelation: "projects";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "plan_schedule_entries_run_id_fkey";
            columns: ["run_id"];
            isOneToOne: false;
            referencedRelation: "plan_analysis_runs";
            referencedColumns: ["id"];
          },
        ];
      };
      plan_sheet_classifications: {
        Row: {
          category: string;
          confidence: number;
          created_at: string;
          document_id: string | null;
          id: string;
          page_id: string | null;
          page_number: number;
          project_id: string;
          reason: string | null;
          relevance: number;
          run_id: string | null;
          selected: boolean;
          sheet_number: string | null;
          title: string | null;
        };
        Insert: {
          category?: string;
          confidence?: number;
          created_at?: string;
          document_id?: string | null;
          id?: string;
          page_id?: string | null;
          page_number: number;
          project_id: string;
          reason?: string | null;
          relevance?: number;
          run_id?: string | null;
          selected?: boolean;
          sheet_number?: string | null;
          title?: string | null;
        };
        Update: {
          category?: string;
          confidence?: number;
          created_at?: string;
          document_id?: string | null;
          id?: string;
          page_id?: string | null;
          page_number?: number;
          project_id?: string;
          reason?: string | null;
          relevance?: number;
          run_id?: string | null;
          selected?: boolean;
          sheet_number?: string | null;
          title?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "plan_sheet_classifications_document_id_fkey";
            columns: ["document_id"];
            isOneToOne: false;
            referencedRelation: "documents";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "plan_sheet_classifications_page_id_fkey";
            columns: ["page_id"];
            isOneToOne: false;
            referencedRelation: "pages";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "plan_sheet_classifications_project_id_fkey";
            columns: ["project_id"];
            isOneToOne: false;
            referencedRelation: "projects";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "plan_sheet_classifications_run_id_fkey";
            columns: ["run_id"];
            isOneToOne: false;
            referencedRelation: "plan_analysis_runs";
            referencedColumns: ["id"];
          },
        ];
      };
      profiles: {
        Row: {
          avatar_url: string | null;
          created_at: string;
          email: string | null;
          full_name: string | null;
          id: string;
          updated_at: string;
        };
        Insert: {
          avatar_url?: string | null;
          created_at?: string;
          email?: string | null;
          full_name?: string | null;
          id: string;
          updated_at?: string;
        };
        Update: {
          avatar_url?: string | null;
          created_at?: string;
          email?: string | null;
          full_name?: string | null;
          id?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      project_address_candidates: {
        Row: {
          city: string | null;
          confirmed_at: string | null;
          confirmed_by: string | null;
          country: string | null;
          county: string | null;
          created_at: string;
          dedupe_key: string | null;
          deleted_at: string | null;
          deleted_by: string | null;
          deletion_reason: string | null;
          document_id: string | null;
          duplicate_of: string | null;
          geocode_confidence: number | null;
          geocode_error: string | null;
          geocode_provider: string | null;
          geocode_status: string;
          id: string;
          label: string | null;
          latitude: number | null;
          longitude: number | null;
          municipality: string | null;
          normalized_address: string | null;
          notes: string | null;
          original_parent_id: string | null;
          page_id: string | null;
          pin_adjusted: boolean;
          postal_code: string | null;
          project_id: string;
          raw_address: string;
          restore_status: string;
          review_status: string;
          role: string;
          run_id: string | null;
          score: number;
          selected: boolean;
          source_sheet: string | null;
          state: string | null;
          updated_at: string;
        };
        Insert: {
          city?: string | null;
          confirmed_at?: string | null;
          confirmed_by?: string | null;
          country?: string | null;
          county?: string | null;
          created_at?: string;
          dedupe_key?: string | null;
          deleted_at?: string | null;
          deleted_by?: string | null;
          deletion_reason?: string | null;
          document_id?: string | null;
          duplicate_of?: string | null;
          geocode_confidence?: number | null;
          geocode_error?: string | null;
          geocode_provider?: string | null;
          geocode_status?: string;
          id?: string;
          label?: string | null;
          latitude?: number | null;
          longitude?: number | null;
          municipality?: string | null;
          normalized_address?: string | null;
          notes?: string | null;
          original_parent_id?: string | null;
          page_id?: string | null;
          pin_adjusted?: boolean;
          postal_code?: string | null;
          project_id: string;
          raw_address: string;
          restore_status?: string;
          review_status?: string;
          role?: string;
          run_id?: string | null;
          score?: number;
          selected?: boolean;
          source_sheet?: string | null;
          state?: string | null;
          updated_at?: string;
        };
        Update: {
          city?: string | null;
          confirmed_at?: string | null;
          confirmed_by?: string | null;
          country?: string | null;
          county?: string | null;
          created_at?: string;
          dedupe_key?: string | null;
          deleted_at?: string | null;
          deleted_by?: string | null;
          deletion_reason?: string | null;
          document_id?: string | null;
          duplicate_of?: string | null;
          geocode_confidence?: number | null;
          geocode_error?: string | null;
          geocode_provider?: string | null;
          geocode_status?: string;
          id?: string;
          label?: string | null;
          latitude?: number | null;
          longitude?: number | null;
          municipality?: string | null;
          normalized_address?: string | null;
          notes?: string | null;
          original_parent_id?: string | null;
          page_id?: string | null;
          pin_adjusted?: boolean;
          postal_code?: string | null;
          project_id?: string;
          raw_address?: string;
          restore_status?: string;
          review_status?: string;
          role?: string;
          run_id?: string | null;
          score?: number;
          selected?: boolean;
          source_sheet?: string | null;
          state?: string | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "project_address_candidates_document_id_fkey";
            columns: ["document_id"];
            isOneToOne: false;
            referencedRelation: "documents";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "project_address_candidates_page_id_fkey";
            columns: ["page_id"];
            isOneToOne: false;
            referencedRelation: "pages";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "project_address_candidates_project_id_fkey";
            columns: ["project_id"];
            isOneToOne: false;
            referencedRelation: "projects";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "project_address_candidates_run_id_fkey";
            columns: ["run_id"];
            isOneToOne: false;
            referencedRelation: "project_extraction_runs";
            referencedColumns: ["id"];
          },
        ];
      };
      project_archives: {
        Row: {
          counts: Json;
          created_at: string;
          created_by: string | null;
          id: string;
          label: string | null;
          project_id: string;
          reason: string | null;
          snapshot: Json;
          version: number;
        };
        Insert: {
          counts?: Json;
          created_at?: string;
          created_by?: string | null;
          id?: string;
          label?: string | null;
          project_id: string;
          reason?: string | null;
          snapshot?: Json;
          version: number;
        };
        Update: {
          counts?: Json;
          created_at?: string;
          created_by?: string | null;
          id?: string;
          label?: string | null;
          project_id?: string;
          reason?: string | null;
          snapshot?: Json;
          version?: number;
        };
        Relationships: [
          {
            foreignKeyName: "project_archives_project_id_fkey";
            columns: ["project_id"];
            isOneToOne: false;
            referencedRelation: "projects";
            referencedColumns: ["id"];
          },
        ];
      };
      project_authorities: {
        Row: {
          address: string | null;
          city: string | null;
          confidence: number | null;
          contact_person: string | null;
          created_at: string;
          created_by: string | null;
          dedupe_key: string | null;
          deleted_at: string | null;
          deleted_by: string | null;
          deletion_reason: string | null;
          department_name: string | null;
          department_type: string;
          email: string | null;
          hours: string | null;
          id: string;
          jurisdiction_level: string | null;
          jurisdiction_name: string | null;
          official_source_url: string | null;
          original_parent_id: string | null;
          permit_portal: string | null;
          phone: string | null;
          postal_code: string | null;
          project_id: string;
          restore_status: string;
          retrieved_at: string | null;
          services: string | null;
          source_kind: string;
          state: string | null;
          updated_at: string;
          user_notes: string | null;
          verification_status: string;
          website: string | null;
        };
        Insert: {
          address?: string | null;
          city?: string | null;
          confidence?: number | null;
          contact_person?: string | null;
          created_at?: string;
          created_by?: string | null;
          dedupe_key?: string | null;
          deleted_at?: string | null;
          deleted_by?: string | null;
          deletion_reason?: string | null;
          department_name?: string | null;
          department_type: string;
          email?: string | null;
          hours?: string | null;
          id?: string;
          jurisdiction_level?: string | null;
          jurisdiction_name?: string | null;
          official_source_url?: string | null;
          original_parent_id?: string | null;
          permit_portal?: string | null;
          phone?: string | null;
          postal_code?: string | null;
          project_id: string;
          restore_status?: string;
          retrieved_at?: string | null;
          services?: string | null;
          source_kind?: string;
          state?: string | null;
          updated_at?: string;
          user_notes?: string | null;
          verification_status?: string;
          website?: string | null;
        };
        Update: {
          address?: string | null;
          city?: string | null;
          confidence?: number | null;
          contact_person?: string | null;
          created_at?: string;
          created_by?: string | null;
          dedupe_key?: string | null;
          deleted_at?: string | null;
          deleted_by?: string | null;
          deletion_reason?: string | null;
          department_name?: string | null;
          department_type?: string;
          email?: string | null;
          hours?: string | null;
          id?: string;
          jurisdiction_level?: string | null;
          jurisdiction_name?: string | null;
          official_source_url?: string | null;
          original_parent_id?: string | null;
          permit_portal?: string | null;
          phone?: string | null;
          postal_code?: string | null;
          project_id?: string;
          restore_status?: string;
          retrieved_at?: string | null;
          services?: string | null;
          source_kind?: string;
          state?: string | null;
          updated_at?: string;
          user_notes?: string | null;
          verification_status?: string;
          website?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "project_authorities_project_id_fkey";
            columns: ["project_id"];
            isOneToOne: false;
            referencedRelation: "projects";
            referencedColumns: ["id"];
          },
        ];
      };
      project_cloud_links: {
        Row: {
          account_label: string | null;
          created_at: string;
          folder_id: string | null;
          folder_name: string | null;
          folder_path: string;
          id: string;
          last_checked_at: string | null;
          last_synced_at: string | null;
          linked_by: string | null;
          project_id: string;
          provider: string;
          sync_error: string | null;
          sync_status: string;
          updated_at: string;
        };
        Insert: {
          account_label?: string | null;
          created_at?: string;
          folder_id?: string | null;
          folder_name?: string | null;
          folder_path?: string;
          id?: string;
          last_checked_at?: string | null;
          last_synced_at?: string | null;
          linked_by?: string | null;
          project_id: string;
          provider: string;
          sync_error?: string | null;
          sync_status?: string;
          updated_at?: string;
        };
        Update: {
          account_label?: string | null;
          created_at?: string;
          folder_id?: string | null;
          folder_name?: string | null;
          folder_path?: string;
          id?: string;
          last_checked_at?: string | null;
          last_synced_at?: string | null;
          linked_by?: string | null;
          project_id?: string;
          provider?: string;
          sync_error?: string | null;
          sync_status?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "project_cloud_links_project_id_fkey";
            columns: ["project_id"];
            isOneToOne: false;
            referencedRelation: "projects";
            referencedColumns: ["id"];
          },
        ];
      };
      project_contacts: {
        Row: {
          address: string | null;
          city: string | null;
          company: string | null;
          confidence: number | null;
          created_at: string;
          created_by: string | null;
          dedupe_key: string | null;
          deleted_at: string | null;
          deleted_by: string | null;
          deletion_reason: string | null;
          document_id: string | null;
          duplicate_of: string | null;
          email: string | null;
          id: string;
          last_verified_at: string | null;
          license_number: string | null;
          notes: string | null;
          original_parent_id: string | null;
          page_id: string | null;
          person_name: string | null;
          phone: string | null;
          phone_secondary: string | null;
          postal_code: string | null;
          project_id: string;
          restore_status: string;
          review_status: string;
          role: string;
          role_label: string | null;
          run_id: string | null;
          source_document: string | null;
          source_kind: string;
          source_page_number: number | null;
          source_sheet: string | null;
          source_text: string | null;
          sources: Json;
          state: string | null;
          updated_at: string;
          user_corrected: boolean;
          verification_status: string;
          website: string | null;
        };
        Insert: {
          address?: string | null;
          city?: string | null;
          company?: string | null;
          confidence?: number | null;
          created_at?: string;
          created_by?: string | null;
          dedupe_key?: string | null;
          deleted_at?: string | null;
          deleted_by?: string | null;
          deletion_reason?: string | null;
          document_id?: string | null;
          duplicate_of?: string | null;
          email?: string | null;
          id?: string;
          last_verified_at?: string | null;
          license_number?: string | null;
          notes?: string | null;
          original_parent_id?: string | null;
          page_id?: string | null;
          person_name?: string | null;
          phone?: string | null;
          phone_secondary?: string | null;
          postal_code?: string | null;
          project_id: string;
          restore_status?: string;
          review_status?: string;
          role: string;
          role_label?: string | null;
          run_id?: string | null;
          source_document?: string | null;
          source_kind?: string;
          source_page_number?: number | null;
          source_sheet?: string | null;
          source_text?: string | null;
          sources?: Json;
          state?: string | null;
          updated_at?: string;
          user_corrected?: boolean;
          verification_status?: string;
          website?: string | null;
        };
        Update: {
          address?: string | null;
          city?: string | null;
          company?: string | null;
          confidence?: number | null;
          created_at?: string;
          created_by?: string | null;
          dedupe_key?: string | null;
          deleted_at?: string | null;
          deleted_by?: string | null;
          deletion_reason?: string | null;
          document_id?: string | null;
          duplicate_of?: string | null;
          email?: string | null;
          id?: string;
          last_verified_at?: string | null;
          license_number?: string | null;
          notes?: string | null;
          original_parent_id?: string | null;
          page_id?: string | null;
          person_name?: string | null;
          phone?: string | null;
          phone_secondary?: string | null;
          postal_code?: string | null;
          project_id?: string;
          restore_status?: string;
          review_status?: string;
          role?: string;
          role_label?: string | null;
          run_id?: string | null;
          source_document?: string | null;
          source_kind?: string;
          source_page_number?: number | null;
          source_sheet?: string | null;
          source_text?: string | null;
          sources?: Json;
          state?: string | null;
          updated_at?: string;
          user_corrected?: boolean;
          verification_status?: string;
          website?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "project_contacts_project_id_fkey";
            columns: ["project_id"];
            isOneToOne: false;
            referencedRelation: "projects";
            referencedColumns: ["id"];
          },
        ];
      };
      project_extraction_runs: {
        Row: {
          created_at: string;
          created_by: string | null;
          document_id: string | null;
          error_message: string | null;
          fields_found: number;
          id: string;
          pages_scanned: number;
          pages_total: number;
          project_id: string;
          stage_message: string | null;
          status: string;
          updated_at: string;
          used_vision: boolean;
        };
        Insert: {
          created_at?: string;
          created_by?: string | null;
          document_id?: string | null;
          error_message?: string | null;
          fields_found?: number;
          id?: string;
          pages_scanned?: number;
          pages_total?: number;
          project_id: string;
          stage_message?: string | null;
          status?: string;
          updated_at?: string;
          used_vision?: boolean;
        };
        Update: {
          created_at?: string;
          created_by?: string | null;
          document_id?: string | null;
          error_message?: string | null;
          fields_found?: number;
          id?: string;
          pages_scanned?: number;
          pages_total?: number;
          project_id?: string;
          stage_message?: string | null;
          status?: string;
          updated_at?: string;
          used_vision?: boolean;
        };
        Relationships: [
          {
            foreignKeyName: "project_extraction_runs_document_id_fkey";
            columns: ["document_id"];
            isOneToOne: false;
            referencedRelation: "documents";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "project_extraction_runs_project_id_fkey";
            columns: ["project_id"];
            isOneToOne: false;
            referencedRelation: "projects";
            referencedColumns: ["id"];
          },
        ];
      };
      project_field_extractions: {
        Row: {
          applied: boolean;
          bbox: Json;
          confidence: number;
          conflict_value: string | null;
          created_at: string;
          decided_at: string | null;
          decided_by: string | null;
          dedupe_key: string | null;
          deleted_at: string | null;
          deleted_by: string | null;
          deletion_reason: string | null;
          document_id: string | null;
          extracted_at: string;
          field_key: string;
          id: string;
          original_parent_id: string | null;
          page_id: string | null;
          project_id: string;
          restore_status: string;
          run_id: string | null;
          snippet: string | null;
          source_page_number: number | null;
          source_sheet: string | null;
          status: string;
          suppressed: boolean;
          updated_at: string;
          value: string;
        };
        Insert: {
          applied?: boolean;
          bbox?: Json;
          confidence?: number;
          conflict_value?: string | null;
          created_at?: string;
          decided_at?: string | null;
          decided_by?: string | null;
          dedupe_key?: string | null;
          deleted_at?: string | null;
          deleted_by?: string | null;
          deletion_reason?: string | null;
          document_id?: string | null;
          extracted_at?: string;
          field_key: string;
          id?: string;
          original_parent_id?: string | null;
          page_id?: string | null;
          project_id: string;
          restore_status?: string;
          run_id?: string | null;
          snippet?: string | null;
          source_page_number?: number | null;
          source_sheet?: string | null;
          status?: string;
          suppressed?: boolean;
          updated_at?: string;
          value: string;
        };
        Update: {
          applied?: boolean;
          bbox?: Json;
          confidence?: number;
          conflict_value?: string | null;
          created_at?: string;
          decided_at?: string | null;
          decided_by?: string | null;
          dedupe_key?: string | null;
          deleted_at?: string | null;
          deleted_by?: string | null;
          deletion_reason?: string | null;
          document_id?: string | null;
          extracted_at?: string;
          field_key?: string;
          id?: string;
          original_parent_id?: string | null;
          page_id?: string | null;
          project_id?: string;
          restore_status?: string;
          run_id?: string | null;
          snippet?: string | null;
          source_page_number?: number | null;
          source_sheet?: string | null;
          status?: string;
          suppressed?: boolean;
          updated_at?: string;
          value?: string;
        };
        Relationships: [
          {
            foreignKeyName: "project_field_extractions_document_id_fkey";
            columns: ["document_id"];
            isOneToOne: false;
            referencedRelation: "documents";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "project_field_extractions_page_id_fkey";
            columns: ["page_id"];
            isOneToOne: false;
            referencedRelation: "pages";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "project_field_extractions_project_id_fkey";
            columns: ["project_id"];
            isOneToOne: false;
            referencedRelation: "projects";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "project_field_extractions_run_id_fkey";
            columns: ["run_id"];
            isOneToOne: false;
            referencedRelation: "project_extraction_runs";
            referencedColumns: ["id"];
          },
        ];
      };
      project_intelligence_facts: {
        Row: {
          confidence: number;
          created_at: string;
          created_by: string | null;
          decided_at: string | null;
          decided_by: string | null;
          document_id: string | null;
          fact_key: string;
          fact_type: string;
          id: string;
          label: string | null;
          page_id: string | null;
          project_id: string;
          reasoning: string | null;
          run_id: string | null;
          sources: Json;
          status: string;
          superseded: boolean;
          updated_at: string;
          value: Json;
          version: number;
        };
        Insert: {
          confidence?: number;
          created_at?: string;
          created_by?: string | null;
          decided_at?: string | null;
          decided_by?: string | null;
          document_id?: string | null;
          fact_key: string;
          fact_type: string;
          id?: string;
          label?: string | null;
          page_id?: string | null;
          project_id: string;
          reasoning?: string | null;
          run_id?: string | null;
          sources?: Json;
          status?: string;
          superseded?: boolean;
          updated_at?: string;
          value?: Json;
          version?: number;
        };
        Update: {
          confidence?: number;
          created_at?: string;
          created_by?: string | null;
          decided_at?: string | null;
          decided_by?: string | null;
          document_id?: string | null;
          fact_key?: string;
          fact_type?: string;
          id?: string;
          label?: string | null;
          page_id?: string | null;
          project_id?: string;
          reasoning?: string | null;
          run_id?: string | null;
          sources?: Json;
          status?: string;
          superseded?: boolean;
          updated_at?: string;
          value?: Json;
          version?: number;
        };
        Relationships: [
          {
            foreignKeyName: "project_intelligence_facts_project_id_fkey";
            columns: ["project_id"];
            isOneToOne: false;
            referencedRelation: "projects";
            referencedColumns: ["id"];
          },
        ];
      };
      project_members: {
        Row: {
          created_at: string;
          id: string;
          project_id: string;
          role: Database["public"]["Enums"]["app_role"];
          user_id: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          project_id: string;
          role?: Database["public"]["Enums"]["app_role"];
          user_id: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          project_id?: string;
          role?: Database["public"]["Enums"]["app_role"];
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "project_members_project_id_fkey";
            columns: ["project_id"];
            isOneToOne: false;
            referencedRelation: "projects";
            referencedColumns: ["id"];
          },
        ];
      };
      project_quantity_estimates: {
        Row: {
          bucket: string;
          confidence: number;
          coverage: string | null;
          created_at: string;
          decided_at: string | null;
          decided_by: string | null;
          deleted_at: string | null;
          deleted_by: string | null;
          deletion_reason: string | null;
          id: string;
          label: string;
          marks: Json;
          original_parent_id: string | null;
          project_id: string;
          quantity: number;
          reasoning: string | null;
          restore_status: string;
          run_id: string | null;
          source_counts: Json;
          status: string;
          updated_at: string;
          user_quantity: number | null;
          version: number;
        };
        Insert: {
          bucket: string;
          confidence?: number;
          coverage?: string | null;
          created_at?: string;
          decided_at?: string | null;
          decided_by?: string | null;
          deleted_at?: string | null;
          deleted_by?: string | null;
          deletion_reason?: string | null;
          id?: string;
          label: string;
          marks?: Json;
          original_parent_id?: string | null;
          project_id: string;
          quantity?: number;
          reasoning?: string | null;
          restore_status?: string;
          run_id?: string | null;
          source_counts?: Json;
          status?: string;
          updated_at?: string;
          user_quantity?: number | null;
          version?: number;
        };
        Update: {
          bucket?: string;
          confidence?: number;
          coverage?: string | null;
          created_at?: string;
          decided_at?: string | null;
          decided_by?: string | null;
          deleted_at?: string | null;
          deleted_by?: string | null;
          deletion_reason?: string | null;
          id?: string;
          label?: string;
          marks?: Json;
          original_parent_id?: string | null;
          project_id?: string;
          quantity?: number;
          reasoning?: string | null;
          restore_status?: string;
          run_id?: string | null;
          source_counts?: Json;
          status?: string;
          updated_at?: string;
          user_quantity?: number | null;
          version?: number;
        };
        Relationships: [
          {
            foreignKeyName: "project_quantity_estimates_project_id_fkey";
            columns: ["project_id"];
            isOneToOne: false;
            referencedRelation: "projects";
            referencedColumns: ["id"];
          },
        ];
      };
      projects: {
        Row: {
          address: string | null;
          architect: string | null;
          archive_version: number;
          archived_at: string | null;
          building_count: number | null;
          building_department: string | null;
          buildings: string[] | null;
          city: string | null;
          code: string | null;
          code_edition: string | null;
          construction_type: string | null;
          country: string | null;
          county: string | null;
          created_at: string;
          customer_id: string | null;
          deleted_at: string | null;
          deleted_by: string | null;
          deletion_reason: string | null;
          description: string | null;
          design_pressure_notes: string | null;
          drawing_set_title: string | null;
          due_date: string | null;
          engineer: string | null;
          estimator_id: string | null;
          exposure_category: string | null;
          flood_zone: string | null;
          floors: string[] | null;
          general_contractor: string | null;
          id: string;
          is_demo: boolean;
          issue_date: string | null;
          latitude: number | null;
          lock_reason: string | null;
          locked_at: string | null;
          locked_by: string | null;
          longitude: number | null;
          municipality: string | null;
          name: string;
          notes: string | null;
          occupancy_type: string | null;
          owner_developer: string | null;
          owner_id: string;
          parcel_id: string | null;
          permit_number: string | null;
          phase_count: number | null;
          plan_date: string | null;
          postal_code: string | null;
          project_number: string | null;
          project_type: string | null;
          restore_status: string;
          reviewer_id: string | null;
          revision: string | null;
          revision_date: string | null;
          risk_category: string | null;
          state: string | null;
          status: Database["public"]["Enums"]["project_status"];
          story_count: number | null;
          subdivision: string | null;
          unit_count: number | null;
          unit_suite: string | null;
          updated_at: string;
          wind_speed: string | null;
        };
        Insert: {
          address?: string | null;
          architect?: string | null;
          archive_version?: number;
          archived_at?: string | null;
          building_count?: number | null;
          building_department?: string | null;
          buildings?: string[] | null;
          city?: string | null;
          code?: string | null;
          code_edition?: string | null;
          construction_type?: string | null;
          country?: string | null;
          county?: string | null;
          created_at?: string;
          customer_id?: string | null;
          deleted_at?: string | null;
          deleted_by?: string | null;
          deletion_reason?: string | null;
          description?: string | null;
          design_pressure_notes?: string | null;
          drawing_set_title?: string | null;
          due_date?: string | null;
          engineer?: string | null;
          estimator_id?: string | null;
          exposure_category?: string | null;
          flood_zone?: string | null;
          floors?: string[] | null;
          general_contractor?: string | null;
          id?: string;
          is_demo?: boolean;
          issue_date?: string | null;
          latitude?: number | null;
          lock_reason?: string | null;
          locked_at?: string | null;
          locked_by?: string | null;
          longitude?: number | null;
          municipality?: string | null;
          name: string;
          notes?: string | null;
          occupancy_type?: string | null;
          owner_developer?: string | null;
          owner_id: string;
          parcel_id?: string | null;
          permit_number?: string | null;
          phase_count?: number | null;
          plan_date?: string | null;
          postal_code?: string | null;
          project_number?: string | null;
          project_type?: string | null;
          restore_status?: string;
          reviewer_id?: string | null;
          revision?: string | null;
          revision_date?: string | null;
          risk_category?: string | null;
          state?: string | null;
          status?: Database["public"]["Enums"]["project_status"];
          story_count?: number | null;
          subdivision?: string | null;
          unit_count?: number | null;
          unit_suite?: string | null;
          updated_at?: string;
          wind_speed?: string | null;
        };
        Update: {
          address?: string | null;
          architect?: string | null;
          archive_version?: number;
          archived_at?: string | null;
          building_count?: number | null;
          building_department?: string | null;
          buildings?: string[] | null;
          city?: string | null;
          code?: string | null;
          code_edition?: string | null;
          construction_type?: string | null;
          country?: string | null;
          county?: string | null;
          created_at?: string;
          customer_id?: string | null;
          deleted_at?: string | null;
          deleted_by?: string | null;
          deletion_reason?: string | null;
          description?: string | null;
          design_pressure_notes?: string | null;
          drawing_set_title?: string | null;
          due_date?: string | null;
          engineer?: string | null;
          estimator_id?: string | null;
          exposure_category?: string | null;
          flood_zone?: string | null;
          floors?: string[] | null;
          general_contractor?: string | null;
          id?: string;
          is_demo?: boolean;
          issue_date?: string | null;
          latitude?: number | null;
          lock_reason?: string | null;
          locked_at?: string | null;
          locked_by?: string | null;
          longitude?: number | null;
          municipality?: string | null;
          name?: string;
          notes?: string | null;
          occupancy_type?: string | null;
          owner_developer?: string | null;
          owner_id?: string;
          parcel_id?: string | null;
          permit_number?: string | null;
          phase_count?: number | null;
          plan_date?: string | null;
          postal_code?: string | null;
          project_number?: string | null;
          project_type?: string | null;
          restore_status?: string;
          reviewer_id?: string | null;
          revision?: string | null;
          revision_date?: string | null;
          risk_category?: string | null;
          state?: string | null;
          status?: Database["public"]["Enums"]["project_status"];
          story_count?: number | null;
          subdivision?: string | null;
          unit_count?: number | null;
          unit_suite?: string | null;
          updated_at?: string;
          wind_speed?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "projects_customer_id_fkey";
            columns: ["customer_id"];
            isOneToOne: false;
            referencedRelation: "customers";
            referencedColumns: ["id"];
          },
        ];
      };
      quality_issues: {
        Row: {
          area: string;
          created_at: string;
          entity_id: string | null;
          entity_type: string | null;
          id: string;
          message: string;
          project_id: string;
          resolved: boolean;
          severity: string;
        };
        Insert: {
          area: string;
          created_at?: string;
          entity_id?: string | null;
          entity_type?: string | null;
          id?: string;
          message: string;
          project_id: string;
          resolved?: boolean;
          severity?: string;
        };
        Update: {
          area?: string;
          created_at?: string;
          entity_id?: string | null;
          entity_type?: string | null;
          id?: string;
          message?: string;
          project_id?: string;
          resolved?: boolean;
          severity?: string;
        };
        Relationships: [
          {
            foreignKeyName: "quality_issues_project_id_fkey";
            columns: ["project_id"];
            isOneToOne: false;
            referencedRelation: "projects";
            referencedColumns: ["id"];
          },
        ];
      };
      quote_items: {
        Row: {
          description: string | null;
          id: string;
          line_total: number | null;
          mark: string | null;
          metadata: Json;
          quantity: number;
          quote_id: string;
          unit_price: number | null;
        };
        Insert: {
          description?: string | null;
          id?: string;
          line_total?: number | null;
          mark?: string | null;
          metadata?: Json;
          quantity?: number;
          quote_id: string;
          unit_price?: number | null;
        };
        Update: {
          description?: string | null;
          id?: string;
          line_total?: number | null;
          mark?: string | null;
          metadata?: Json;
          quantity?: number;
          quote_id?: string;
          unit_price?: number | null;
        };
        Relationships: [
          {
            foreignKeyName: "quote_items_quote_id_fkey";
            columns: ["quote_id"];
            isOneToOne: false;
            referencedRelation: "quotes";
            referencedColumns: ["id"];
          },
        ];
      };
      quote_request_activity: {
        Row: {
          actor_id: string | null;
          created_at: string;
          detail: string | null;
          id: string;
          kind: string;
          submission_id: string;
        };
        Insert: {
          actor_id?: string | null;
          created_at?: string;
          detail?: string | null;
          id?: string;
          kind: string;
          submission_id: string;
        };
        Update: {
          actor_id?: string | null;
          created_at?: string;
          detail?: string | null;
          id?: string;
          kind?: string;
          submission_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "quote_request_activity_submission_id_fkey";
            columns: ["submission_id"];
            isOneToOne: false;
            referencedRelation: "contact_submissions";
            referencedColumns: ["id"];
          },
        ];
      };
      quote_request_documents: {
        Row: {
          archived_at: string | null;
          checksum: string | null;
          classification: string | null;
          created_at: string;
          deleted_at: string | null;
          deleted_by: string | null;
          deletion_reason: string | null;
          document_id: string | null;
          file_name: string;
          id: string;
          intake_file_id: string | null;
          kind: string;
          mime_type: string | null;
          original_filename: string;
          original_parent_id: string | null;
          restore_status: string;
          size_bytes: number;
          storage_path: string;
          submission_id: string;
          updated_at: string;
        };
        Insert: {
          archived_at?: string | null;
          checksum?: string | null;
          classification?: string | null;
          created_at?: string;
          deleted_at?: string | null;
          deleted_by?: string | null;
          deletion_reason?: string | null;
          document_id?: string | null;
          file_name: string;
          id?: string;
          intake_file_id?: string | null;
          kind?: string;
          mime_type?: string | null;
          original_filename: string;
          original_parent_id?: string | null;
          restore_status?: string;
          size_bytes?: number;
          storage_path: string;
          submission_id: string;
          updated_at?: string;
        };
        Update: {
          archived_at?: string | null;
          checksum?: string | null;
          classification?: string | null;
          created_at?: string;
          deleted_at?: string | null;
          deleted_by?: string | null;
          deletion_reason?: string | null;
          document_id?: string | null;
          file_name?: string;
          id?: string;
          intake_file_id?: string | null;
          kind?: string;
          mime_type?: string | null;
          original_filename?: string;
          original_parent_id?: string | null;
          restore_status?: string;
          size_bytes?: number;
          storage_path?: string;
          submission_id?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "quote_request_documents_document_id_fkey";
            columns: ["document_id"];
            isOneToOne: false;
            referencedRelation: "documents";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "quote_request_documents_intake_file_id_fkey";
            columns: ["intake_file_id"];
            isOneToOne: false;
            referencedRelation: "intake_files";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "quote_request_documents_submission_id_fkey";
            columns: ["submission_id"];
            isOneToOne: false;
            referencedRelation: "contact_submissions";
            referencedColumns: ["id"];
          },
        ];
      };
      quotes: {
        Row: {
          created_at: string;
          created_by: string | null;
          id: string;
          notes: string | null;
          project_id: string;
          snapshot: Json;
          status: string;
          total_amount: number | null;
          updated_at: string;
          version: number;
        };
        Insert: {
          created_at?: string;
          created_by?: string | null;
          id?: string;
          notes?: string | null;
          project_id: string;
          snapshot?: Json;
          status?: string;
          total_amount?: number | null;
          updated_at?: string;
          version?: number;
        };
        Update: {
          created_at?: string;
          created_by?: string | null;
          id?: string;
          notes?: string | null;
          project_id?: string;
          snapshot?: Json;
          status?: string;
          total_amount?: number | null;
          updated_at?: string;
          version?: number;
        };
        Relationships: [
          {
            foreignKeyName: "quotes_project_id_fkey";
            columns: ["project_id"];
            isOneToOne: false;
            referencedRelation: "projects";
            referencedColumns: ["id"];
          },
        ];
      };
      safety_checks: {
        Row: {
          check_type: string;
          created_at: string;
          exterior_drop_in: number | null;
          id: string;
          meets_egress: boolean | null;
          notes: string | null;
          project_id: string;
          requires_guard: boolean | null;
          requires_safety_glazing: boolean | null;
          requires_wocd: boolean | null;
          sill_height_in: number | null;
          status: Database["public"]["Enums"]["review_status"];
          takeoff_item_id: string | null;
          updated_at: string;
        };
        Insert: {
          check_type: string;
          created_at?: string;
          exterior_drop_in?: number | null;
          id?: string;
          meets_egress?: boolean | null;
          notes?: string | null;
          project_id: string;
          requires_guard?: boolean | null;
          requires_safety_glazing?: boolean | null;
          requires_wocd?: boolean | null;
          sill_height_in?: number | null;
          status?: Database["public"]["Enums"]["review_status"];
          takeoff_item_id?: string | null;
          updated_at?: string;
        };
        Update: {
          check_type?: string;
          created_at?: string;
          exterior_drop_in?: number | null;
          id?: string;
          meets_egress?: boolean | null;
          notes?: string | null;
          project_id?: string;
          requires_guard?: boolean | null;
          requires_safety_glazing?: boolean | null;
          requires_wocd?: boolean | null;
          sill_height_in?: number | null;
          status?: Database["public"]["Enums"]["review_status"];
          takeoff_item_id?: string | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "safety_checks_project_id_fkey";
            columns: ["project_id"];
            isOneToOne: false;
            referencedRelation: "projects";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "safety_checks_takeoff_item_id_fkey";
            columns: ["takeoff_item_id"];
            isOneToOne: false;
            referencedRelation: "takeoff_items";
            referencedColumns: ["id"];
          },
        ];
      };
      schedule_conflicts: {
        Row: {
          conflict_type: string;
          created_at: string;
          detail: string | null;
          id: string;
          mark: string | null;
          project_id: string;
          resolved: boolean;
          schedule_id: string | null;
          severity: string;
        };
        Insert: {
          conflict_type: string;
          created_at?: string;
          detail?: string | null;
          id?: string;
          mark?: string | null;
          project_id: string;
          resolved?: boolean;
          schedule_id?: string | null;
          severity?: string;
        };
        Update: {
          conflict_type?: string;
          created_at?: string;
          detail?: string | null;
          id?: string;
          mark?: string | null;
          project_id?: string;
          resolved?: boolean;
          schedule_id?: string | null;
          severity?: string;
        };
        Relationships: [
          {
            foreignKeyName: "schedule_conflicts_project_id_fkey";
            columns: ["project_id"];
            isOneToOne: false;
            referencedRelation: "projects";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "schedule_conflicts_schedule_id_fkey";
            columns: ["schedule_id"];
            isOneToOne: false;
            referencedRelation: "schedules";
            referencedColumns: ["id"];
          },
        ];
      };
      schedule_rows: {
        Row: {
          glass: string | null;
          height_in: number | null;
          id: string;
          mark: string | null;
          material: string | null;
          operation: string | null;
          quantity: number | null;
          raw: Json;
          remarks: string | null;
          schedule_id: string;
          width_in: number | null;
        };
        Insert: {
          glass?: string | null;
          height_in?: number | null;
          id?: string;
          mark?: string | null;
          material?: string | null;
          operation?: string | null;
          quantity?: number | null;
          raw?: Json;
          remarks?: string | null;
          schedule_id: string;
          width_in?: number | null;
        };
        Update: {
          glass?: string | null;
          height_in?: number | null;
          id?: string;
          mark?: string | null;
          material?: string | null;
          operation?: string | null;
          quantity?: number | null;
          raw?: Json;
          remarks?: string | null;
          schedule_id?: string;
          width_in?: number | null;
        };
        Relationships: [
          {
            foreignKeyName: "schedule_rows_schedule_id_fkey";
            columns: ["schedule_id"];
            isOneToOne: false;
            referencedRelation: "schedules";
            referencedColumns: ["id"];
          },
        ];
      };
      schedules: {
        Row: {
          column_mapping: Json;
          created_at: string;
          id: string;
          name: string;
          project_id: string;
          schedule_type: string;
          source: string;
          updated_at: string;
        };
        Insert: {
          column_mapping?: Json;
          created_at?: string;
          id?: string;
          name: string;
          project_id: string;
          schedule_type?: string;
          source?: string;
          updated_at?: string;
        };
        Update: {
          column_mapping?: Json;
          created_at?: string;
          id?: string;
          name?: string;
          project_id?: string;
          schedule_type?: string;
          source?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "schedules_project_id_fkey";
            columns: ["project_id"];
            isOneToOne: false;
            referencedRelation: "projects";
            referencedColumns: ["id"];
          },
        ];
      };
      site_resource_categories: {
        Row: {
          created_at: string;
          description: string | null;
          icon: string | null;
          id: string;
          name: string;
          slug: string;
          sort_order: number;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          description?: string | null;
          icon?: string | null;
          id?: string;
          name: string;
          slug: string;
          sort_order?: number;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          description?: string | null;
          icon?: string | null;
          id?: string;
          name?: string;
          slug?: string;
          sort_order?: number;
          updated_at?: string;
        };
        Relationships: [];
      };
      site_resources: {
        Row: {
          category_slug: string;
          created_at: string;
          description: string | null;
          external_url: string | null;
          file_size_bytes: number | null;
          file_type: string;
          id: string;
          is_featured: boolean;
          is_published: boolean;
          product_category: string | null;
          published_at: string;
          series: string | null;
          storage_path: string | null;
          thumbnail_url: string | null;
          title: string;
          updated_at: string;
        };
        Insert: {
          category_slug: string;
          created_at?: string;
          description?: string | null;
          external_url?: string | null;
          file_size_bytes?: number | null;
          file_type?: string;
          id?: string;
          is_featured?: boolean;
          is_published?: boolean;
          product_category?: string | null;
          published_at?: string;
          series?: string | null;
          storage_path?: string | null;
          thumbnail_url?: string | null;
          title: string;
          updated_at?: string;
        };
        Update: {
          category_slug?: string;
          created_at?: string;
          description?: string | null;
          external_url?: string | null;
          file_size_bytes?: number | null;
          file_type?: string;
          id?: string;
          is_featured?: boolean;
          is_published?: boolean;
          product_category?: string | null;
          published_at?: string;
          series?: string | null;
          storage_path?: string | null;
          thumbnail_url?: string | null;
          title?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "site_resources_category_slug_fkey";
            columns: ["category_slug"];
            isOneToOne: false;
            referencedRelation: "site_resource_categories";
            referencedColumns: ["slug"];
          },
        ];
      };
      takeoff_item_images: {
        Row: {
          caption: string | null;
          created_at: string;
          id: string;
          storage_path: string;
          takeoff_item_id: string;
        };
        Insert: {
          caption?: string | null;
          created_at?: string;
          id?: string;
          storage_path: string;
          takeoff_item_id: string;
        };
        Update: {
          caption?: string | null;
          created_at?: string;
          id?: string;
          storage_path?: string;
          takeoff_item_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "takeoff_item_images_takeoff_item_id_fkey";
            columns: ["takeoff_item_id"];
            isOneToOne: false;
            referencedRelation: "takeoff_items";
            referencedColumns: ["id"];
          },
        ];
      };
      takeoff_items: {
        Row: {
          ai_confidence: number | null;
          building: string | null;
          category: string;
          color: string | null;
          created_at: string;
          created_by: string | null;
          deleted_at: string | null;
          deleted_by: string | null;
          deletion_reason: string | null;
          description: string | null;
          elevation: string | null;
          finish: string | null;
          floor: string | null;
          frame_type: string | null;
          glass: string | null;
          height_in: number | null;
          id: string;
          impact: boolean | null;
          manufacturer: string | null;
          mark: string | null;
          notes: string | null;
          operation: string | null;
          original_parent_id: string | null;
          page_id: string | null;
          primary_image_path: string | null;
          product_type: string | null;
          project_id: string;
          quantity: number;
          restore_status: string;
          room: string | null;
          series: string | null;
          source_x: number | null;
          source_y: number | null;
          status: Database["public"]["Enums"]["review_status"];
          system: string | null;
          type_name: string | null;
          unit: string | null;
          updated_at: string;
          width_in: number | null;
        };
        Insert: {
          ai_confidence?: number | null;
          building?: string | null;
          category?: string;
          color?: string | null;
          created_at?: string;
          created_by?: string | null;
          deleted_at?: string | null;
          deleted_by?: string | null;
          deletion_reason?: string | null;
          description?: string | null;
          elevation?: string | null;
          finish?: string | null;
          floor?: string | null;
          frame_type?: string | null;
          glass?: string | null;
          height_in?: number | null;
          id?: string;
          impact?: boolean | null;
          manufacturer?: string | null;
          mark?: string | null;
          notes?: string | null;
          operation?: string | null;
          original_parent_id?: string | null;
          page_id?: string | null;
          primary_image_path?: string | null;
          product_type?: string | null;
          project_id: string;
          quantity?: number;
          restore_status?: string;
          room?: string | null;
          series?: string | null;
          source_x?: number | null;
          source_y?: number | null;
          status?: Database["public"]["Enums"]["review_status"];
          system?: string | null;
          type_name?: string | null;
          unit?: string | null;
          updated_at?: string;
          width_in?: number | null;
        };
        Update: {
          ai_confidence?: number | null;
          building?: string | null;
          category?: string;
          color?: string | null;
          created_at?: string;
          created_by?: string | null;
          deleted_at?: string | null;
          deleted_by?: string | null;
          deletion_reason?: string | null;
          description?: string | null;
          elevation?: string | null;
          finish?: string | null;
          floor?: string | null;
          frame_type?: string | null;
          glass?: string | null;
          height_in?: number | null;
          id?: string;
          impact?: boolean | null;
          manufacturer?: string | null;
          mark?: string | null;
          notes?: string | null;
          operation?: string | null;
          original_parent_id?: string | null;
          page_id?: string | null;
          primary_image_path?: string | null;
          product_type?: string | null;
          project_id?: string;
          quantity?: number;
          restore_status?: string;
          room?: string | null;
          series?: string | null;
          source_x?: number | null;
          source_y?: number | null;
          status?: Database["public"]["Enums"]["review_status"];
          system?: string | null;
          type_name?: string | null;
          unit?: string | null;
          updated_at?: string;
          width_in?: number | null;
        };
        Relationships: [
          {
            foreignKeyName: "takeoff_items_page_id_fkey";
            columns: ["page_id"];
            isOneToOne: false;
            referencedRelation: "pages";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "takeoff_items_project_id_fkey";
            columns: ["project_id"];
            isOneToOne: false;
            referencedRelation: "projects";
            referencedColumns: ["id"];
          },
        ];
      };
      user_roles: {
        Row: {
          created_at: string;
          id: string;
          role: Database["public"]["Enums"]["app_role"];
          user_id: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          role: Database["public"]["Enums"]["app_role"];
          user_id: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          role?: Database["public"]["Enums"]["app_role"];
          user_id?: string;
        };
        Relationships: [];
      };
      working_set_pages: {
        Row: {
          id: string;
          page_id: string;
          sort_order: number | null;
          working_set_id: string;
        };
        Insert: {
          id?: string;
          page_id: string;
          sort_order?: number | null;
          working_set_id: string;
        };
        Update: {
          id?: string;
          page_id?: string;
          sort_order?: number | null;
          working_set_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "working_set_pages_page_id_fkey";
            columns: ["page_id"];
            isOneToOne: false;
            referencedRelation: "pages";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "working_set_pages_working_set_id_fkey";
            columns: ["working_set_id"];
            isOneToOne: false;
            referencedRelation: "working_sets";
            referencedColumns: ["id"];
          },
        ];
      };
      working_sets: {
        Row: {
          category: string;
          created_at: string;
          created_by: string | null;
          deleted_at: string | null;
          deleted_by: string | null;
          deletion_reason: string | null;
          description: string | null;
          id: string;
          name: string;
          original_parent_id: string | null;
          project_id: string;
          restore_status: string;
          updated_at: string;
        };
        Insert: {
          category?: string;
          created_at?: string;
          created_by?: string | null;
          deleted_at?: string | null;
          deleted_by?: string | null;
          deletion_reason?: string | null;
          description?: string | null;
          id?: string;
          name: string;
          original_parent_id?: string | null;
          project_id: string;
          restore_status?: string;
          updated_at?: string;
        };
        Update: {
          category?: string;
          created_at?: string;
          created_by?: string | null;
          deleted_at?: string | null;
          deleted_by?: string | null;
          deletion_reason?: string | null;
          description?: string | null;
          id?: string;
          name?: string;
          original_parent_id?: string | null;
          project_id?: string;
          restore_status?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "working_sets_project_id_fkey";
            columns: ["project_id"];
            isOneToOne: false;
            referencedRelation: "projects";
            referencedColumns: ["id"];
          },
        ];
      };
      ykk_mappings: {
        Row: {
          combination_id: string | null;
          confidence: number | null;
          configuration: Json;
          created_at: string;
          id: string;
          notes: string | null;
          project_id: string;
          status: string;
          takeoff_item_id: string | null;
          updated_at: string;
          ykk_product_id: string | null;
        };
        Insert: {
          combination_id?: string | null;
          confidence?: number | null;
          configuration?: Json;
          created_at?: string;
          id?: string;
          notes?: string | null;
          project_id: string;
          status?: string;
          takeoff_item_id?: string | null;
          updated_at?: string;
          ykk_product_id?: string | null;
        };
        Update: {
          combination_id?: string | null;
          confidence?: number | null;
          configuration?: Json;
          created_at?: string;
          id?: string;
          notes?: string | null;
          project_id?: string;
          status?: string;
          takeoff_item_id?: string | null;
          updated_at?: string;
          ykk_product_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "ykk_mappings_combination_id_fkey";
            columns: ["combination_id"];
            isOneToOne: false;
            referencedRelation: "combinations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "ykk_mappings_project_id_fkey";
            columns: ["project_id"];
            isOneToOne: false;
            referencedRelation: "projects";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "ykk_mappings_takeoff_item_id_fkey";
            columns: ["takeoff_item_id"];
            isOneToOne: false;
            referencedRelation: "takeoff_items";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "ykk_mappings_ykk_product_id_fkey";
            columns: ["ykk_product_id"];
            isOneToOne: false;
            referencedRelation: "ykk_products";
            referencedColumns: ["id"];
          },
        ];
      };
      ykk_products: {
        Row: {
          active: boolean;
          application: string | null;
          color_options: string[] | null;
          created_at: string;
          description: string | null;
          documents: Json;
          family: string;
          florida_approval: string | null;
          frame_options: string[] | null;
          glass_options: string[] | null;
          hardware_options: string[] | null;
          id: string;
          miami_dade_noa: string | null;
          model: string;
          product_type: string;
          series: string | null;
          updated_at: string;
          verified: boolean;
        };
        Insert: {
          active?: boolean;
          application?: string | null;
          color_options?: string[] | null;
          created_at?: string;
          description?: string | null;
          documents?: Json;
          family: string;
          florida_approval?: string | null;
          frame_options?: string[] | null;
          glass_options?: string[] | null;
          hardware_options?: string[] | null;
          id?: string;
          miami_dade_noa?: string | null;
          model: string;
          product_type: string;
          series?: string | null;
          updated_at?: string;
          verified?: boolean;
        };
        Update: {
          active?: boolean;
          application?: string | null;
          color_options?: string[] | null;
          created_at?: string;
          description?: string | null;
          documents?: Json;
          family?: string;
          florida_approval?: string | null;
          frame_options?: string[] | null;
          glass_options?: string[] | null;
          hardware_options?: string[] | null;
          id?: string;
          miami_dade_noa?: string | null;
          model?: string;
          product_type?: string;
          series?: string | null;
          updated_at?: string;
          verified?: boolean;
        };
        Relationships: [];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      can_access_conversation: {
        Args: { _conversation_id: string; _user_id: string };
        Returns: boolean;
      };
      can_edit: { Args: { _user_id: string }; Returns: boolean };
      can_edit_project: {
        Args: { _project_id: string; _user_id: string };
        Returns: boolean;
      };
      can_view_project: {
        Args: { _project_id: string; _user_id: string };
        Returns: boolean;
      };
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"];
          _user_id: string;
        };
        Returns: boolean;
      };
      is_admin: { Args: { _user_id: string }; Returns: boolean };
      is_project_locked: { Args: { _project_id: string }; Returns: boolean };
    };
    Enums: {
      app_role: "owner_admin" | "estimator" | "reviewer" | "viewer";
      file_scan_status: "scanning" | "clean" | "quarantined" | "rejected" | "manual_review";
      project_status:
        "active" | "review" | "approved" | "ready_for_quote" | "completed" | "on_hold" | "archived";
      review_status: "pending" | "review" | "approved" | "rejected";
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">;

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    keyof DefaultSchema["Enums"] | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    keyof DefaultSchema["CompositeTypes"] | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  public: {
    Enums: {
      app_role: ["owner_admin", "estimator", "reviewer", "viewer"],
      file_scan_status: ["scanning", "clean", "quarantined", "rejected", "manual_review"],
      project_status: [
        "active",
        "review",
        "approved",
        "ready_for_quote",
        "completed",
        "on_hold",
        "archived",
      ],
      review_status: ["pending", "review", "approved", "rejected"],
    },
  },
} as const;
