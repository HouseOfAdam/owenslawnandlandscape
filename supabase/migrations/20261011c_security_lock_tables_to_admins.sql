-- Owen's Lawn + Landscape — lock business data to admins only
-- Run in Supabase SQL Editor. Requires 20261011b (admin_users + is_admin) which is already applied.

do $$
declare r record;
begin
  for r in select tablename, policyname from pg_policies
           where schemaname = 'public'
             and tablename in ('customers','leads','lead_notes','estimates','expenses','invoices','service_visits','expense_allocations','app_settings')
  loop
    execute format('drop policy %I on public.%I', r.policyname, r.tablename);
  end loop;
end $$;

-- Admin-only full access
do $$
declare t text;
begin
  foreach t in array array['customers','leads','lead_notes','estimates','expenses','invoices','service_visits','expense_allocations','app_settings'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('create policy "Admins manage %s" on public.%I for all to authenticated using (public.is_admin()) with check (public.is_admin())', t, t);
  end loop;
end $$;

-- The public estimate / sign-up forms may only add brand-new leads
create policy "Public can submit new leads" on public.leads
  for insert to anon, authenticated
  with check (status = 'new' and converted_customer_id is null);

-- Trigger/helper functions should not be callable through the public API
revoke execute on function public.notify_new_lead() from public, anon, authenticated;
revoke execute on function public.handle_new_user() from public, anon, authenticated;
revoke execute on function public.rls_auto_enable() from public, anon, authenticated;
revoke execute on function public.is_household_member(uuid) from public, anon;
grant execute on function public.is_household_member(uuid) to authenticated;

-- Pin search_path on flagged functions
alter function public.notify_new_lead() set search_path = public;
alter function public.update_updated_at() set search_path = public;
alter function public.update_service_visits_updated_at() set search_path = public;
alter function public.update_invoices_updated_at() set search_path = public;
alter function public.touch_budget_state() set search_path = public;
