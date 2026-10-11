-- Owen's Lawn + Landscape — job profitability, time tracking, expense job tags
-- Safe to run more than once. Only ADDS columns/tables; nothing is deleted.

-- Time + crew per job (and a live timer start)
alter table public.service_visits
  add column if not exists crew_size integer not null default 1,
  add column if not exists timer_started_at timestamptz;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'service_visits_crew_size_check') then
    alter table public.service_visits add constraint service_visits_crew_size_check check (crew_size between 1 and 20);
  end if;
end $$;

-- Where each customer came from
alter table public.customers add column if not exists source text not null default '';

-- Expenses that are general overhead rather than for a specific job
alter table public.expenses add column if not exists is_overhead boolean not null default false;

-- Job tags on expenses (one expense can carry several job tags, split by amount)
create table if not exists public.expense_allocations (
  id bigint generated always as identity primary key,
  expense_id bigint not null references public.expenses(id) on delete cascade,
  visit_id bigint not null references public.service_visits(id) on delete cascade,
  amount numeric not null check (amount >= 0),
  created_at timestamptz not null default now(),
  unique (expense_id, visit_id)
);
create index if not exists expense_allocations_visit_id_idx on public.expense_allocations(visit_id);
alter table public.expense_allocations enable row level security;
drop policy if exists "Authenticated users can manage expense allocations" on public.expense_allocations;
create policy "Authenticated users can manage expense allocations" on public.expense_allocations
  for all to authenticated using (true) with check (true);

-- Settings (labor rate, target $/hr, overhead toggle)
create table if not exists public.app_settings (
  key text primary key,
  value jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);
alter table public.app_settings enable row level security;
drop policy if exists "Authenticated users can manage app settings" on public.app_settings;
create policy "Authenticated users can manage app settings" on public.app_settings
  for all to authenticated using (true) with check (true);
insert into public.app_settings (key, value)
values ('job_costing', '{"laborRate": 20, "targetHourly": 60, "includeOverhead": true}'::jsonb)
on conflict (key) do nothing;

-- Pre-fill customer source
update public.customers c set source = case
    when l.source = 'referral' then 'Referral'
    when l.source = 'manual' then 'Manual entry'
    else 'Website' end
  from public.leads l
  where l.id = c.converted_from_lead_id and coalesce(c.source, '') = '';
update public.customers set source = 'Returning (2025)'
  where converted_from_lead_id is null and coalesce(source, '') = '';
