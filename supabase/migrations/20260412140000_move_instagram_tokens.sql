-- Move instagram_access_token from creators to a dedicated table with
-- owner-only RLS. Previously the column lived on creators, which has a
-- "Businesses can view approved creators" SELECT policy. That policy
-- doesn't filter columns, so a business could exfiltrate every creator's
-- Instagram OAuth token via:
--   supabase.from('creators').select('instagram_access_token').eq('approved', true)
--
-- This migration:
-- 1) Creates creator_instagram_tokens (creator_id PK + token + refresh)
-- 2) Copies any existing tokens into it
-- 3) Drops instagram_access_token from creators

create table if not exists public.creator_instagram_tokens (
  creator_id uuid primary key references public.creators(id) on delete cascade,
  access_token text,
  refresh_token text,
  expires_at timestamptz,
  updated_at timestamptz not null default now()
);

comment on table public.creator_instagram_tokens is
  'Instagram OAuth tokens for creators. Owner-only read/write via RLS. Never exposed to brands or other users.';

-- Backfill from existing column if present
do $$
begin
  if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'creators' and column_name = 'instagram_access_token') then
    insert into public.creator_instagram_tokens (creator_id, access_token)
    select id, instagram_access_token
    from public.creators
    where instagram_access_token is not null
    on conflict (creator_id) do update set access_token = excluded.access_token;

    alter table public.creators drop column instagram_access_token;
  end if;
end $$;

-- RLS
alter table public.creator_instagram_tokens enable row level security;

-- Only the creator themselves can read/write their own token. Admin can read.
drop policy if exists instagram_tokens_select on public.creator_instagram_tokens;
drop policy if exists instagram_tokens_upsert on public.creator_instagram_tokens;
drop policy if exists instagram_tokens_update on public.creator_instagram_tokens;

create policy instagram_tokens_select on public.creator_instagram_tokens
  for select to authenticated
  using (
    creator_id = public.current_creator_id()
    or public.is_admin()
  );

create policy instagram_tokens_upsert on public.creator_instagram_tokens
  for insert to authenticated
  with check (creator_id = public.current_creator_id());

create policy instagram_tokens_update on public.creator_instagram_tokens
  for update to authenticated
  using (creator_id = public.current_creator_id())
  with check (creator_id = public.current_creator_id());
-- No DELETE policy — handled by ON DELETE CASCADE when creator is deleted.

-- Touch updated_at on update
create or replace function public.touch_instagram_tokens_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists instagram_tokens_touch on public.creator_instagram_tokens;
create trigger instagram_tokens_touch
  before update on public.creator_instagram_tokens
  for each row execute function public.touch_instagram_tokens_updated_at();
