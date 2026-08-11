create schema if not exists private;

revoke all on schema private from public, anon, authenticated;

create table private.signup_rate_limits (
  rate_key text primary key,
  window_started_at timestamptz not null default now(),
  attempts integer not null default 1,
  constraint signup_rate_limits_key_format check (rate_key ~ '^[0-9a-f]{64}$'),
  constraint signup_rate_limits_attempts_positive check (attempts > 0)
);

alter table private.signup_rate_limits enable row level security;
alter table private.signup_rate_limits force row level security;

revoke all on table private.signup_rate_limits from public, anon, authenticated;

create or replace function public.consume_username_signup_attempt(p_rate_key text)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_attempts integer;
begin
  if p_rate_key is null or p_rate_key !~ '^[0-9a-f]{64}$' then
    return false;
  end if;

  insert into private.signup_rate_limits as limits (rate_key, window_started_at, attempts)
  values (p_rate_key, clock_timestamp(), 1)
  on conflict (rate_key) do update
  set
    window_started_at = case
      when limits.window_started_at < clock_timestamp() - interval '15 minutes' then clock_timestamp()
      else limits.window_started_at
    end,
    attempts = case
      when limits.window_started_at < clock_timestamp() - interval '15 minutes' then 1
      else limits.attempts + 1
    end
  returning attempts into current_attempts;

  return current_attempts <= 5;
end;
$$;

revoke all on function public.consume_username_signup_attempt(text) from public, anon, authenticated;
grant execute on function public.consume_username_signup_attempt(text) to service_role;
