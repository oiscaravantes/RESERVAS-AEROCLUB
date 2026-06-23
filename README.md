# RESERVAS AEROCLUB

Portal privado para reservaciones de socios en hoteles del club.

Nombre comercial propuesto: **Aeroclub Estancias**

Hoteles incluidos:

- **Villa Brisa del Pacífico**, Iztapa, Escuintla
- **Refugio Río Azul**, Río Dulce, Izabal

Contacto propuesto:

- WhatsApp: `+502 2458-1300`
- Correo: `reservas@aeroclub.gt`

## Tecnologías

- React + Vite + TypeScript
- Supabase Auth
- Supabase PostgreSQL
- Row Level Security
- Vercel

## Requisitos locales

Instala Node.js LTS desde:

https://nodejs.org

Luego, en esta carpeta:

```bash
npm install
npm run dev
```

## Variables de entorno

Crea un archivo `.env` tomando como base `.env.example`:

```env
VITE_SUPABASE_URL=https://pbohpffaqmfubtltmzvm.supabase.co
VITE_SUPABASE_ANON_KEY=tu_anon_public_key
```

Importante: para `VITE_SUPABASE_URL` usa la URL base del proyecto, sin `/rest/v1/`.

Correcto:

```text
https://pbohpffaqmfubtltmzvm.supabase.co
```

Incorrecto:

```text
https://pbohpffaqmfubtltmzvm.supabase.co/rest/v1/
```

## Configurar Supabase

1. Entra a tu proyecto de Supabase.
2. Abre `SQL Editor`.
3. Copia y ejecuta completo:

```text
supabase/schema.sql
```

Este script crea:

- `profiles`
- `hotels`
- `room_categories`
- `rooms`
- `reservations`
- `club_rules`
- Policies RLS
- Validación contra reservas traslapadas
- Hoteles iniciales: Iztapa y Río Dulce
- 15 habitaciones iniciales para Iztapa
- 8 habitaciones iniciales para Río Dulce

## Habitaciones y precios iniciales

Iztapa, Villa Brisa del Pacífico:

| Habitación | Tipo | Capacidad | Precio |
| --- | --- | ---: | ---: |
| I-01 Palmera Estándar | Estándar | 2 | Q575 |
| I-02 Arena Estándar | Estándar | 2 | Q575 |
| I-03 Mangle Estándar | Estándar | 2 | Q625 |
| I-04 Marina Estándar | Estándar | 2 | Q625 |
| I-05 Coral Familiar | Familiar | 4 | Q875 |
| I-06 Bahía Familiar | Familiar | 4 | Q875 |
| I-07 Dársena Familiar | Familiar | 4 | Q925 |
| I-08 Velero Familiar | Familiar | 5 | Q975 |
| I-09 Pacífico Familiar | Familiar | 5 | Q975 |
| I-10 Brisa Premium | Premium | 3 | Q1,150 |
| I-11 Océano Premium | Premium | 3 | Q1,200 |
| I-12 Atardecer Premium | Premium | 4 | Q1,250 |
| I-13 Suite Capitán | Suite | 4 | Q1,450 |
| I-14 Suite Horizonte | Suite | 4 | Q1,550 |
| I-15 Suite Pacífico | Suite | 6 | Q1,750 |

Río Dulce, Refugio Río Azul:

| Habitación | Tipo | Capacidad | Precio |
| --- | --- | ---: | ---: |
| R-01 Ceiba Estándar | Estándar | 2 | Q650 |
| R-02 Laguna Estándar | Estándar | 2 | Q650 |
| R-03 Lanchón Familiar | Familiar | 4 | Q925 |
| R-04 Izabal Familiar | Familiar | 4 | Q975 |
| R-05 Ribera Premium | Premium | 3 | Q1,200 |
| R-06 Selva Premium | Premium | 4 | Q1,300 |
| R-07 Suite Río Azul | Suite | 4 | Q1,550 |
| R-08 Suite Marina Dulce | Suite | 6 | Q1,850 |

## Reglas iniciales tipo Airbnb

- Las reservas quedan aprobadas automáticamente si hay disponibilidad.
- El socio puede cancelar sin penalidad hasta 5 días antes del check-in.
- Check-in desde las 3:00 p. m.
- Check-out hasta las 11:00 a. m.
- Los socios pueden reservar para invitados sin exceder la capacidad de la habitación.
- El portal solo registra reservas; los pagos se coordinan con administración.

## Usuarios de prueba

En Supabase:

1. Ve a `Authentication > Users`.
2. Crea estos usuarios manualmente:

```text
admin@aeroclub.com
socio@aeroclub.com
```

3. Define las contraseñas que prefieras.
4. Después ejecuta en `SQL Editor`:

```text
supabase/test-users.sql
```

Eso asigna:

- `admin@aeroclub.com` como administrador
- `socio@aeroclub.com` como socio

## Funcionalidad incluida

Socio:

- Login seguro con Supabase
- Recuperación de contraseña
- Panel privado
- Crear reserva aprobada automáticamente si hay disponibilidad
- Ver próximas reservas
- Ver mis reservas
- Cancelar reservas propias
- Ver reglas del club

Administrador:

- Dashboard básico
- Ver reservas de hoy
- Ver reservas pendientes
- Ver habitaciones activas
- Ver socios activos
- Ver todas las reservas
- Aprobar reservas, si se decide volver a flujo manual
- Cancelar reservas
- Ver hoteles, habitaciones y socios

## Pendiente recomendado para una segunda fase

Para mantener la seguridad, la creación de usuarios desde el panel admin debe hacerse con una Supabase Edge Function usando `service_role`, nunca desde el frontend.

Siguiente fase sugerida:

- Crear socios desde panel admin con Edge Function segura
- Editar/desactivar socios desde interfaz
- Crear/editar/desactivar habitaciones desde interfaz
- Temporadas con precios distintos
- Notificaciones por correo
- Reportes exportables

## Publicar en Vercel

1. Sube este proyecto a GitHub.
2. Entra a Vercel.
3. Selecciona `Add New Project`.
4. Importa el repositorio.
5. Agrega variables de entorno:

```env
VITE_SUPABASE_URL=https://pbohpffaqmfubtltmzvm.supabase.co
VITE_SUPABASE_ANON_KEY=tu_anon_public_key
```

6. Deploy.

Vercel dará una URL gratuita tipo:

```text
https://reservas-aeroclub.vercel.app
```

Luego puedes conectar un dominio propio.

## Para entrega autónoma completa

Para que Codex pueda entregar la página publicada con un link real de Vercel, hace falta uno de estos caminos:

1. Tú conectas GitHub con Vercel y pegas las variables de entorno.
2. O compartes un token temporal de GitHub y un token temporal de Vercel, ambos revocables al terminar.

No compartas contraseñas personales.

## Costos

Inicialmente puede funcionar con:

- GitHub gratis
- Supabase Free Tier
- Vercel Hobby gratis

Podría generar costo en el futuro si:

- Hay mucho tráfico
- La base de datos crece mucho
- Necesitan correos transaccionales personalizados
- Quieren dominio propio
- Necesitan colaboración avanzada o soporte empresarial
