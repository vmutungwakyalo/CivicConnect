create type public.app_role as enum ('admin', 'officer', 'citizen');
create type public.request_status as enum ('pending', 'in_progress', 'resolved');
create type public.request_category as enum ('streetlight', 'water', 'garbage', 'roads', 'drainage', 'other');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null default '',
  national_id text,
  phone text,
  created_at timestamptz not null default now()
);
grant select, insert, update on public.profiles to authenticated;
grant all on public.profiles to service_role;
alter table public.profiles enable row level security;

create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  role app_role not null,
  unique (user_id, role)
);
grant select on public.user_roles to authenticated;
grant all on public.user_roles to service_role;
alter table public.user_roles enable row level security;

create or replace function public.has_role(_user_id uuid, _role app_role)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.user_roles where user_id = _user_id and role = _role)
$$;
create or replace function public.is_staff(_user_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.user_roles
    where user_id = _user_id and role in ('admin', 'officer')
  )
$$;

create policy "read own or staff" on public.profiles for select to authenticated
  using (id = auth.uid() or public.is_staff(auth.uid()));
create policy "insert own" on public.profiles for insert to authenticated
  with check (id = auth.uid());
create policy "update own" on public.profiles for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());
create policy "own roles readable" on public.user_roles for select to authenticated
  using (user_id = auth.uid() or public.has_role(auth.uid(), 'admin'));
create policy "admins manage roles" on public.user_roles for all to authenticated
  using (public.has_role(auth.uid(), 'admin'))
  with check (public.has_role(auth.uid(), 'admin'));

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, full_name, national_id, phone)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name', ''),
    new.raw_user_meta_data->>'national_id',
    new.raw_user_meta_data->>'phone'
  );
  insert into public.user_roles (user_id, role) values (new.id, 'citizen');
  if not exists (select 1 from public.user_roles where role = 'admin') then
    insert into public.user_roles (user_id, role) values (new.id, 'admin');
  end if;
  return new;
end;
$$;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

create table public.service_requests (
  id uuid primary key default gen_random_uuid(),
  ref_no text unique not null default ('SR-' || upper(substr(md5(random()::text), 1, 7))),
  user_id uuid not null,
  category request_category not null,
  location text not null check (char_length(location) between 3 and 200),
  description text not null check (char_length(description) between 10 and 2000),
  image_path text,
  status request_status not null default 'pending',
  admin_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  resolved_at timestamptz
);
grant select, insert, update on public.service_requests to authenticated;
grant all on public.service_requests to service_role;
alter table public.service_requests enable row level security;
create policy "read own or staff" on public.service_requests for select to authenticated
  using (user_id = auth.uid() or public.is_staff(auth.uid()));
create policy "create own" on public.service_requests for insert to authenticated
  with check (user_id = auth.uid() and status = 'pending' and admin_notes is null);
create policy "staff update" on public.service_requests for update to authenticated
  using (public.is_staff(auth.uid())) with check (public.is_staff(auth.uid()));

create table public.request_status_history (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.service_requests(id) on delete cascade,
  status request_status not null,
  note text,
  changed_by uuid,
  created_at timestamptz not null default now()
);
grant select on public.request_status_history to authenticated;
grant all on public.request_status_history to service_role;
alter table public.request_status_history enable row level security;
create policy "history visible with request" on public.request_status_history for select to authenticated
  using (
    exists (
      select 1 from public.service_requests r
      where r.id = request_id
        and (r.user_id = auth.uid() or public.is_staff(auth.uid()))
    )
  );

create or replace function public.log_request_status()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' or new.status is distinct from old.status then
    insert into public.request_status_history (request_id, status, note, changed_by)
    values (new.id, new.status, case when tg_op = 'UPDATE' then new.admin_notes end, auth.uid());
  end if;
  return new;
end;
$$;

create or replace function public.touch_request()
returns trigger language plpgsql set search_path = public as $$
begin
  new.updated_at = now();
  if new.status = 'resolved' and old.status <> 'resolved' then
    new.resolved_at = now();
  end if;
  if new.status <> 'resolved' then
    new.resolved_at = null;
  end if;
  return new;
end;
$$;

create trigger service_requests_touch
  before update on public.service_requests
  for each row execute function public.touch_request();
create trigger service_requests_log
  after insert or update on public.service_requests
  for each row execute function public.log_request_status();

insert into storage.buckets (id, name, public)
values ('request-images', 'request-images', false)
on conflict (id) do nothing;
create policy "users upload own request images" on storage.objects for insert to authenticated
  with check (bucket_id = 'request-images' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "owner or staff read request images" on storage.objects for select to authenticated
  using (
    bucket_id = 'request-images'
    and (
      (storage.foldername(name))[1] = auth.uid()::text
      or public.is_staff(auth.uid())
    )
  );
