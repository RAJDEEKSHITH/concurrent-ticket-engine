import React from "react";
import { Zap } from "lucide-react";
import type { StressTestMetrics } from "../types";

interface StressTestCardProps {
  targetSeatId: string;
  running: boolean;
  metrics: StressTestMetrics | null;
  onRunBurst: () => void;
}

export const StressTestCard: React.FC<StressTestCardProps> = ({
  targetSeatId,
  running,
  metrics,
  onRunBurst,
}) => {
  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
      <div className="flex items-center gap-2 mb-2">
        <Zap className="w-4 h-4 text-amber-400" />
        <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-400">
          Live Race-Condition Simulator
        </h2>
      </div>
      <p className="text-xs text-slate-500 mb-4">
        Fires <strong>100 simultaneous HTTP POST</strong> requests at Seat{" "}
        <span className="text-white font-semibold">{targetSeatId}</span> to prove atomic Redis Lua locking under burst contention.
      </p>

      <button
        disabled={running}
        onClick={onRunBurst}
        className="w-full bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/40 text-amber-300 py-2.5 rounded-lg text-xs font-semibold transition"
      >
        {running ? "Firing 100 Concurrent Requests..." : `Fire 100 Concurrent Requests at ${targetSeatId}`}
      </button>

      {metrics && (
        <div className="mt-4 bg-slate-950 border border-slate-800 rounded-lg p-3 text-xs space-y-1.5 font-mono">
          <div className="flex justify-between">
            <span className="text-slate-400">Target Seat:</span>
            <span className="text-white font-bold">{metrics.seatId}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-400">200 OK (Locks Won):</span>
            <span className="text-emerald-400 font-bold">{metrics.succeeded200}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-400">409 Conflict (Rejected):</span>
            <span className="text-amber-400 font-bold">{metrics.rejected409}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-400">Total Burst Time:</span>
            <span className="text-slate-200">{metrics.durationMs} ms</span>
          </div>
        </div>
      )}
    </div>
  );
};