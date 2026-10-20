import { useEffect, useState } from "react";
import { Clock, Lock, CheckCircle2, XCircle } from "lucide-react";
import type { Seat } from "../types";

interface CheckoutCardProps {
  seat: Seat | null;
  currentUserId: string;
  isLoading: boolean;
  onHold: (seatId: string) => void;
  onConfirm: (seatId: string, outcome: "SUCCESS" | "FAIL") => void;
}

function formatTimer(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

export function CheckoutCard({
  seat,
  currentUserId,
  isLoading,
  onHold,
  onConfirm,
}: CheckoutCardProps) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, []);

  if (!seat) {
    return (
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
        <h2 className="text-sm font-semibold text-slate-200 mb-1">Booking Summary</h2>
        <p className="text-xs text-slate-400">
          Select an available seat from the auditorium map to reserve and complete checkout.
        </p>
      </div>
    );
  }

  const isHeldByMe = seat.status === "HELD" && seat.heldByUserId === currentUserId;
  const isHeldByOther = seat.status === "HELD" && seat.heldByUserId !== currentUserId;

  const remainingSeconds =
    seat.status === "HELD" && seat.heldUntil
      ? Math.max(0, Math.ceil((new Date(seat.heldUntil).getTime() - now) / 1000))
      : 0;

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
      <div className="flex items-center justify-between border-b border-slate-800 pb-3">
        <div>
          <span className="text-xs text-slate-400 block">Selected Seat</span>
          <span className="text-lg font-bold text-white">
            Row {seat.rowLabel} • Seat {seat.id}
          </span>
        </div>
        <div className="text-right">
          <span className="text-xs text-slate-400 block">Price</span>
          <span className="text-base font-semibold text-emerald-400">
            ₹{(seat.priceCents / 100).toFixed(2)}
          </span>
        </div>
      </div>

      {seat.status === "AVAILABLE" && (
        <div className="space-y-3">
          <p className="text-xs text-slate-400">
            Holding this seat reserves it exclusively for you for 2 minutes while you complete payment.
          </p>
          <button
            type="button"
            disabled={isLoading}
            onClick={() => onHold(seat.id)}
            className="w-full flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white py-2.5 rounded-lg text-xs font-semibold transition"
          >
            <Lock className="w-4 h-4" />
            {isLoading ? "Locking Seat..." : `Hold Seat ${seat.id}`}
          </button>
        </div>
      )}

      {isHeldByMe && (
        <div className="space-y-3">
          <div className="flex items-center justify-between bg-emerald-950/40 border border-emerald-800/70 rounded-lg px-3 py-2 text-xs text-emerald-300">
            <span className="flex items-center gap-1.5">
              <Clock className="w-4 h-4" />
              Hold Expires In:
            </span>
            <span className="font-mono font-bold text-sm">
              {formatTimer(remainingSeconds)}
            </span>
          </div>

          <button
            type="button"
            disabled={isLoading || remainingSeconds === 0}
            onClick={() => onConfirm(seat.id, "SUCCESS")}
            className="w-full flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white py-2.5 rounded-lg text-xs font-semibold transition"
          >
            <CheckCircle2 className="w-4 h-4" />
            {isLoading ? "Processing..." : "Pay & Confirm Booking"}
          </button>

          <button
            type="button"
            disabled={isLoading}
            onClick={() => onConfirm(seat.id, "FAIL")}
            className="w-full flex items-center justify-center gap-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 py-2.5 rounded-lg text-xs font-semibold transition"
          >
            <XCircle className="w-4 h-4" />
            Simulate Payment Failure (Release Seat)
          </button>
        </div>
      )}

      {isHeldByOther && (
        <div className="space-y-2 bg-amber-950/30 border border-amber-800/60 rounded-lg p-3 text-xs text-amber-300">
          <div className="flex items-center justify-between">
            <span>Currently held by another customer</span>
            <span className="font-mono font-semibold">{formatTimer(remainingSeconds)}</span>
          </div>
          <p className="text-slate-400">
            If unpaid when the timer reaches 00:00, this seat will automatically become available.
          </p>
        </div>
      )}

      {seat.status === "BOOKED" && (
        <div className="bg-rose-950/30 border border-rose-800/60 rounded-lg p-3 text-xs text-rose-300">
          This seat has already been purchased. Please select another seat.
        </div>
      )}
    </div>
  );
}