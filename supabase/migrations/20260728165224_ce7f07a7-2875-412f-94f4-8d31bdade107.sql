ALTER TABLE public.intake_files ADD COLUMN IF NOT EXISTS archived_at timestamptz;
ALTER TABLE public.quote_request_documents ADD COLUMN IF NOT EXISTS archived_at timestamptz;
CREATE INDEX IF NOT EXISTS intake_files_archived_idx ON public.intake_files (archived_at);
CREATE INDEX IF NOT EXISTS quote_request_documents_archived_idx ON public.quote_request_documents (archived_at);