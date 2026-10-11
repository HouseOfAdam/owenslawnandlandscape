-- Online proposals, step 2: "accepted" becomes "approved", and the retired
-- customer portal's public lookups are removed. Safe to run more than once.
alter table public.estimates drop constraint if exists estimates_status_check;
update public.estimates set status = 'approved' where status = 'accepted';
alter table public.estimates add constraint estimates_status_check check (status in ('draft','sent','approved','declined'));
drop function if exists public.portal_customer(text);
drop function if exists public.portal_invoices(text);
drop function if exists public.portal_contact_exists(text);
