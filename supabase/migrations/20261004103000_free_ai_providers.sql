-- Adds free-tier AI providers (OpenRouter, Gemini, Groq) to ai_provider_configs.
-- Rotation order is free-first; paid providers (OpenAI, Anthropic) stay as fallbacks.

insert into public.ai_provider_configs (provider, display_name, enabled, secret_name, status, key_configured)
select v.provider, v.display_name, true, v.secret_name, 'not_configured', false
from (values
  ('openrouter', 'OpenRouter — free models (:free)', 'OPENROUTER_API_KEY'),
  ('gemini', 'Google Gemini — free tier', 'GEMINI_API_KEY'),
  ('groq', 'Groq — free tier', 'GROQ_API_KEY')
) as v(provider, display_name, secret_name)
where not exists (
  select 1 from public.ai_provider_configs c where c.provider = v.provider
);
