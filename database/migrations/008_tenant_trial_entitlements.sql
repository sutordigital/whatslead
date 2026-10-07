alter table public.tenants
  add column if not exists trial_started_at timestamptz,
  add column if not exists trial_ends_at timestamptz,
  add column if not exists subscription_status text not null default 'not_started',
  add column if not exists plan text,
  add column if not exists billing_interval text,
  add column if not exists subscription_ends_at timestamptz,
  add column if not exists stripe_customer_id text,
  add column if not exists stripe_subscription_id text;

alter table public.tenants
  drop constraint if exists tenants_subscription_status_check;

alter table public.tenants
  add constraint tenants_subscription_status_check
  check (subscription_status = any (array[
    'not_started'::text,
    'trialing'::text,
    'active'::text,
    'past_due'::text,
    'expired'::text,
    'cancelled'::text
  ]));

alter table public.tenants
  drop constraint if exists tenants_billing_interval_check;

alter table public.tenants
  add constraint tenants_billing_interval_check
  check (billing_interval is null or billing_interval = any (array[
    'monthly'::text,
    'yearly'::text
  ]));

create or replace function public.start_tenant_trial_on_whatsapp_account()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status = 'active' then
    update public.tenants
    set trial_started_at = coalesce(trial_started_at, now()),
        trial_ends_at = coalesce(trial_ends_at, now() + interval '30 days'),
        subscription_status = case
          when subscription_status = 'not_started' then 'trialing'
          else subscription_status
        end,
        updated_at = now()
    where id = new.tenant_id;
  end if;

  return new;
end;
$$;

revoke all on function public.start_tenant_trial_on_whatsapp_account() from public;
revoke all on function public.start_tenant_trial_on_whatsapp_account() from anon;
revoke all on function public.start_tenant_trial_on_whatsapp_account() from authenticated;

drop trigger if exists whatsapp_account_starts_trial on public.whatsapp_accounts;

create trigger whatsapp_account_starts_trial
after insert or update of status on public.whatsapp_accounts
for each row
execute function public.start_tenant_trial_on_whatsapp_account();

update public.tenants t
set trial_started_at = coalesce(t.trial_started_at, wa.first_active_at),
    trial_ends_at = coalesce(t.trial_ends_at, wa.first_active_at + interval '30 days'),
    subscription_status = case
      when t.subscription_status = 'not_started' then 'trialing'
      else t.subscription_status
    end,
    updated_at = now()
from (
  select tenant_id, min(created_at) as first_active_at
  from public.whatsapp_accounts
  where status = 'active'
  group by tenant_id
) wa
where t.id = wa.tenant_id
  and t.trial_started_at is null;
