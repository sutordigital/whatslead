-- WhatsLead Portal MVP: tenant membership, AI settings, and tenant-safe RLS.

create table if not exists public.tenant_members (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'member'
    check (role in ('owner', 'admin', 'member')),
  created_at timestamptz not null default now(),
  unique (tenant_id, user_id)
);

create index if not exists tenant_members_user_idx
  on public.tenant_members (user_id);

create index if not exists tenant_members_tenant_idx
  on public.tenant_members (tenant_id);

alter table public.tenant_members enable row level security;

create table if not exists public.tenant_ai_settings (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null unique references public.tenants(id) on delete cascade,
  business_name text,
  business_description text,
  services text[] not null default '{}',
  tone_of_voice text,
  preferred_language text,
  qualification_questions text[] not null default '{}',
  faqs jsonb not null default '[]'::jsonb,
  custom_instructions text,
  handoff_rules text,
  ai_enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.tenant_ai_settings enable row level security;

create or replace function public.is_tenant_member(target_tenant_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.tenant_members tm
    where tm.tenant_id = target_tenant_id
      and tm.user_id = auth.uid()
  );
$$;

revoke all on function public.is_tenant_member(uuid) from public;
grant execute on function public.is_tenant_member(uuid) to authenticated;

drop policy if exists tenant_members_read_self on public.tenant_members;
create policy tenant_members_read_self
on public.tenant_members
for select
to authenticated
using (user_id = auth.uid());

drop policy if exists tenants_member_read on public.tenants;
create policy tenants_member_read
on public.tenants
for select
to authenticated
using (public.is_tenant_member(id));

drop policy if exists contacts_member_all on public.contacts;
create policy contacts_member_all
on public.contacts
for all
to authenticated
using (public.is_tenant_member(tenant_id))
with check (public.is_tenant_member(tenant_id));

drop policy if exists conversations_member_all on public.conversations;
create policy conversations_member_all
on public.conversations
for all
to authenticated
using (public.is_tenant_member(tenant_id))
with check (public.is_tenant_member(tenant_id));

drop policy if exists messages_member_all on public.messages;
create policy messages_member_all
on public.messages
for all
to authenticated
using (public.is_tenant_member(tenant_id))
with check (public.is_tenant_member(tenant_id));

drop policy if exists handoffs_member_all on public.handoffs;
create policy handoffs_member_all
on public.handoffs
for all
to authenticated
using (public.is_tenant_member(tenant_id))
with check (public.is_tenant_member(tenant_id));

drop policy if exists whatsapp_accounts_member_read on public.whatsapp_accounts;
create policy whatsapp_accounts_member_read
on public.whatsapp_accounts
for select
to authenticated
using (public.is_tenant_member(tenant_id));

drop policy if exists tenant_ai_settings_member_all on public.tenant_ai_settings;
create policy tenant_ai_settings_member_all
on public.tenant_ai_settings
for all
to authenticated
using (public.is_tenant_member(tenant_id))
with check (public.is_tenant_member(tenant_id));
