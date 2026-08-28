-- Lumina schema. Run in the Supabase SQL editor.

create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users on delete cascade,
  email text not null,
  credits integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.ads (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  product_name text not null,
  product_description text not null,
  audience text not null,
  style text not null,
  product_image_path text not null,
  script jsonb,
  video_path text,
  voice_path text,
  final_path text,
  status text not null default 'draft',
  error text,
  credit_deducted boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.credit_transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  amount integer not null,
  reason text not null,
  ad_id uuid references public.ads(id) on delete set null,
  stripe_session_id text,
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;
alter table public.ads enable row level security;
alter table public.credit_transactions enable row level security;

create policy "profiles_select_own"
  on public.profiles for select
  using (auth.uid() = id);

create policy "profiles_update_own"
  on public.profiles for update
  using (auth.uid() = id);

create policy "profiles_insert_own"
  on public.profiles for insert
  with check (auth.uid() = id);

create policy "ads_all_own"
  on public.ads for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "transactions_select_own"
  on public.credit_transactions for select
  using (auth.uid() = user_id);

create policy "transactions_insert_own"
  on public.credit_transactions for insert
  with check (auth.uid() = user_id);

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, credits)
  values (new.id, new.email, 3)
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

create or replace function public.apply_credit_delta(
  p_delta integer,
  p_reason text,
  p_ad_id uuid default null,
  p_stripe_session_id text default null
)
returns public.profiles
language plpgsql
security definer
set search_path = public
as $$
declare
  result public.profiles;
begin
  if auth.uid() is null then
    raise exception 'not_authenticated';
  end if;

  update public.profiles
    set credits = credits + p_delta,
        updated_at = now()
  where id = auth.uid()
    and credits + p_delta >= 0
  returning * into result;

  if not found then
    raise exception 'insufficient_credits';
  end if;

  insert into public.credit_transactions (user_id, amount, reason, ad_id, stripe_session_id)
  values (auth.uid(), p_delta, p_reason, p_ad_id, p_stripe_session_id);

  return result;
end;
$$;

insert into storage.buckets (id, name, public)
values ('ads', 'ads', false)
on conflict (id) do nothing;

create policy "ads_storage_own"
  on storage.objects for all
  using (
    bucket_id = 'ads'
    and auth.uid()::text = (storage.foldername(name))[1]
  )
  with check (
    bucket_id = 'ads'
    and auth.uid()::text = (storage.foldername(name))[1]
  );
