import { create } from "zustand";
import { apiClient } from "../api/client";
import type { Seat, SeatSSEEvent } from "../types";

interface BannerMessage {
  text: string;
  type: "success" | "error" | "info";
}

interface SeatState {
  seats: Seat[];
  selectedSeatId: string | null;
  isLoadingSeats: boolean;
  isActionLoading: boolean;
  banner: BannerMessage | null;
  fetchSeats: () => Promise<void>;
  selectSeat: (seatId: string) => void;
  holdSeat: (seatId: string) => Promise<void>;
  confirmSeat: (seatId: string, outcome: "SUCCESS" | "FAIL") => Promise<void>;
  handleSSEEvent: (event: SeatSSEEvent) => void;
  clearBanner: () => void;
}

export const useSeatStore = create<SeatState>()((set, get) => ({
  seats: [],
  selectedSeatId: null,
  isLoadingSeats: false,
  isActionLoading: false,
  banner: null,

  fetchSeats: async () => {
    set({ isLoadingSeats: true });
    const res = await apiClient.getSeats();
    if (res.ok && Array.isArray(res.data)) {
      set({ seats: res.data, isLoadingSeats: false });
    } else {
      set({
        isLoadingSeats: false,
        banner: { text: "Unable to load seats from server.", type: "error" },
      });
    }
  },

  selectSeat: (seatId) => {
    set({ selectedSeatId: seatId, banner: null });
  },

  holdSeat: async (seatId) => {
    set({ isActionLoading: true, banner: null });
    const res = await apiClient.holdSeat(seatId);
    set({ isActionLoading: false });

    if (res.ok) {
      set({
        selectedSeatId: seatId,
        banner: {
          text: `Seat ${seatId} locked for 2 minutes. Complete payment before the timer expires.`,
          type: "info",
        },
      });
    } else {
      set({
        banner: {
          text: res.error ?? `Seat ${seatId} could not be locked (409 Conflict).`,
          type: "error",
        },
      });
    }
  },

  confirmSeat: async (seatId, outcome) => {
    set({ isActionLoading: true, banner: null });
    const res = await apiClient.confirmSeat(seatId, outcome);
    set({ isActionLoading: false });

    if (res.ok) {
      set({
        banner: {
          text: `Booking confirmed for Seat ${seatId} (Ref: ${res.data.bookingId}).`,
          type: "success",
        },
      });
    } else {
      set({
        banner: {
          text: res.error ?? "Payment failed. Seat lock has been released.",
          type: "error",
        },
      });
    }
  },

  handleSSEEvent: (payload) => {
    if (payload.type === "SYSTEM_RESET") {
      get().fetchSeats();
      return;
    }

    if (payload.type === "SEAT_UPDATED" && payload.seatId && payload.status) {
      set((state) => ({
        seats: state.seats.map((seat) =>
          seat.id === payload.seatId
            ? {
                ...seat,
                status: payload.status!,
                heldByUserId: payload.heldByUserId ?? null,
                heldUntil: payload.heldUntil ?? null,
                version: payload.version ?? seat.version,
              }
            : seat
        ),
      }));
    }
  },

  clearBanner: () => set({ banner: null }),
}));