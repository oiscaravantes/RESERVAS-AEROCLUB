import {
  BedDouble,
  Building2,
  CalendarDays,
  CheckCircle2,
  CircleDollarSign,
  Clock3,
  Hotel as HotelIcon,
  LogOut,
  ShieldCheck,
  Users,
  XCircle,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "./lib/supabase";
import type { ClubRule, Hotel, Profile, Reservation, ReservationStatus, Room } from "./types";

type View = "reservar" | "mis-reservas" | "reglas" | "admin-dashboard" | "admin-reservas" | "admin-catalogos";

const statusLabels: Record<ReservationStatus, string> = {
  pendiente: "Pendiente",
  aprobada: "Aprobada",
  cancelada: "Cancelada",
};

const portal = {
  name: "Aeroclub Estancias",
  legalName: "Reservas Aeroclub",
  iztapa: "Villa Brisa del Pacífico",
  rioDulce: "Refugio Río Azul",
  phone: "+502 2458-1300",
  email: "reservas@aeroclub.gt",
};

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function money(value: number) {
  return new Intl.NumberFormat("es-GT", {
    style: "currency",
    currency: "GTQ",
    maximumFractionDigits: 0,
  }).format(value);
}

function addDaysISO(days: number) {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}

function canMemberCancel(checkIn: string) {
  return checkIn >= addDaysISO(5);
}

function nightsBetween(checkIn: string, checkOut: string) {
  if (!checkIn || !checkOut || checkOut <= checkIn) return 0;
  const start = new Date(`${checkIn}T00:00:00`);
  const end = new Date(`${checkOut}T00:00:00`);
  return Math.round((end.getTime() - start.getTime()) / 86400000);
}

function reservationGuestCount(reservation: Reservation) {
  return reservation.guest_names?.filter((name) => name.trim()).length || reservation.guests || 1;
}

export default function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
    });

    const { data } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
    });

    return () => data.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!session?.user.id) {
      setProfile(null);
      return;
    }

    supabase
      .from("profiles")
      .select("*")
      .eq("id", session.user.id)
      .single()
      .then(({ data, error }) => {
        if (error) console.error(error.message);
        setProfile(data);
      });
  }, [session?.user.id]);

  if (loading) return <Splash />;
  if (!session) return <AuthScreen />;
  if (!profile) return <Splash message="Preparando tu perfil..." />;
  if (!profile.active) return <InactiveAccount />;

  return <Portal session={session} profile={profile} />;
}

function Splash({ message = "Cargando Reservas Aeroclub..." }: { message?: string }) {
  return (
    <main className="center-screen">
      <div className="brand-mark">RA</div>
      <p>{message}</p>
    </main>
  );
}

function AuthScreen() {
  const [mode, setMode] = useState<"login" | "register">("login");
  const [identifier, setIdentifier] = useState("");
  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [pilotNumber, setPilotNumber] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  async function signIn(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    let loginEmail = identifier.trim();

    if (!loginEmail.includes("@")) {
      const { data, error } = await supabase.rpc("email_for_member_login", {
        pilot_number: loginEmail,
      });

      if (error || !data) {
        setBusy(false);
        setMessage("No encontramos ese número de piloto. Revisa el dato o usa tu correo.");
        return;
      }

      loginEmail = data;
    }

    const { error } = await supabase.auth.signInWithPassword({ email: loginEmail, password });
    setBusy(false);
    if (error) setMessage("No se pudo iniciar sesión. Revisa tu correo y contraseña.");
  }

  async function register(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setMessage("");

    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: fullName,
          member_code: pilotNumber,
          role: "socio",
        },
      },
    });

    setBusy(false);

    if (error) {
      setMessage(error.message.includes("already") ? "Ese correo ya está registrado." : error.message);
      return;
    }

    setMessage("Registro recibido. Revisa tu correo y espera activación del administrador.");
    setMode("login");
    setIdentifier(email);
  }

  async function resetPassword() {
    const recoveryEmail = mode === "login" ? identifier : email;

    if (!recoveryEmail || !recoveryEmail.includes("@")) {
      setMessage("Escribe tu correo para enviarte la recuperación de contraseña.");
      return;
    }

    const { error } = await supabase.auth.resetPasswordForEmail(recoveryEmail, {
      redirectTo: window.location.origin,
    });
    setMessage(error ? "No se pudo enviar el correo de recuperación." : "Revisa tu correo para recuperar tu contraseña.");
  }

  return (
    <main className="auth-page">
      <section className="auth-panel">
        <div>
          <div className="brand-row">
            <div className="brand-mark">RA</div>
            <div>
              <p className="eyebrow">Portal privado</p>
              <h1>{portal.name}</h1>
            </div>
          </div>
          <p className="auth-copy">
            Reservaciones para socios en {portal.iztapa} y {portal.rioDulce}.
          </p>
          <div className="contact-strip">
            <span>{portal.phone}</span>
            <span>{portal.email}</span>
          </div>
        </div>

        <div className="segmented-control" aria-label="Tipo de acceso">
          <button className={mode === "login" ? "selected" : ""} onClick={() => setMode("login")} type="button">
            Ingresar
          </button>
          <button className={mode === "register" ? "selected" : ""} onClick={() => setMode("register")} type="button">
            Registrarme
          </button>
        </div>

        {mode === "login" ? (
          <form onSubmit={signIn} className="form-stack">
            <label>
              Correo o número de piloto
              <input value={identifier} onChange={(event) => setIdentifier(event.target.value)} required />
            </label>
            <label>
              Contraseña
              <input value={password} onChange={(event) => setPassword(event.target.value)} type="password" required />
            </label>
            <button className="primary-button" disabled={busy}>
              {busy ? "Ingresando..." : "Ingresar"}
            </button>
            <button type="button" className="ghost-button" onClick={resetPassword}>
              Recuperar contraseña
            </button>
            {message && <p className="form-message">{message}</p>}
          </form>
        ) : (
          <form onSubmit={register} className="form-stack">
            <label>
              Nombre completo
              <input value={fullName} onChange={(event) => setFullName(event.target.value)} required />
            </label>
            <label>
              Número de piloto
              <input value={pilotNumber} onChange={(event) => setPilotNumber(event.target.value.toUpperCase())} required />
            </label>
            <label>
              Correo electrónico
              <input value={email} onChange={(event) => setEmail(event.target.value)} type="email" required />
            </label>
            <label>
              Contraseña
              <input value={password} onChange={(event) => setPassword(event.target.value)} type="password" minLength={8} required />
            </label>
            <button className="primary-button" disabled={busy}>
              {busy ? "Registrando..." : "Crear cuenta"}
            </button>
            {message && <p className="form-message">{message}</p>}
          </form>
        )}
      </section>
    </main>
  );
}

function InactiveAccount() {
  return (
    <main className="center-screen">
      <ShieldCheck size={40} />
      <h1>Cuenta inactiva</h1>
      <p>Contacta al administrador del club para activar tu acceso.</p>
      <button className="primary-button" onClick={() => supabase.auth.signOut()}>
        Cerrar sesión
      </button>
    </main>
  );
}

function Portal({ profile }: { session: Session; profile: Profile }) {
  const initialView: View = profile.role === "admin" ? "admin-dashboard" : "reservar";
  const [view, setView] = useState<View>(initialView);

  const nav = profile.role === "admin"
    ? [
        ["admin-dashboard", "Dashboard", Building2],
        ["admin-reservas", "Reservas", CalendarDays],
        ["admin-catalogos", "Catálogos", HotelIcon],
      ] as const
    : [
        ["reservar", "Reservar", CalendarDays],
        ["mis-reservas", "Mis reservas", BedDouble],
        ["reglas", "Reglas", ShieldCheck],
      ] as const;

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand-row">
          <div className="brand-mark">RA</div>
          <div>
            <strong>{portal.name}</strong>
            <small>{profile.role === "admin" ? "Administrador" : "Socio"}</small>
          </div>
        </div>

        <nav>
          {nav.map(([id, label, Icon]) => (
            <button key={id} className={view === id ? "active" : ""} onClick={() => setView(id)}>
              <Icon size={18} />
              {label}
            </button>
          ))}
        </nav>

        <button className="logout-button" onClick={() => supabase.auth.signOut()}>
          <LogOut size={18} />
          Salir
        </button>
      </aside>

      <main className="content">
        <header className="topbar">
          <div>
            <p className="eyebrow">Bienvenido</p>
            <h1>{profile.full_name}</h1>
            <small className="topbar-contact">{portal.phone} · {portal.email}</small>
          </div>
          <span className="role-pill">{profile.role}</span>
        </header>

        {view === "reservar" && <MemberBooking profile={profile} />}
        {view === "mis-reservas" && <MyReservations profile={profile} />}
        {view === "reglas" && <Rules />}
        {view === "admin-dashboard" && <AdminDashboard />}
        {view === "admin-reservas" && <AdminReservations />}
        {view === "admin-catalogos" && <AdminCatalogs />}
      </main>
    </div>
  );
}

function MemberBooking({ profile }: { profile: Profile }) {
  const [hotels, setHotels] = useState<Hotel[]>([]);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [message, setMessage] = useState("");
  const [form, setForm] = useState({
    hotel_id: "",
    room_id: "",
    check_in: todayISO(),
    check_out: "",
    guest_names: [profile.full_name],
    comments: "",
  });

  useEffect(() => {
    loadBookingData();
  }, []);

  async function loadBookingData() {
    const [hotelResult, roomResult, reservationResult] = await Promise.all([
      supabase.from("hotels").select("*").eq("active", true).order("name"),
      supabase.from("rooms").select("*, hotels(*), room_categories(*)").eq("active", true).order("room_number"),
      supabase.from("reservations").select("*, hotels(*), rooms(*)").neq("status", "cancelada").order("check_in"),
    ]);
    setHotels(hotelResult.data ?? []);
    setRooms(roomResult.data ?? []);
    setReservations(reservationResult.data ?? []);
  }

  const visibleRooms = rooms.filter((room) => !form.hotel_id || room.hotel_id === form.hotel_id);
  const selectedRoom = rooms.find((room) => room.id === form.room_id);
  const nights = nightsBetween(form.check_in, form.check_out);
  const estimatedTotal = selectedRoom && nights > 0 ? selectedRoom.nightly_price * nights : 0;
  const guestSlots = selectedRoom?.capacity ?? 0;
  const guestNames = Array.from({ length: guestSlots }, (_item, index) => form.guest_names[index] ?? "");
  const filledGuestNames = guestNames.map((name) => name.trim()).filter(Boolean);

  function updateRoom(roomId: string) {
    const room = rooms.find((item) => item.id === roomId);
    const nextNames = Array.from({ length: room?.capacity ?? 0 }, (_item, index) => {
      if (index === 0) return form.guest_names[0]?.trim() || profile.full_name;
      return form.guest_names[index] ?? "";
    });
    setForm({ ...form, room_id: roomId, guest_names: nextNames });
  }

  function updateGuestName(index: number, value: string) {
    const nextNames = [...guestNames];
    nextNames[index] = value;
    if (index === 0 && !value.trim()) nextNames[index] = profile.full_name;
    setForm({ ...form, guest_names: nextNames });
  }

  async function createReservation(event: React.FormEvent) {
    event.preventDefault();
    setMessage("");

    if (!form.room_id || !form.hotel_id) {
      setMessage("Selecciona hotel y habitación.");
      return;
    }

    if (form.check_in < todayISO()) {
      setMessage("No puedes reservar fechas pasadas.");
      return;
    }

    if (form.check_out <= form.check_in) {
      setMessage("La fecha de salida debe ser posterior a la entrada.");
      return;
    }

    if (!filledGuestNames.length) {
      setMessage("Agrega al menos el nombre del piloto o socio responsable.");
      return;
    }

    const { error } = await supabase.from("reservations").insert({
      member_id: profile.id,
      hotel_id: form.hotel_id,
      room_id: form.room_id,
      check_in: form.check_in,
      check_out: form.check_out,
      guests: filledGuestNames.length,
      guest_names: filledGuestNames,
      comments: form.comments || null,
      status: "aprobada",
    });

    if (error) {
      setMessage(error.message.includes("overlap") ? "La habitación ya está reservada en esas fechas." : error.message);
      return;
    }

    setMessage("Reserva aprobada automáticamente. Recibirás confirmación del administrador si hay algún ajuste.");
    setForm((current) => ({ ...current, room_id: "", guest_names: [profile.full_name], comments: "" }));
    loadBookingData();
  }

  return (
    <section className="grid-layout">
      <div className="panel">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Nueva reserva</p>
            <h2>Disponibilidad de habitaciones</h2>
          </div>
          <CalendarDays />
        </div>

        <form className="form-grid" onSubmit={createReservation}>
          <label>
            Hotel
            <select value={form.hotel_id} onChange={(event) => setForm({ ...form, hotel_id: event.target.value, room_id: "" })} required>
              <option value="">Seleccionar</option>
              {hotels.map((hotel) => (
                <option key={hotel.id} value={hotel.id}>{hotel.name}</option>
              ))}
            </select>
          </label>
          <label>
            Habitación
            <select
              value={form.room_id}
              onChange={(event) => updateRoom(event.target.value)}
              required
              disabled={!form.hotel_id}
            >
              <option value="">{form.hotel_id ? "Seleccionar" : "Selecciona un hotel primero"}</option>
              {visibleRooms.map((room) => (
                <option key={room.id} value={room.id}>
                  {room.room_number} - {room.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Entrada
            <input type="date" min={todayISO()} value={form.check_in} onChange={(event) => setForm({ ...form, check_in: event.target.value })} required />
          </label>
          <label>
            Salida
            <input type="date" min={form.check_in || todayISO()} value={form.check_out} onChange={(event) => setForm({ ...form, check_out: event.target.value })} required />
          </label>
          <label className="span-2">
            Nombres de huéspedes
            <div className="guest-fields">
              {selectedRoom ? (
                guestNames.map((name, index) => (
                  <input
                    key={`${selectedRoom.id}-${index}`}
                    value={name}
                    onChange={(event) => updateGuestName(index, event.target.value)}
                    placeholder={index === 0 ? "Piloto responsable" : `Huésped ${index + 1} (opcional)`}
                    required={index === 0}
                  />
                ))
              ) : (
                <input value="" placeholder="Selecciona una habitación primero" disabled />
              )}
            </div>
            {selectedRoom && <small className="helper-text">Puedes dejar vacíos los espacios que no se usarán. Máximo {selectedRoom.capacity} personas.</small>}
          </label>
          <label className="span-2">
            Comentarios
            <textarea value={form.comments} onChange={(event) => setForm({ ...form, comments: event.target.value })} rows={3} />
          </label>
          <div className="booking-summary span-2">
            {selectedRoom ? (
              <>
                <div>
                  <span>Habitación seleccionada</span>
                  <strong>{selectedRoom.room_number} - {selectedRoom.name}</strong>
                  <small>{filledGuestNames.length || 1} de {selectedRoom.capacity} espacios usados</small>
                </div>
                <div>
                  <span>Precio por noche</span>
                  <strong className="price-highlight">{money(selectedRoom.nightly_price)}</strong>
                  <small>{nights > 0 ? `${nights} noche${nights === 1 ? "" : "s"} seleccionada${nights === 1 ? "" : "s"}` : "Selecciona entrada y salida"}</small>
                </div>
                <div>
                  <span>Total estimado</span>
                  <strong className="total-highlight">{estimatedTotal > 0 ? money(estimatedTotal) : "Pendiente"}</strong>
                  <small>No incluye cargos adicionales si aplican</small>
                </div>
              </>
            ) : (
              <p>Selecciona hotel y habitación para ver precio, capacidad y total estimado.</p>
            )}
          </div>
          <button className="primary-button span-2">Solicitar reserva</button>
          {message && <p className="form-message span-2">{message}</p>}
        </form>
      </div>

      <Availability reservations={reservations} rooms={rooms} />
    </section>
  );
}

function Availability({ reservations, rooms }: { reservations: Reservation[]; rooms: Room[] }) {
  const upcoming = reservations.slice(0, 8);
  return (
    <div className="panel">
      <div className="section-heading">
        <div>
          <p className="eyebrow">Calendario</p>
          <h2>Próximas reservas</h2>
        </div>
        <Clock3 />
      </div>
      <div className="calendar-list">
        {upcoming.length === 0 && <p className="muted">No hay reservas próximas.</p>}
        {upcoming.map((reservation) => (
          <article key={reservation.id} className="calendar-item">
            <div className="calendar-room">
              <strong>{reservation.rooms?.room_number ?? rooms.find((room) => room.id === reservation.room_id)?.room_number}</strong>
              <span>{reservation.rooms?.name ?? "Habitación reservada"}</span>
              <small>{reservation.hotels?.name} · {reservationGuestCount(reservation)} persona{reservationGuestCount(reservation) === 1 ? "" : "s"}</small>
            </div>
            <div className="calendar-date">
              <span>Entrada</span>
              <strong>{reservation.check_in}</strong>
              <small>Salida {reservation.check_out}</small>
            </div>
            <span className={`status ${reservation.status}`}>{statusLabels[reservation.status]}</span>
          </article>
        ))}
      </div>
    </div>
  );
}

function MyReservations({ profile }: { profile: Profile }) {
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [message, setMessage] = useState("");

  useEffect(() => {
    load();
  }, []);

  async function load() {
    const { data } = await supabase
      .from("reservations")
      .select("*, hotels(*), rooms(*)")
      .eq("member_id", profile.id)
      .order("check_in", { ascending: false });
    setReservations(data ?? []);
  }

  async function cancelReservation(reservation: Reservation) {
    setMessage("");

    if (!canMemberCancel(reservation.check_in)) {
      setMessage("Esta reserva ya no se puede cancelar desde el portal porque faltan menos de 5 días para la entrada.");
      return;
    }

    const { error } = await supabase.from("reservations").update({ status: "cancelada" }).eq("id", reservation.id);
    if (error) {
      setMessage(error.message.includes("cancel_deadline_passed") ? "Esta reserva ya no cumple la política de cancelación de 5 días." : error.message);
      return;
    }
    load();
  }

  return (
    <section className="panel">
      <div className="section-heading">
        <div>
          <p className="eyebrow">Historial</p>
          <h2>Mis reservas</h2>
        </div>
        <BedDouble />
      </div>
      {message && <p className="form-message">{message}</p>}
      <ReservationTable reservations={reservations} onCancel={cancelReservation} enforceCancelPolicy />
    </section>
  );
}

function Rules() {
  const [rules, setRules] = useState<ClubRule[]>([]);

  useEffect(() => {
    supabase
      .from("club_rules")
      .select("*")
      .eq("active", true)
      .order("sort_order")
      .then(({ data }) => setRules(data ?? []));
  }, []);

  return (
    <section className="rules-grid">
      {rules.map((rule) => (
        <article className="panel" key={rule.id}>
          <p className="eyebrow">Regla</p>
          <h2>{rule.title}</h2>
          <p>{rule.content}</p>
        </article>
      ))}
    </section>
  );
}

function AdminDashboard() {
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);

  useEffect(() => {
    Promise.all([
      supabase.from("reservations").select("*"),
      supabase.from("rooms").select("*").eq("active", true),
      supabase.from("profiles").select("*").eq("active", true),
    ]).then(([reservationResult, roomResult, profileResult]) => {
      setReservations(reservationResult.data ?? []);
      setRooms(roomResult.data ?? []);
      setProfiles(profileResult.data ?? []);
    });
  }, []);

  const stats = useMemo(() => {
    const today = todayISO();
    return {
      today: reservations.filter((item) => item.check_in <= today && item.check_out > today && item.status !== "cancelada").length,
      pending: reservations.filter((item) => item.status === "pendiente").length,
      rooms: rooms.length,
      members: profiles.filter((item) => item.role === "socio").length,
    };
  }, [reservations, rooms, profiles]);

  return (
    <section className="stats-grid">
      <StatCard icon={CalendarDays} label="Reservas de hoy" value={stats.today} />
      <StatCard icon={Clock3} label="Pendientes" value={stats.pending} />
      <StatCard icon={BedDouble} label="Habitaciones activas" value={stats.rooms} />
      <StatCard icon={Users} label="Socios activos" value={stats.members} />
    </section>
  );
}

function StatCard({ icon: Icon, label, value }: { icon: typeof CalendarDays; label: string; value: number }) {
  return (
    <article className="stat-card">
      <Icon />
      <span>{label}</span>
      <strong>{value}</strong>
    </article>
  );
}

function AdminReservations() {
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [status, setStatus] = useState("");

  useEffect(() => {
    load();
  }, []);

  async function load() {
    const { data } = await supabase
      .from("reservations")
      .select("*, profiles(*), hotels(*), rooms(*)")
      .order("check_in", { ascending: false });
    setReservations(data ?? []);
  }

  async function updateStatus(id: string, nextStatus: ReservationStatus) {
    await supabase.from("reservations").update({ status: nextStatus }).eq("id", id);
    load();
  }

  const filtered = status ? reservations.filter((item) => item.status === status) : reservations;

  return (
    <section className="panel">
      <div className="section-heading">
        <div>
          <p className="eyebrow">Administración</p>
          <h2>Todas las reservas</h2>
        </div>
        <select className="compact-select" value={status} onChange={(event) => setStatus(event.target.value)}>
          <option value="">Todos los estados</option>
          <option value="pendiente">Pendientes</option>
          <option value="aprobada">Aprobadas</option>
          <option value="cancelada">Canceladas</option>
        </select>
      </div>
      <ReservationTable reservations={filtered} admin onApprove={(id) => updateStatus(id, "aprobada")} onCancel={(reservation) => updateStatus(reservation.id, "cancelada")} />
    </section>
  );
}

function AdminCatalogs() {
  const [hotels, setHotels] = useState<Hotel[]>([]);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);

  useEffect(() => {
    Promise.all([
      supabase.from("hotels").select("*").order("name"),
      supabase.from("rooms").select("*, hotels(*), room_categories(*)").order("room_number"),
      supabase.from("profiles").select("*").order("full_name"),
    ]).then(([hotelResult, roomResult, profileResult]) => {
      setHotels(hotelResult.data ?? []);
      setRooms(roomResult.data ?? []);
      setProfiles(profileResult.data ?? []);
    });
  }, []);

  return (
    <section className="catalog-grid">
      <div className="panel">
        <div className="section-heading">
          <h2>Hoteles</h2>
          <Building2 />
        </div>
        {hotels.map((hotel) => (
          <div className="catalog-row" key={hotel.id}>
            <strong>{hotel.name}</strong>
            <span>{hotel.location}</span>
          </div>
        ))}
      </div>
      <div className="panel">
        <div className="section-heading">
          <h2>Habitaciones</h2>
          <CircleDollarSign />
        </div>
        {rooms.map((room) => (
          <div className="catalog-row" key={room.id}>
            <strong>{room.room_number} - {room.name}</strong>
            <span>{room.hotels?.name} · {money(room.nightly_price)} · {room.capacity} pax</span>
          </div>
        ))}
      </div>
      <div className="panel">
        <div className="section-heading">
          <h2>Socios</h2>
          <Users />
        </div>
        {profiles.map((item) => (
          <div className="catalog-row" key={item.id}>
            <strong>{item.full_name}</strong>
            <span>{item.role} · {item.active ? "activo" : "inactivo"}</span>
          </div>
        ))}
      </div>
    </section>
  );
}

function ReservationTable({
  reservations,
  admin = false,
  onApprove,
  onCancel,
  enforceCancelPolicy = false,
}: {
  reservations: Reservation[];
  admin?: boolean;
  onApprove?: (id: string) => void;
  onCancel?: (reservation: Reservation) => void;
  enforceCancelPolicy?: boolean;
}) {
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            {admin && <th>Socio</th>}
            <th>Hotel</th>
            <th>Habitación</th>
            <th>Capacidad</th>
            <th>Personas</th>
            <th>Huéspedes</th>
            <th>Entrada</th>
            <th>Salida</th>
            <th>Estado</th>
            <th>Acciones</th>
          </tr>
        </thead>
        <tbody>
          {reservations.map((reservation) => (
            <tr key={reservation.id}>
              {admin && <td>{reservation.profiles?.full_name}</td>}
              <td>{reservation.hotels?.name}</td>
              <td>{reservation.rooms?.room_number} - {reservation.rooms?.name}</td>
              <td>{reservation.rooms?.capacity ? `${reservation.rooms.capacity} máx.` : "Sin dato"}</td>
              <td>{reservationGuestCount(reservation)} persona{reservationGuestCount(reservation) === 1 ? "" : "s"}</td>
              <td>
                {reservation.guest_names?.length ? (
                  <div className="guest-chip-list">
                    {reservation.guest_names.map((name) => (
                      <span key={`${reservation.id}-${name}`}>{name}</span>
                    ))}
                  </div>
                ) : (
                  <span className="table-note">Sin nombres registrados</span>
                )}
              </td>
              <td>{reservation.check_in}</td>
              <td>{reservation.check_out}</td>
              <td><span className={`status ${reservation.status}`}>{statusLabels[reservation.status]}</span></td>
              <td>
                <div className="action-row">
                  {admin && reservation.status === "pendiente" && (
                    <button className="icon-button approve" onClick={() => onApprove?.(reservation.id)} title="Aprobar">
                      <CheckCircle2 size={18} />
                    </button>
                  )}
                  {reservation.status !== "cancelada" && (!enforceCancelPolicy || canMemberCancel(reservation.check_in)) && (
                    <button className="icon-button danger" onClick={() => onCancel?.(reservation)} title="Cancelar">
                      <XCircle size={18} />
                    </button>
                  )}
                  {reservation.status !== "cancelada" && enforceCancelPolicy && !canMemberCancel(reservation.check_in) && (
                    <span className="blocked-note">Fuera de plazo</span>
                  )}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {reservations.length === 0 && <p className="muted empty-state">No hay reservas para mostrar.</p>}
    </div>
  );
}
