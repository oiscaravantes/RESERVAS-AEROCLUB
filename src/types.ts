export type Role = "admin" | "socio";
export type ReservationStatus = "pendiente" | "aprobada" | "cancelada";

export type Profile = {
  id: string;
  full_name: string;
  member_code: string | null;
  role: Role;
  phone: string | null;
  active: boolean;
  created_at: string;
};

export type Hotel = {
  id: string;
  name: string;
  location: string;
  active: boolean;
};

export type RoomCategory = {
  id: string;
  name: string;
  description: string | null;
  base_price: number;
  active: boolean;
};

export type Room = {
  id: string;
  hotel_id: string;
  category_id: string | null;
  room_number: string;
  name: string;
  capacity: number;
  nightly_price: number;
  active: boolean;
  notes: string | null;
  hotels?: Hotel;
  room_categories?: RoomCategory | null;
};

export type Reservation = {
  id: string;
  member_id: string;
  hotel_id: string;
  room_id: string;
  check_in: string;
  check_out: string;
  guests: number;
  guest_names: string[] | null;
  status: ReservationStatus;
  comments: string | null;
  created_at: string;
  updated_at: string;
  profiles?: Profile;
  hotels?: Hotel;
  rooms?: Room;
};

export type ClubRule = {
  id: string;
  title: string;
  content: string;
  active: boolean;
  sort_order: number;
};
