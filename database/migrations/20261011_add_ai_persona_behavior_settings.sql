create table if not exists public.tenant_ai_persona_settings (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null unique references public.tenants(id) on delete cascade,
  assistant_name text not null default 'Mia',
  identity_style text not null default 'transparent_ai'
    check (identity_style in ('transparent_ai','online_assistant','professional_ai')),
  personality_style text not null default 'hk_natural'
    check (personality_style in ('professional','friendly','hk_natural')),
  language_mode text not null default 'auto'
    check (language_mode in ('auto','traditional_zh','english','bilingual','mandarin')),
  emoji_level text not null default 'light'
    check (emoji_level in ('none','light','friendly')),
  message_length text not null default 'balanced'
    check (message_length in ('short','balanced','detailed')),
  response_pacing text not null default 'natural'
    check (response_pacing in ('instant','natural','thoughtful')),
  message_chunking boolean not null default true,
  acknowledge_before_action boolean not null default true,
  ask_one_question_at_a_time boolean not null default true,
  avoid_repetitive_greetings boolean not null default true,
  remember_known_details boolean not null default true,
  explain_uncertainty boolean not null default true,
  tone_mirroring text not null default 'low'
    check (tone_mirroring in ('off','low','medium')),
  after_hours_style text not null default 'acknowledge_after_hours'
    check (after_hours_style in ('same_as_daytime','acknowledge_after_hours')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.tenant_ai_persona_settings enable row level security;

create policy "tenant members can read persona settings"
on public.tenant_ai_persona_settings
for select to authenticated
using (
  exists (
    select 1 from public.tenant_members tm
    where tm.tenant_id = tenant_ai_persona_settings.tenant_id
      and tm.user_id = (select auth.uid())
  )
);

create policy "tenant admins can insert persona settings"
on public.tenant_ai_persona_settings
for insert to authenticated
with check (
  exists (
    select 1 from public.tenant_members tm
    where tm.tenant_id = tenant_ai_persona_settings.tenant_id
      and tm.user_id = (select auth.uid())
      and tm.role in ('owner','admin')
  )
);

create policy "tenant admins can update persona settings"
on public.tenant_ai_persona_settings
for update to authenticated
using (
  exists (
    select 1 from public.tenant_members tm
    where tm.tenant_id = tenant_ai_persona_settings.tenant_id
      and tm.user_id = (select auth.uid())
      and tm.role in ('owner','admin')
  )
)
with check (
  exists (
    select 1 from public.tenant_members tm
    where tm.tenant_id = tenant_ai_persona_settings.tenant_id
      and tm.user_id = (select auth.uid())
      and tm.role in ('owner','admin')
  )
);

create or replace function public.touch_tenant_ai_persona_settings_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger trg_tenant_ai_persona_settings_updated_at
before update on public.tenant_ai_persona_settings
for each row execute function public.touch_tenant_ai_persona_settings_updated_at();

insert into public.tenant_ai_persona_settings (tenant_id)
select id from public.tenants
on conflict (tenant_id) do nothing;
