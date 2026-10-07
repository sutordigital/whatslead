create table if not exists public.ai_feedback (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  message_id uuid not null references public.messages(id) on delete cascade,
  feedback_type text not null default 'comment'
    check (feedback_type in ('positive','negative','comment')),
  comment text,
  created_by_user_id uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists ai_feedback_tenant_idx
  on public.ai_feedback(tenant_id);

create index if not exists ai_feedback_message_idx
  on public.ai_feedback(message_id);

alter table public.ai_feedback enable row level security;

drop policy if exists ai_feedback_member_all on public.ai_feedback;
create policy ai_feedback_member_all
on public.ai_feedback
for all
using (public.is_tenant_member(tenant_id))
with check (public.is_tenant_member(tenant_id));

grant select, insert, update, delete on public.ai_feedback to authenticated;

create table if not exists public.ai_guidance (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  source_feedback_id uuid references public.ai_feedback(id) on delete set null,
  guidance text not null,
  category text not null default 'general',
  is_active boolean not null default true,
  priority integer not null default 100,
  created_by_user_id uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists ai_guidance_tenant_active_idx
  on public.ai_guidance(tenant_id, is_active, priority);

alter table public.ai_guidance enable row level security;

drop policy if exists ai_guidance_member_all on public.ai_guidance;
create policy ai_guidance_member_all
on public.ai_guidance
for all
using (public.is_tenant_member(tenant_id))
with check (public.is_tenant_member(tenant_id));

grant select, insert, update, delete on public.ai_guidance to authenticated;

do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname='supabase_realtime'
      and schemaname='public'
      and tablename='ai_feedback'
  ) then
    alter publication supabase_realtime add table public.ai_feedback;
  end if;

  if not exists (
    select 1
    from pg_publication_tables
    where pubname='supabase_realtime'
      and schemaname='public'
      and tablename='ai_guidance'
  ) then
    alter publication supabase_realtime add table public.ai_guidance;
  end if;
end $$;
