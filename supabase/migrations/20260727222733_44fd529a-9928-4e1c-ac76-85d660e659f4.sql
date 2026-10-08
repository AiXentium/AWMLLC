
CREATE TABLE public.ai_provider_configs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider text NOT NULL UNIQUE,
  display_name text NOT NULL,
  enabled boolean NOT NULL DEFAULT true,
  key_configured boolean NOT NULL DEFAULT false,
  secret_name text NOT NULL,
  status text NOT NULL DEFAULT 'not_configured',
  last_test_at timestamptz,
  last_success_at timestamptz,
  last_error text,
  monthly_limit_usd numeric,
  per_user_limit_usd numeric,
  per_project_limit_usd numeric,
  allowed_roles app_role[] NOT NULL DEFAULT ARRAY['owner_admin','estimator','reviewer']::app_role[],
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ai_provider_configs TO authenticated;
GRANT ALL ON public.ai_provider_configs TO service_role;
ALTER TABLE public.ai_provider_configs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admins manage ai providers" ON public.ai_provider_configs FOR ALL TO authenticated
  USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));
CREATE POLICY "members read ai providers" ON public.ai_provider_configs FOR SELECT TO authenticated USING (true);

CREATE TABLE public.ai_model_routes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_category text NOT NULL UNIQUE,
  label text NOT NULL,
  description text,
  provider text NOT NULL DEFAULT 'openai',
  model text NOT NULL,
  fallback_provider text,
  fallback_model text,
  max_output_tokens integer,
  requires_vision boolean NOT NULL DEFAULT false,
  enabled boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ai_model_routes TO authenticated;
GRANT ALL ON public.ai_model_routes TO service_role;
ALTER TABLE public.ai_model_routes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admins manage ai routes" ON public.ai_model_routes FOR ALL TO authenticated
  USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));
CREATE POLICY "members read ai routes" ON public.ai_model_routes FOR SELECT TO authenticated USING (true);

CREATE TABLE public.ai_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid REFERENCES public.ai_conversations(id) ON DELETE CASCADE,
  message_id uuid,
  project_id uuid REFERENCES public.projects(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  idempotency_key text UNIQUE,
  task_category text,
  agent_key text,
  status text NOT NULL DEFAULT 'queued',
  provider text,
  model text,
  used_fallback boolean NOT NULL DEFAULT false,
  attempt integer NOT NULL DEFAULT 1,
  error_category text,
  error_message text,
  started_at timestamptz,
  finished_at timestamptz,
  latency_ms integer,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ai_runs TO authenticated;
GRANT ALL ON public.ai_runs TO service_role;
ALTER TABLE public.ai_runs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own or admin ai runs" ON public.ai_runs FOR ALL TO authenticated
  USING (user_id = auth.uid() OR public.is_admin(auth.uid()))
  WITH CHECK (user_id = auth.uid() OR public.is_admin(auth.uid()));

CREATE TABLE public.ai_usage (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id uuid REFERENCES public.ai_runs(id) ON DELETE SET NULL,
  user_id uuid NOT NULL,
  project_id uuid REFERENCES public.projects(id) ON DELETE SET NULL,
  provider text NOT NULL,
  model text NOT NULL,
  task_category text,
  input_tokens integer NOT NULL DEFAULT 0,
  output_tokens integer NOT NULL DEFAULT 0,
  estimated_cost_usd numeric NOT NULL DEFAULT 0,
  latency_ms integer,
  succeeded boolean NOT NULL DEFAULT true,
  used_fallback boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.ai_usage TO authenticated;
GRANT ALL ON public.ai_usage TO service_role;
ALTER TABLE public.ai_usage ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own or admin ai usage read" ON public.ai_usage FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_admin(auth.uid()));
CREATE POLICY "insert own ai usage" ON public.ai_usage FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE TRIGGER trg_ai_provider_configs_updated BEFORE UPDATE ON public.ai_provider_configs
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_ai_model_routes_updated BEFORE UPDATE ON public.ai_model_routes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_ai_runs_updated BEFORE UPDATE ON public.ai_runs
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.ai_provider_configs (provider, display_name, secret_name, status, enabled)
VALUES
  ('openai', 'OpenAI', 'OPENAI_API_KEY', 'not_configured', true),
  ('anthropic', 'Anthropic Claude', 'ANTHROPIC_API_KEY', 'not_configured', true);

INSERT INTO public.ai_model_routes (task_category, label, description, provider, model, fallback_provider, fallback_model, requires_vision, sort_order) VALUES
 ('general_chat','General project chat','Everyday assistant conversation','openai','gpt-4o-mini','anthropic','claude-3-5-haiku-latest',false,10),
 ('construction_reasoning','Construction reasoning','Multi-step reasoning about assemblies and details','anthropic','claude-sonnet-4-5','openai','gpt-4o',false,20),
 ('document_summarization','Document summarization','Summarize plan sets and specifications','openai','gpt-4o-mini','anthropic','claude-3-5-haiku-latest',false,30),
 ('pdf_schedule_analysis','PDF text and schedule analysis','Parse schedule tables and sheet text','anthropic','claude-sonnet-4-5','openai','gpt-4o',false,40),
 ('window_door_classification','Window and door classification','Classify openings by type and operation','openai','gpt-4o','anthropic','claude-sonnet-4-5',true,50),
 ('takeoff_review','Takeoff review','Review counts and flag inconsistencies','anthropic','claude-sonnet-4-5','openai','gpt-4o',false,60),
 ('jurisdiction_research','Jurisdiction and code research','Assist with AHJ and code questions','anthropic','claude-sonnet-4-5','openai','gpt-4o',false,70),
 ('safety_review','Safety review assistance','Egress, WOCD, guard and glazing checks','anthropic','claude-sonnet-4-5','openai','gpt-4o',false,80),
 ('ykk_product_reasoning','YKK product reasoning','Map openings to catalog products','openai','gpt-4o','anthropic','claude-sonnet-4-5',false,90),
 ('report_rfi_writing','Report and RFI writing','Draft reports and RFIs','anthropic','claude-sonnet-4-5','openai','gpt-4o',false,100),
 ('tool_planning','Tool-use planning','Plan which tools to run','openai','gpt-4o-mini','anthropic','claude-3-5-haiku-latest',false,110),
 ('vision_analysis','Vision/image analysis','Analyze page images and crops','openai','gpt-4o','anthropic','claude-sonnet-4-5',true,120),
 ('fast_low_cost','Fast low-cost requests','Short, high-volume requests','openai','gpt-4o-mini','anthropic','claude-3-5-haiku-latest',false,130),
 ('complex_reasoning','Complex high-reasoning requests','Hardest analysis tasks','anthropic','claude-opus-4-1','openai','gpt-4o',false,140);
