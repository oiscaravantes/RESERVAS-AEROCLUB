-- Ejecutar en Supabase > SQL Editor para guardar nombres de huéspedes por reserva.

alter table public.reservations
add column if not exists guest_names text[] not null default '{}';

alter table public.reservations disable trigger reservations_validate;

update public.reservations
set guest_names = array[
  coalesce(
    (select full_name from public.profiles where profiles.id = reservations.member_id),
    'Piloto responsable'
  )
]
where coalesce(array_length(guest_names, 1), 0) = 0;

alter table public.reservations enable trigger reservations_validate;

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
