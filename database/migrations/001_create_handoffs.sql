create table if not exists public.handoffs (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  contact_id uuid not null references public.contacts(id) on delete cascade,
  source_meta_message_id text not null unique,
  reason text not null,
  lead_status text not null check (lead_status in ('early', 'potential', 'high_potential')),
  summary text not null,
  status text not null default 'pending'
    check (status in ('pending', 'contacted', 'resolved', 'cancelled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists handoffs_tenant_status_idx
  on public.handoffs (tenant_id, status, created_at desc);

create index if not exists handoffs_conversation_idx
  on public.handoffs (conversation_id, created_at desc);

alter table public.handoffs enable row level security;
