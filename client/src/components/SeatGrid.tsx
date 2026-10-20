import { useEffect, useState } from "react";
import type { Seat } from "../types";

interface SeatGridProps {
  seats: Seat[];
  currentUserId: string;
  selectedSeatId: string | null;
  onSelectSeat: (seatId: string) => void;
}

function formatSeconds(totalSeconds: number): string {
  const mins = Math.floor(totalSeconds / 60);
  const secs = totalSeconds % 60;
  return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
}

export function SeatGrid({
  seats,
  currentUserId,
  selectedSeatId,
  onSelectSeat,
}: SeatGridProps) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 flex flex-col items-center">
      <div className="w-3/4 h-1.5 bg-slate-700 rounded-full mb-2" />
      <p className="text-[11px] uppercase tracking-widest text-slate-400 mb-8">
        Screen — Auditorium 1
      </p>

      {seats.length === 0 ? (
        <div className="py-12 text-xs text-slate-500">
          No seats found. Make sure PostgreSQL is running and seeded.
        </div>
      ) : (
        <div className="grid grid-cols-10 gap-2.5 w-full max-w-xl">
          {seats.map((seat) => {
            const isBooked = seat.status === "BOOKED";
            const isHeld = seat.status === "HELD";
            const isHeldByMe = isHeld && seat.heldByUserId === currentUserId;
            const isSelected = selectedSeatId === seat.id;

            let secondsLeft = 0;
            if (isHeld && seat.heldUntil) {
              secondsLeft = Math.max(
                0,
                Math.ceil((new Date(seat.heldUntil).getTime() - now) / 1000)
              );
            }

            return (
              <button
                key={seat.id}
                type="button"
                onClick={() => onSelectSeat(seat.id)}
                className={`h-11 rounded-lg text-xs font-medium flex flex-col items-center justify-center border transition ${
                  isBooked
                    ? "bg-rose-950/40 border-rose-800/70 text-rose-400 cursor-not-allowed"
                    : isHeldByMe
                    ? "bg-emerald-500/20 border-emerald-400 text-emerald-300"
                    : isHeld
                    ? "bg-amber-500/20 border-amber-500/70 text-amber-300"
                    : isSelected
                    ? "bg-slate-800 border-white text-white"
                    : "bg-slate-800/70 border-slate-700 text-slate-300 hover:border-slate-500"
                }`}
              >
                <span>{seat.id}</span>
                {isHeld && secondsLeft > 0 && (
                  <span className="text-[9px] font-mono leading-none mt-0.5">
                    {formatSeconds(secondsLeft)}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      )}

      <div className="flex flex-wrap gap-6 mt-8 pt-4 border-t border-slate-800 text-xs text-slate-400">
        <div className="flex items-center gap-2">
          <span className="w-3 h-3 rounded bg-slate-800 border border-slate-700" />
          Available
        </div>
        <div className="flex items-center gap-2">
          <span className="w-3 h-3 rounded bg-emerald-500/20 border border-emerald-400" />
          Held by You
        </div>
        <div className="flex items-center gap-2">
          <span className="w-3 h-3 rounded bg-amber-500/20 border border-amber-500" />
          Held by Another User
        </div>
        <div className="flex items-center gap-2">
          <span className="w-3 h-3 rounded bg-rose-950/40 border border-rose-800" />
          Booked
        </div>
      </div>
    </div>
  );
}