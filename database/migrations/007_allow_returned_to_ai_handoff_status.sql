alter table public.handoffs
  drop constraint if exists handoffs_status_check;

alter table public.handoffs
  add constraint handoffs_status_check
  check (status = any (array[
    'pending'::text,
    'contacted'::text,
    'returned_to_ai'::text,
    'resolved'::text,
    'cancelled'::text
  ]));
