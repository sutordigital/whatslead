
create or replace function public.provision_current_user_tenant(company_name text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid := auth.uid();
  existing_tenant_id uuid;
  new_tenant_id uuid;
  clean_name text;
  new_slug text;
begin
  if current_user_id is null then
    raise exception 'Authentication required';
  end if;

  select tm.tenant_id
    into existing_tenant_id
  from public.tenant_members tm
  where tm.user_id = current_user_id
  order by tm.created_at asc
  limit 1;

  if existing_tenant_id is not null then
    return existing_tenant_id;
  end if;

  clean_name := nullif(btrim(company_name), '');
  if clean_name is null then
    raise exception 'Company name is required';
  end if;

  new_slug :=
    trim(both '-' from regexp_replace(lower(clean_name), '[^a-z0-9]+', '-', 'g'))
    || '-' || left(replace(gen_random_uuid()::text, '-', ''), 8);

  insert into public.tenants (name, slug, status, timezone)
  values (clean_name, new_slug, 'active', 'Asia/Hong_Kong')
  returning id into new_tenant_id;

  insert into public.tenant_members (tenant_id, user_id, role)
  values (new_tenant_id, current_user_id, 'owner');

  insert into public.tenant_ai_settings (
    tenant_id,
    business_name,
    ai_enabled
  )
  values (
    new_tenant_id,
    clean_name,
    true
  )
  on conflict (tenant_id) do nothing;

  insert into public.tenant_booking_settings (tenant_id)
  values (new_tenant_id)
  on conflict (tenant_id) do nothing;

  return new_tenant_id;
end;
$$;

revoke all on function public.provision_current_user_tenant(text) from public;
revoke all on function public.provision_current_user_tenant(text) from anon;
grant execute on function public.provision_current_user_tenant(text) to authenticated;
