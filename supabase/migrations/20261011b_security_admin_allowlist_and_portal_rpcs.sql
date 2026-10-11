-- Applied 2026-10-11. Admin allowlist + token-checked customer portal lookups.
create table if not exists public.admin_users (
  user_id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  created_at timestamptz not null default now()
);
alter table public.admin_users enable row level security;
revoke all on public.admin_users from anon, authenticated;
insert into public.admin_users (user_id, email)
select id, email from auth.users
where lower(email) in ('owenlawnandlandscape09@gmail.com', 'ascheidler1@gmail.com')
on conflict (user_id) do nothing;

create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.admin_users where user_id = auth.uid());
$$;
revoke all on function public.is_admin() from public, anon;
grant execute on function public.is_admin() to authenticated;

create or replace function public.portal_customer(p_token text)
returns json language sql stable security definer set search_path = public as $$
  select json_build_object(
    'id', c.id, 'name', c.name, 'email', c.email, 'phone', c.phone, 'address', c.address,
    'service', c.service, 'price', c.price, 'frequency', c.frequency, 'status', c.status,
    'balance', c.balance, 'referral_code', c.referral_code, 'route_day', c.route_day, 'token', c.token)
  from public.customers c
  where length(coalesce(p_token, '')) >= 6 and c.token = p_token
  limit 1;
$$;

create or replace function public.portal_invoices(p_token text)
returns setof public.invoices language sql stable security definer set search_path = public as $$
  select i.* from public.invoices i
  join public.customers c on c.id = i.customer_id
  where length(coalesce(p_token, '')) >= 6 and c.token = p_token
  order by i.date_issued desc;
$$;

create or replace function public.portal_contact_exists(p_contact text)
returns boolean language sql stable security definer set search_path = public as $$
  select case
    when position('@' in coalesce(p_contact, '')) > 0
      then exists (select 1 from public.customers where lower(email) = lower(trim(p_contact)))
    when length(regexp_replace(coalesce(p_contact, ''), '\D', '', 'g')) >= 10
      then exists (select 1 from public.customers
                   where right(regexp_replace(phone, '\D', '', 'g'), 10) = right(regexp_replace(p_contact, '\D', '', 'g'), 10))
    else false end;
$$;

revoke all on function public.portal_customer(text), public.portal_invoices(text), public.portal_contact_exists(text) from public;
grant execute on function public.portal_customer(text), public.portal_invoices(text), public.portal_contact_exists(text) to anon, authenticated;
