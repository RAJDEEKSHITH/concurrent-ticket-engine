export type SeatStatus = "AVAILABLE" | "HELD" | "BOOKED";

export interface Seat {
  id: string;
  rowLabel: string;
  seatNumber: number;
  priceCents: number;
  status: SeatStatus;
  heldByUserId: string | null;
  heldUntil: string | null;
  version: number;
}

export interface User {
  userId: string;
  email: string;
}

export interface SeatSSEEvent {
  type: "SEAT_UPDATED" | "SYSTEM_RESET";
  seatId?: string;
  status?: SeatStatus;
  heldByUserId?: string | null;
  heldUntil?: string | null;
  version?: number;
}