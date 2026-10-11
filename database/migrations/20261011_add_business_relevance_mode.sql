alter table public.tenant_ai_persona_settings
add column if not exists business_relevance_mode text not null default 'strict'
check (business_relevance_mode in ('strict','balanced','open'));