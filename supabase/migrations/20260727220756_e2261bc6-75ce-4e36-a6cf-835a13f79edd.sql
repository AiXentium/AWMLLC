-- Extend existing AI tables
ALTER TABLE public.ai_conversations
  ADD COLUMN IF NOT EXISTS archived boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS pinned boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz,
  ADD COLUMN IF NOT EXISTS last_message_at timestamptz NOT NULL DEFAULT now();

ALTER TABLE public.ai_messages
  ADD COLUMN IF NOT EXISTS agent_key text,
  ADD COLUMN IF NOT EXISTS mode text NOT NULL DEFAULT 'demo';

ALTER TABLE public.ai_memory
  ADD COLUMN IF NOT EXISTS title text,
  ADD COLUMN IF NOT EXISTS disabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS approved_by uuid,
  ADD COLUMN IF NOT EXISTS approved_at timestamptz,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

CREATE INDEX IF NOT EXISTS ai_conversations_user_idx ON public.ai_conversations(user_id, last_message_at DESC);
CREATE INDEX IF NOT EXISTS ai_conversations_project_idx ON public.ai_conversations(project_id);
CREATE INDEX IF NOT EXISTS ai_messages_conversation_idx ON public.ai_messages(conversation_id, created_at);

-- Helper: can the current user see a conversation
CREATE OR REPLACE FUNCTION public.can_access_conversation(_conversation_id uuid, _user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  select exists (
    select 1 from public.ai_conversations c
    where c.id = _conversation_id
      and (c.user_id = _user_id
           or (c.project_id is not null and public.can_view_project(c.project_id, _user_id)))
  );
$$;

-- ai_message_sources
CREATE TABLE IF NOT EXISTS public.ai_message_sources (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id uuid NOT NULL REFERENCES public.ai_messages(id) ON DELETE CASCADE,
  source_type text NOT NULL,
  entity_id uuid,
  label text NOT NULL,
  detail jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ai_message_sources TO authenticated;
GRANT ALL ON public.ai_message_sources TO service_role;
ALTER TABLE public.ai_message_sources ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ai_message_sources access" ON public.ai_message_sources FOR ALL TO authenticated
  USING (exists (select 1 from public.ai_messages m where m.id = message_id and public.can_access_conversation(m.conversation_id, auth.uid())))
  WITH CHECK (exists (select 1 from public.ai_messages m where m.id = message_id and public.can_access_conversation(m.conversation_id, auth.uid())));
CREATE INDEX IF NOT EXISTS ai_message_sources_message_idx ON public.ai_message_sources(message_id);

-- ai_tool_runs
CREATE TABLE IF NOT EXISTS public.ai_tool_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid REFERENCES public.ai_conversations(id) ON DELETE CASCADE,
  message_id uuid REFERENCES public.ai_messages(id) ON DELETE SET NULL,
  project_id uuid REFERENCES public.projects(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  tool_name text NOT NULL,
  agent_key text,
  input jsonb NOT NULL DEFAULT '{}'::jsonb,
  output jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'completed',
  requires_approval boolean NOT NULL DEFAULT false,
  error_message text,
  duration_ms integer,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ai_tool_runs TO authenticated;
GRANT ALL ON public.ai_tool_runs TO service_role;
ALTER TABLE public.ai_tool_runs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ai_tool_runs owner access" ON public.ai_tool_runs FOR ALL TO authenticated
  USING (user_id = auth.uid() or (project_id is not null and public.can_view_project(project_id, auth.uid())))
  WITH CHECK (user_id = auth.uid());
CREATE INDEX IF NOT EXISTS ai_tool_runs_conversation_idx ON public.ai_tool_runs(conversation_id, created_at);

-- ai_action_approvals
CREATE TABLE IF NOT EXISTS public.ai_action_approvals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid REFERENCES public.ai_conversations(id) ON DELETE CASCADE,
  message_id uuid REFERENCES public.ai_messages(id) ON DELETE SET NULL,
  project_id uuid REFERENCES public.projects(id) ON DELETE CASCADE,
  requested_by uuid NOT NULL,
  action_type text NOT NULL,
  summary text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  preview jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'pending',
  decided_by uuid,
  decided_at timestamptz,
  result jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ai_action_approvals TO authenticated;
GRANT ALL ON public.ai_action_approvals TO service_role;
ALTER TABLE public.ai_action_approvals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ai_action_approvals access" ON public.ai_action_approvals FOR ALL TO authenticated
  USING (requested_by = auth.uid() or (project_id is not null and public.can_view_project(project_id, auth.uid())))
  WITH CHECK (requested_by = auth.uid());
CREATE INDEX IF NOT EXISTS ai_action_approvals_conversation_idx ON public.ai_action_approvals(conversation_id, created_at);
CREATE TRIGGER ai_action_approvals_updated_at BEFORE UPDATE ON public.ai_action_approvals
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ai_feedback
CREATE TABLE IF NOT EXISTS public.ai_feedback (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id uuid NOT NULL REFERENCES public.ai_messages(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  rating text NOT NULL,
  comment text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (message_id, user_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ai_feedback TO authenticated;
GRANT ALL ON public.ai_feedback TO service_role;
ALTER TABLE public.ai_feedback ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ai_feedback own" ON public.ai_feedback FOR ALL TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- ai_agent_routing
CREATE TABLE IF NOT EXISTS public.ai_agent_routing (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id uuid NOT NULL REFERENCES public.ai_messages(id) ON DELETE CASCADE,
  agent_key text NOT NULL,
  agent_label text NOT NULL,
  reason text,
  score numeric,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ai_agent_routing TO authenticated;
GRANT ALL ON public.ai_agent_routing TO service_role;
ALTER TABLE public.ai_agent_routing ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ai_agent_routing access" ON public.ai_agent_routing FOR ALL TO authenticated
  USING (exists (select 1 from public.ai_messages m where m.id = message_id and public.can_access_conversation(m.conversation_id, auth.uid())))
  WITH CHECK (exists (select 1 from public.ai_messages m where m.id = message_id and public.can_access_conversation(m.conversation_id, auth.uid())));

-- ai_generated_drafts
CREATE TABLE IF NOT EXISTS public.ai_generated_drafts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid REFERENCES public.projects(id) ON DELETE CASCADE,
  conversation_id uuid REFERENCES public.ai_conversations(id) ON DELETE SET NULL,
  draft_type text NOT NULL,
  title text NOT NULL,
  body text NOT NULL,
  status text NOT NULL DEFAULT 'draft',
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by uuid NOT NULL,
  deleted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ai_generated_drafts TO authenticated;
GRANT ALL ON public.ai_generated_drafts TO service_role;
ALTER TABLE public.ai_generated_drafts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ai_generated_drafts view" ON public.ai_generated_drafts FOR SELECT TO authenticated
  USING (created_by = auth.uid() or (project_id is not null and public.can_view_project(project_id, auth.uid())));
CREATE POLICY "ai_generated_drafts write" ON public.ai_generated_drafts FOR INSERT TO authenticated
  WITH CHECK (created_by = auth.uid());
CREATE POLICY "ai_generated_drafts update" ON public.ai_generated_drafts FOR UPDATE TO authenticated
  USING (created_by = auth.uid() or (project_id is not null and public.can_edit_project(project_id, auth.uid())));
CREATE POLICY "ai_generated_drafts delete" ON public.ai_generated_drafts FOR DELETE TO authenticated
  USING (created_by = auth.uid());
CREATE TRIGGER ai_generated_drafts_updated_at BEFORE UPDATE ON public.ai_generated_drafts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();