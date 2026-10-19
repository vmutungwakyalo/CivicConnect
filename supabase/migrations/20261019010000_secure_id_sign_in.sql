create unique index if not exists profiles_national_id_unique_idx
  on public.profiles (national_id)
  where national_id is not null and national_id <> '';

create table public.id_signin_rate_limits (
  rate_key text primary key check (rate_key ~ '^[0-9a-f]{64}$'),
  attempt_count integer not null check (attempt_count > 0),
  window_started_at timestamptz not null
);

create index id_signin_rate_limits_window_started_at_idx
  on public.id_signin_rate_limits (window_started_at);

alter table public.id_signin_rate_limits enable row level security;
revoke all on public.id_signin_rate_limits from public, anon, authenticated, service_role;

create or replace function public.consume_id_signin_attempt(
  _rate_key text,
  _max_attempts integer,
  _window_seconds integer
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_now timestamptz := clock_timestamp();
  v_allowed boolean;
begin
  if _rate_key !~ '^[0-9a-f]{64}$'
    or _max_attempts not between 1 and 1000
    or _window_seconds not between 1 and 86400 then
    raise exception 'Invalid rate limit parameters';
  end if;

  delete from public.id_signin_rate_limits
  where window_started_at < v_now - interval '1 day';

  insert into public.id_signin_rate_limits as limits (
    rate_key,
    attempt_count,
    window_started_at
  )
  values (_rate_key, 1, v_now)
  on conflict (rate_key) do update
  set
    attempt_count = case
      when limits.window_started_at <= v_now - make_interval(secs => _window_seconds) then 1
      else limits.attempt_count + 1
    end,
    window_started_at = case
      when limits.window_started_at <= v_now - make_interval(secs => _window_seconds) then v_now
      else limits.window_started_at
    end
  returning limits.attempt_count <= _max_attempts into v_allowed;

  return v_allowed;
end;
$function$;

revoke all on function public.consume_id_signin_attempt(text, integer, integer) from public;
revoke all on function public.consume_id_signin_attempt(text, integer, integer) from anon, authenticated;
grant execute on function public.consume_id_signin_attempt(text, integer, integer) to service_role;

create or replace function public.lookup_auth_email_by_national_id(_national_id text)
returns text
language sql
stable
security definer
set search_path = ''
as $function$
  select users.email
  from auth.users as users
  join public.profiles as profiles on profiles.id = users.id
  where profiles.national_id = _national_id
  limit 1
$function$;

revoke all on function public.lookup_auth_email_by_national_id(text) from public;
revoke all on function public.lookup_auth_email_by_national_id(text) from anon, authenticated;
grant execute on function public.lookup_auth_email_by_national_id(text) to service_role;
