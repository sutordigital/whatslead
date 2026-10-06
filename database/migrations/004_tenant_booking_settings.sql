create table if not exists public.tenant_booking_settings (
  tenant_id uuid primary key references public.tenants(id) on delete cascade,
  timezone text not null default 'Asia/Hong_Kong',
  default_duration_minutes integer not null default 30 check (default_duration_minutes between 15 and 480),
  min_notice_minutes integer not null default 120 check (min_notice_minutes >= 0),
  buffer_minutes integer not null default 0 check (buffer_minutes between 0 and 240),
  monday_enabled boolean not null default true,
  tuesday_enabled boolean not null default true,
  wednesday_enabled boolean not null default true,
  thursday_enabled boolean not null default true,
  friday_enabled boolean not null default true,
  saturday_enabled boolean not null default false,
  sunday_enabled boolean not null default false,
  day_start time not null default '10:00',
  day_end time not null default '18:00',
  updated_at timestamptz not null default now()
);

alter table public.tenant_booking_settings enable row level security;
grant select, insert, update on table public.tenant_booking_settings to authenticated;

drop policy if exists "tenant members can read booking settings" on public.tenant_booking_settings;
create policy "tenant members can read booking settings"
  on public.tenant_booking_settings
  for select
  to authenticated
  using (
    exists (
      select 1 from public.tenant_members tm
      where tm.tenant_id = tenant_booking_settings.tenant_id
        and tm.user_id = auth.uid()
    )
  );

drop policy if exists "tenant members can insert booking settings" on public.tenant_booking_settings;
create policy "tenant members can insert booking settings"
  on public.tenant_booking_settings
  for insert
  to authenticated
  with check (
    exists (
      select 1 from public.tenant_members tm
      where tm.tenant_id = tenant_booking_settings.tenant_id
        and tm.user_id = auth.uid()
    )
  );

drop policy if exists "tenant members can update booking settings" on public.tenant_booking_settings;
create policy "tenant members can update booking settings"
  on public.tenant_booking_settings
  for update
  to authenticated
  using (
    exists (
      select 1 from public.tenant_members tm
      where tm.tenant_id = tenant_booking_settings.tenant_id
        and tm.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.tenant_members tm
      where tm.tenant_id = tenant_booking_settings.tenant_id
        and tm.user_id = auth.uid()
    )
  );
