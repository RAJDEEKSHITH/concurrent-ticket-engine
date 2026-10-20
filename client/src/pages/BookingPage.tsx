import { useEffect } from "react";
import { Navbar } from "../components/Navbar";
import { SeatGrid } from "../components/SeatGrid";
import { CheckoutCard } from "../components/CheckoutCard";
import { useAuthStore } from "../store/auth.store";
import { useSeatStore } from "../store/seat.store";
import type { SeatSSEEvent } from "../types";

export function BookingPage() {
  const user = useAuthStore((state) => state.user);
  const {
    seats,
    selectedSeatId,
    isActionLoading,
    banner,
    fetchSeats,
    selectSeat,
    holdSeat,
    confirmSeat,
    handleSSEEvent,
  } = useSeatStore();

  useEffect(() => {
    fetchSeats();

    const eventSource = new EventSource("http://localhost:4000/api/seats/stream");
    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data) as SeatSSEEvent;
        handleSSEEvent(data);
      } catch {
        // Ignore malformed SSE events
      }
    };

    return () => {
      eventSource.close();
    };
  }, [fetchSeats, handleSSEEvent]);

  const selectedSeat = seats.find((s) => s.id === selectedSeatId) ?? null;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
      <Navbar />

      <main className="w-full max-w-5xl mx-auto px-6 py-8 flex-1">
        {banner && (
          <div
            className={`mb-6 px-4 py-3 rounded-lg text-xs font-medium border ${
              banner.type === "error"
                ? "bg-rose-950/50 border-rose-800 text-rose-300"
                : banner.type === "success"
                ? "bg-emerald-950/50 border-emerald-800 text-emerald-300"
                : "bg-slate-900 border-slate-700 text-slate-200"
            }`}
          >
            {banner.text}
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2">
            <SeatGrid
              seats={seats}
              currentUserId={user?.userId ?? ""}
              selectedSeatId={selectedSeatId}
              onSelectSeat={selectSeat}
            />
          </div>

          <div>
            <CheckoutCard
              seat={selectedSeat}
              currentUserId={user?.userId ?? ""}
              isLoading={isActionLoading}
              onHold={holdSeat}
              onConfirm={confirmSeat}
            />
          </div>
        </div>
      </main>
    </div>
  );
}