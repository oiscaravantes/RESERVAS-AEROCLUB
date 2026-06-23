-- Después de crear los usuarios en Supabase Auth, ejecuta este script cambiando los correos si hace falta.
-- Authentication > Users > Add user:
-- admin@aeroclub.com
-- socio@aeroclub.com

update public.profiles
set full_name = 'Administrador Aeroclub',
    member_code = 'PILOTO-ADMIN',
    role = 'admin',
    active = true
where id = (
  select id from auth.users where email = 'admin@aeroclub.com' limit 1
);

update public.profiles
set full_name = 'Socio de Prueba',
    member_code = 'PILOTO-001',
    role = 'socio',
    active = true
where id = (
  select id from auth.users where email = 'socio@aeroclub.com' limit 1
);
