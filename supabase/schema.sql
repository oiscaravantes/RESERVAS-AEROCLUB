-- RESERVAS AEROCLUB
-- Ejecutar completo en Supabase > SQL Editor.

create extension if not exists "pgcrypto";

do $$ begin
  create type public.user_role as enum ('admin', 'socio');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.reservation_status as enum ('pendiente', 'aprobada', 'cancelada');
exception when duplicate_object then null;
end $$;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null,
  member_code text unique,
  role public.user_role not null default 'socio',
  phone text,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.hotels (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  location text not null,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.room_categories (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  description text,
  base_price numeric(10,2) not null check (base_price >= 0),
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.rooms (
  id uuid primary key default gen_random_uuid(),
  hotel_id uuid not null references public.hotels(id) on delete restrict,
  category_id uuid references public.room_categories(id) on delete set null,
  room_number text not null,
  name text not null,
  capacity integer not null default 2 check (capacity > 0),
  nightly_price numeric(10,2) not null check (nightly_price >= 0),
  active boolean not null default true,
  notes text,
  created_at timestamptz not null default now(),
  unique (hotel_id, room_number)
);

create table if not exists public.reservations (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null references public.profiles(id) on delete restrict,
  hotel_id uuid not null references public.hotels(id) on delete restrict,
  room_id uuid not null references public.rooms(id) on delete restrict,
  check_in date not null,
  check_out date not null,
  guests integer not null default 1 check (guests > 0),
  guest_names text[] not null default '{}',
  status public.reservation_status not null default 'aprobada',
  comments text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  cancelled_at timestamptz,
  cancelled_by uuid references public.profiles(id),
  constraint valid_reservation_dates check (check_out > check_in)
);

create table if not exists public.club_rules (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  content text not null,
  active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists reservations_room_dates_idx
  on public.reservations (room_id, check_in, check_out, status);

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles
    where id = auth.uid()
      and role = 'admin'
      and active = true
  );
$$;

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists reservations_touch_updated_at on public.reservations;
create trigger reservations_touch_updated_at
before update on public.reservations
for each row execute function public.touch_updated_at();

create or replace function public.validate_reservation()
returns trigger
language plpgsql
as $$
declare
  room_hotel_id uuid;
  room_capacity integer;
  member_is_active boolean;
begin
  if tg_op = 'UPDATE' and not public.is_admin() then
    if old.member_id <> auth.uid() then
      raise exception 'No puedes modificar reservas de otro socio.';
    end if;

    if old.status = 'cancelada' or new.status <> 'cancelada' then
      raise exception 'Los socios solo pueden cancelar reservas activas.';
    end if;

    if old.check_in < current_date + 5 then
      raise exception 'cancel_deadline_passed';
    end if;

    if new.id is distinct from old.id
      or new.member_id is distinct from old.member_id
      or new.hotel_id is distinct from old.hotel_id
      or new.room_id is distinct from old.room_id
      or new.check_in is distinct from old.check_in
      or new.check_out is distinct from old.check_out
      or new.guests is distinct from old.guests
      or new.guest_names is distinct from old.guest_names
      or new.comments is distinct from old.comments
      or new.created_at is distinct from old.created_at then
      raise exception 'Los socios no pueden editar datos de la reserva; solo cancelarla si cumple la política.';
    end if;
  end if;

  if new.check_in < current_date then
    raise exception 'No se permiten reservas en fechas pasadas.';
  end if;

  select hotel_id, capacity
    into room_hotel_id, room_capacity
  from public.rooms
  where id = new.room_id
    and active = true;

  if room_hotel_id is null then
    raise exception 'La habitación no existe o está inactiva.';
  end if;

  if room_hotel_id <> new.hotel_id then
    raise exception 'La habitación no pertenece al hotel seleccionado.';
  end if;

  if new.guests > room_capacity then
    raise exception 'La cantidad de huéspedes supera la capacidad de la habitación.';
  end if;

  new.guest_names = array(
    select nullif(trim(guest_name), '')
    from unnest(coalesce(new.guest_names, '{}')) as guest_name
    where nullif(trim(guest_name), '') is not null
  );

  if coalesce(array_length(new.guest_names, 1), 0) = 0 then
    raise exception 'Debes ingresar al menos el nombre del piloto o socio responsable.';
  end if;

  new.guests = array_length(new.guest_names, 1);

  if new.guests > room_capacity then
    raise exception 'La cantidad de nombres de huéspedes supera la capacidad de la habitación.';
  end if;

  select active into member_is_active
  from public.profiles
  where id = new.member_id;

  if coalesce(member_is_active, false) = false then
    raise exception 'El socio no existe o está inactivo.';
  end if;

  if new.status <> 'cancelada' and exists (
    select 1
    from public.reservations existing
    where existing.room_id = new.room_id
      and existing.status <> 'cancelada'
      and existing.id <> coalesce(new.id, gen_random_uuid())
      and daterange(existing.check_in, existing.check_out, '[)') &&
          daterange(new.check_in, new.check_out, '[)')
  ) then
    raise exception 'reservation_overlap';
  end if;

  if new.status = 'cancelada' and old.status is distinct from 'cancelada' then
    new.cancelled_at = now();
    new.cancelled_by = auth.uid();
  end if;

  return new;
end;
$$;

drop trigger if exists reservations_validate on public.reservations;
create trigger reservations_validate
before insert or update on public.reservations
for each row execute function public.validate_reservation();

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, member_code, role, phone, active)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)),
    upper(new.raw_user_meta_data->>'member_code'),
    coalesce((new.raw_user_meta_data->>'role')::public.user_role, 'socio'),
    new.raw_user_meta_data->>'phone',
    case
      when coalesce(new.raw_user_meta_data->>'role', 'socio') = 'admin' then true
      else false
    end
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

create or replace function public.email_for_member_login(pilot_number text)
returns text
language sql
stable
security definer
set search_path = public, auth
as $$
  select users.email
  from public.profiles
  join auth.users on users.id = profiles.id
  where profiles.member_code = upper(trim(pilot_number))
    and profiles.active = true
  limit 1;
$$;

grant execute on function public.email_for_member_login(text) to anon, authenticated;

alter table public.profiles enable row level security;
alter table public.hotels enable row level security;
alter table public.room_categories enable row level security;
alter table public.rooms enable row level security;
alter table public.reservations enable row level security;
alter table public.club_rules enable row level security;

drop policy if exists "profiles_select_own_or_admin" on public.profiles;
create policy "profiles_select_own_or_admin"
on public.profiles for select
using (id = auth.uid() or public.is_admin());

drop policy if exists "profiles_admin_all" on public.profiles;
create policy "profiles_admin_all"
on public.profiles for all
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "hotels_read_authenticated" on public.hotels;
create policy "hotels_read_authenticated"
on public.hotels for select
to authenticated
using (active = true or public.is_admin());

drop policy if exists "hotels_admin_all" on public.hotels;
create policy "hotels_admin_all"
on public.hotels for all
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "categories_read_authenticated" on public.room_categories;
create policy "categories_read_authenticated"
on public.room_categories for select
to authenticated
using (active = true or public.is_admin());

drop policy if exists "categories_admin_all" on public.room_categories;
create policy "categories_admin_all"
on public.room_categories for all
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "rooms_read_authenticated" on public.rooms;
create policy "rooms_read_authenticated"
on public.rooms for select
to authenticated
using (active = true or public.is_admin());

drop policy if exists "rooms_admin_all" on public.rooms;
create policy "rooms_admin_all"
on public.rooms for all
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "reservations_select_own_or_admin" on public.reservations;
create policy "reservations_select_own_or_admin"
on public.reservations for select
using (member_id = auth.uid() or public.is_admin());

drop policy if exists "reservations_insert_own" on public.reservations;
create policy "reservations_insert_own"
on public.reservations for insert
with check (member_id = auth.uid());

drop policy if exists "reservations_member_cancel_own" on public.reservations;
create policy "reservations_member_cancel_own"
on public.reservations for update
using (member_id = auth.uid() and status <> 'cancelada' and check_in >= current_date + 5)
with check (member_id = auth.uid() and status = 'cancelada');

drop policy if exists "reservations_admin_all" on public.reservations;
create policy "reservations_admin_all"
on public.reservations for all
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "rules_read_authenticated" on public.club_rules;
create policy "rules_read_authenticated"
on public.club_rules for select
to authenticated
using (active = true or public.is_admin());

drop policy if exists "rules_admin_all" on public.club_rules;
create policy "rules_admin_all"
on public.club_rules for all
using (public.is_admin())
with check (public.is_admin());

insert into public.hotels (name, location, active)
values
  ('Villa Brisa del Pacífico', 'Iztapa, Escuintla, Guatemala', true),
  ('Refugio Río Azul', 'Río Dulce, Izabal, Guatemala', true)
on conflict (name) do update set location = excluded.location, active = excluded.active;

insert into public.room_categories (name, description, base_price, active)
values
  ('Estándar', 'Habitación cómoda para estadías cortas de socios.', 575, true),
  ('Familiar', 'Habitación amplia para familias o grupos pequeños.', 875, true),
  ('Premium', 'Habitación superior con mejores vistas y amenidades.', 1150, true),
  ('Suite', 'Suite amplia para estadías especiales.', 1450, true)
on conflict (name) do update set description = excluded.description, base_price = excluded.base_price, active = excluded.active;

with iztapa as (
  select id from public.hotels where name = 'Villa Brisa del Pacífico'
),
estandar as (
  select id from public.room_categories where name = 'Estándar'
),
familiar as (
  select id from public.room_categories where name = 'Familiar'
),
suite as (
  select id from public.room_categories where name = 'Suite'
),
premium as (
  select id from public.room_categories where name = 'Premium'
)
insert into public.rooms (hotel_id, category_id, room_number, name, capacity, nightly_price, active)
select iztapa.id, estandar.id, 'I-01', 'Palmera Estándar', 2, 575, true from iztapa, estandar
union all select iztapa.id, estandar.id, 'I-02', 'Arena Estándar', 2, 575, true from iztapa, estandar
union all select iztapa.id, estandar.id, 'I-03', 'Mangle Estándar', 2, 625, true from iztapa, estandar
union all select iztapa.id, estandar.id, 'I-04', 'Marina Estándar', 2, 625, true from iztapa, estandar
union all select iztapa.id, familiar.id, 'I-05', 'Coral Familiar', 4, 875, true from iztapa, familiar
union all select iztapa.id, familiar.id, 'I-06', 'Bahía Familiar', 4, 875, true from iztapa, familiar
union all select iztapa.id, familiar.id, 'I-07', 'Dársena Familiar', 4, 925, true from iztapa, familiar
union all select iztapa.id, familiar.id, 'I-08', 'Velero Familiar', 5, 975, true from iztapa, familiar
union all select iztapa.id, familiar.id, 'I-09', 'Pacífico Familiar', 5, 975, true from iztapa, familiar
union all select iztapa.id, premium.id, 'I-10', 'Brisa Premium', 3, 1150, true from iztapa, premium
union all select iztapa.id, premium.id, 'I-11', 'Océano Premium', 3, 1200, true from iztapa, premium
union all select iztapa.id, premium.id, 'I-12', 'Atardecer Premium', 4, 1250, true from iztapa, premium
union all select iztapa.id, suite.id, 'I-13', 'Suite Capitán', 4, 1450, true from iztapa, suite
union all select iztapa.id, suite.id, 'I-14', 'Suite Horizonte', 4, 1550, true from iztapa, suite
union all select iztapa.id, suite.id, 'I-15', 'Suite Pacífico', 6, 1750, true from iztapa, suite
on conflict (hotel_id, room_number) do update
set name = excluded.name,
    category_id = excluded.category_id,
    capacity = excluded.capacity,
    nightly_price = excluded.nightly_price,
    active = excluded.active;

with rio as (
  select id from public.hotels where name = 'Refugio Río Azul'
),
estandar as (
  select id from public.room_categories where name = 'Estándar'
),
familiar as (
  select id from public.room_categories where name = 'Familiar'
),
suite as (
  select id from public.room_categories where name = 'Suite'
),
premium as (
  select id from public.room_categories where name = 'Premium'
)
insert into public.rooms (hotel_id, category_id, room_number, name, capacity, nightly_price, active)
select rio.id, estandar.id, 'R-01', 'Ceiba Estándar', 2, 650, true from rio, estandar
union all select rio.id, estandar.id, 'R-02', 'Laguna Estándar', 2, 650, true from rio, estandar
union all select rio.id, familiar.id, 'R-03', 'Lanchón Familiar', 4, 925, true from rio, familiar
union all select rio.id, familiar.id, 'R-04', 'Izabal Familiar', 4, 975, true from rio, familiar
union all select rio.id, premium.id, 'R-05', 'Ribera Premium', 3, 1200, true from rio, premium
union all select rio.id, premium.id, 'R-06', 'Selva Premium', 4, 1300, true from rio, premium
union all select rio.id, suite.id, 'R-07', 'Suite Río Azul', 4, 1550, true from rio, suite
union all select rio.id, suite.id, 'R-08', 'Suite Marina Dulce', 6, 1850, true from rio, suite
on conflict (hotel_id, room_number) do update
set name = excluded.name,
    category_id = excluded.category_id,
    capacity = excluded.capacity,
    nightly_price = excluded.nightly_price,
    active = excluded.active;

insert into public.club_rules (title, content, active, sort_order)
values
  ('Reservas para socios activos', 'Solo los socios activos pueden reservar. Cada reserva debe respetar la capacidad máxima de la habitación.', true, 1),
  ('Confirmación inmediata', 'Si la habitación está disponible, la reserva queda aprobada automáticamente. Administración puede contactar al socio si necesita validar algún detalle.', true, 2),
  ('Cancelación flexible', 'El socio puede cancelar sin penalidad hasta 5 días antes de la fecha de entrada. Después de ese plazo, la cancelación queda sujeta a revisión administrativa.', true, 3),
  ('Check-in y check-out', 'Check-in desde las 3:00 p. m. y check-out hasta las 11:00 a. m.', true, 4),
  ('Invitados', 'Los socios pueden incluir invitados, siempre que no se exceda la capacidad registrada de la habitación.', true, 5),
  ('Pagos', 'El portal registra la reserva. Los pagos, depósitos o cargos se coordinan directamente con administración.', true, 6)
on conflict do nothing;
