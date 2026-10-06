create table if not exists public.bookings (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  conversation_id uuid references public.conversations(id) on delete set null,
  contact_id uuid not null references public.contacts(id) on delete cascade,
  booking_type text not null default 'consultation',
  scheduled_at timestamptz not null,
  duration_minutes integer not null default 30
    check (duration_minutes > 0 and duration_minutes <= 480),
  timezone text not null default 'Asia/Hong_Kong',
  status text not null default 'pending'
    check (status in ('pending', 'confirmed', 'completed', 'cancelled', 'no_show')),
  notes text,
  source text not null default 'crm'
    check (source in ('crm', 'ai', 'api', 'import')),
  created_by_user_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists bookings_tenant_scheduled_idx
  on public.bookings (tenant_id, scheduled_at desc);

create index if not exists bookings_tenant_status_idx
  on public.bookings (tenant_id, status, scheduled_at desc);

create index if not exists bookings_conversation_idx
  on public.bookings (conversation_id, scheduled_at desc);

create index if not exists bookings_contact_idx
  on public.bookings (contact_id, scheduled_at desc);

alter table public.bookings enable row level security;

drop policy if exists "tenant members can read bookings" on public.bookings;
create policy "tenant members can read bookings"
  on public.bookings
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.tenant_members tm
      where tm.tenant_id = bookings.tenant_id
        and tm.user_id = auth.uid()
    )
  );

drop policy if exists "tenant members can insert bookings" on public.bookings;
create policy "tenant members can insert bookings"
  on public.bookings
  for insert
  to authenticated
  with check (
    exists (
      select 1
      from public.tenant_members tm
      where tm.tenant_id = bookings.tenant_id
        and tm.user_id = auth.uid()
    )
  );

drop policy if exists "tenant members can update bookings" on public.bookings;
create policy "tenant members can update bookings"
  on public.bookings
  for update
  to authenticated
  using (
    exists (
      select 1
      from public.tenant_members tm
      where tm.tenant_id = bookings.tenant_id
        and tm.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1
      from public.tenant_members tm
      where tm.tenant_id = bookings.tenant_id
        and tm.user_id = auth.uid()
    )
  );
