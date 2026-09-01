-- Persist Runway task identity and explicit video-credit flags.
-- Does not change profile.credits.

alter table public.generations
  add column if not exists runway_task_id text,
  add column if not exists credit_charged boolean not null default false,
  add column if not exists credit_refunded boolean not null default false;

create unique index if not exists generations_runway_task_id_key
  on public.generations (runway_task_id)
  where runway_task_id is not null;

-- Old app deducted immediately before status became generating_video, and
-- creditHeld(status) treated these statuses as already charged.
-- pending / generating_script / failed are not proof of a still-held charge
-- (failed may be a script error that never billed, or a refunded video fail).
update public.generations
set credit_charged = true
where status in (
  'generating_video',
  'generating_voice',
  'compositing',
  'completed'
)
  and credit_charged = false;
