-- Online proposals: magic links customers use to review, pick optional items, and approve.
-- Replaces the customer portal.

-- 1. Estimate columns for links + customer responses
alter table public.estimates
  add column if not exists public_token text,
  add column if not exists snapshot jsonb,
  add column if not exists sent_at timestamptz,
  add column if not exists viewed_at timestamptz,
  add column if not exists view_count integer not null default 0,
  add column if not exists selection jsonb not null default '[]'::jsonb,
  add column if not exists approved_at timestamptz,
  add column if not exists approved_name text,
  add column if not exists approval_total numeric,
  add column if not exists approval_recurring numeric,
  add column if not exists customer_note text,
  add column if not exists responded_online boolean not null default false;
create unique index if not exists estimates_public_token_key on public.estimates(public_token) where public_token is not null;

-- 2. "accepted" becomes "approved"
alter table public.estimates drop constraint if exists estimates_status_check;
update public.estimates set status = 'approved' where status = 'accepted';
alter table public.estimates add constraint estimates_status_check check (status in ('draft','sent','approved','declined'));

-- 3. Public read: only the customer-facing snapshot, only with the exact token
create or replace function public.proposal_get(p_token text, p_preview boolean default false)
returns json language plpgsql security definer set search_path = public as $$
declare e public.estimates;
begin
  if length(coalesce(p_token, '')) < 32 then return null; end if;
  select * into e from public.estimates where public_token = p_token;
  if not found or e.snapshot is null then return null; end if;
  if not coalesce(p_preview, false) then
    update public.estimates set viewed_at = coalesce(viewed_at, now()), view_count = view_count + 1 where id = e.id;
  end if;
  return json_build_object(
    'number', 'EST-' || lpad(e.id::text, 4, '0'),
    'status', e.status,
    'snapshot', e.snapshot,
    'selection', e.selection,
    'issued_at', coalesce(e.sent_at, e.created_at),
    'approved_at', e.approved_at,
    'approved_name', e.approved_name,
    'approval_total', e.approval_total,
    'customer_note', e.customer_note
  );
end $$;

-- 4. Public respond: approve (with chosen optional items) or decline / request changes
create or replace function public.proposal_respond(p_token text, p_action text, p_selected text[], p_name text, p_note text)
returns json language plpgsql security definer set search_path = public as $$
declare
  e public.estimates;
  v_valid int;
  v_keys text[];
  v_once numeric;
  v_rec numeric;
  v_names text;
begin
  if p_action not in ('approve', 'decline') then return json_build_object('ok', false, 'error', 'invalid_action'); end if;
  if length(coalesce(p_token, '')) < 32 then return json_build_object('ok', false, 'error', 'not_found'); end if;
  select * into e from public.estimates where public_token = p_token for update;
  if not found or e.snapshot is null then return json_build_object('ok', false, 'error', 'not_found'); end if;
  if e.status in ('approved', 'declined') then return json_build_object('ok', false, 'error', 'already_' || e.status); end if;

  v_valid := coalesce(nullif(e.snapshot->>'validDays', '')::int, 90);
  if now() > coalesce(e.sent_at, e.created_at) + make_interval(days => v_valid) then
    return json_build_object('ok', false, 'error', 'expired');
  end if;
  if p_action = 'approve' and length(trim(coalesce(p_name, ''))) < 2 then
    return json_build_object('ok', false, 'error', 'name_required');
  end if;

  -- keep only keys that really are optional lines on this proposal
  select coalesce(array_agg(l->>'key'), '{}') into v_keys
  from jsonb_array_elements(e.snapshot->'lines') l
  where coalesce((l->>'optional')::boolean, false) and (l->>'key') = any(coalesce(p_selected, '{}'));

  -- totals are computed here, never trusted from the browser
  select
    coalesce(sum((l->>'price')::numeric) filter (where coalesce(l->>'frequency', 'once') = 'once'), 0),
    coalesce(sum((l->>'price')::numeric) filter (where coalesce(l->>'frequency', 'once') <> 'once'), 0)
  into v_once, v_rec
  from jsonb_array_elements(e.snapshot->'lines') l
  where not coalesce((l->>'optional')::boolean, false) or (l->>'key') = any(v_keys);

  select string_agg(l->>'description', ', ') into v_names
  from jsonb_array_elements(e.snapshot->'lines') l where (l->>'key') = any(v_keys);

  update public.estimates set
    status = case when p_action = 'approve' then 'approved' else 'declined' end,
    decided_at = now(),
    approved_at = case when p_action = 'approve' then now() else null end,
    approved_name = left(nullif(trim(coalesce(p_name, '')), ''), 120),
    selection = to_jsonb(v_keys),
    approval_total = case when p_action = 'approve' then v_once else null end,
    approval_recurring = case when p_action = 'approve' then v_rec else null end,
    customer_note = left(nullif(trim(coalesce(p_note, '')), ''), 2000),
    responded_online = true,
    updated_at = now()
  where id = e.id;

  if e.lead_id is not null then
    insert into public.lead_notes (lead_id, content, note_type) values (
      e.lead_id,
      case when p_action = 'approve'
        then format('Estimate EST-%s approved online by %s: $%s%s%s', lpad(e.id::text, 4, '0'), trim(p_name), to_char(v_once, 'FM999,999,990.00'),
                    case when v_rec > 0 then format(' + $%s/visit', to_char(v_rec, 'FM999,990.00')) else '' end,
                    case when v_names is not null then format(' (optional: %s)', v_names) else '' end)
        else format('Estimate EST-%s: customer requested changes / declined online. %s', lpad(e.id::text, 4, '0'), coalesce(p_note, ''))
      end,
      'estimate');
  end if;

  return json_build_object('ok', true, 'status', case when p_action = 'approve' then 'approved' else 'declined' end);
end $$;

revoke all on function public.proposal_get(text, boolean), public.proposal_respond(text, text, text[], text, text) from public;
grant execute on function public.proposal_get(text, boolean), public.proposal_respond(text, text, text[], text, text) to anon, authenticated;

-- 5. Notify Owen (email + text) when a customer responds online
create or replace function public.notify_estimate_response()
returns trigger language plpgsql security definer set search_path = public as $$
declare edge_url text; svc_key text; v_names text;
begin
  if not new.responded_online or new.status not in ('approved', 'declined') or old.status is not distinct from new.status then
    return new;
  end if;
  select decrypted_secret into edge_url from vault.decrypted_secrets where name = 'edge_function_url' limit 1;
  select decrypted_secret into svc_key from vault.decrypted_secrets where name = 'service_role_key' limit 1;
  select string_agg(l->>'description', ', ') into v_names
    from jsonb_array_elements(coalesce(new.snapshot->'lines', '[]'::jsonb)) l
    where (l->>'key') in (select jsonb_array_elements_text(new.selection));
  if edge_url is not null and svc_key is not null then
    perform net.http_post(
      url := edge_url || '/notify-estimate-response',
      headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer ' || svc_key),
      body := jsonb_build_object(
        'id', new.id,
        'number', 'EST-' || lpad(new.id::text, 4, '0'),
        'status', new.status,
        'customer_name', new.customer_name,
        'project_title', new.snapshot->>'projectTitle',
        'approved_name', new.approved_name,
        'approval_total', new.approval_total,
        'approval_recurring', new.approval_recurring,
        'optional_selected', v_names,
        'customer_note', new.customer_note
      )
    );
  end if;
  return new;
exception when others then
  raise warning 'notify_estimate_response failed: %', sqlerrm;
  return new;
end $$;
revoke execute on function public.notify_estimate_response() from public, anon, authenticated;
drop trigger if exists estimates_notify_response on public.estimates;
create trigger estimates_notify_response after update of status on public.estimates
  for each row execute function public.notify_estimate_response();

-- 6. Customer portal is retired: remove its public lookups
drop function if exists public.portal_customer(text);
drop function if exists public.portal_invoices(text);
drop function if exists public.portal_contact_exists(text);
