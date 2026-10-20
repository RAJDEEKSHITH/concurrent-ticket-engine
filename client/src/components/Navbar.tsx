import { Ticket, LogOut } from "lucide-react";
import { useAuthStore } from "../store/auth.store";

export function Navbar() {
  const user = useAuthStore((state) => state.user);
  const logout = useAuthStore((state) => state.logout);

  return (
    <header className="w-full border-b border-slate-800 bg-slate-900/60">
      <div className="max-w-5xl mx-auto px-6 h-16 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <Ticket className="w-5 h-5 text-emerald-400" />
          <span className="font-semibold text-slate-100 tracking-tight">
            IMAX Seat Reservation
          </span>
        </div>

        {user && (
          <div className="flex items-center gap-4">
            <span className="text-xs text-slate-400">
              Signed in as <strong className="text-slate-200">{user.email}</strong>
            </span>
            <button
              onClick={logout}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-slate-800 hover:bg-slate-700 text-xs font-medium text-slate-200 transition"
            >
              <LogOut className="w-3.5 h-3.5" />
              Logout
            </button>
          </div>
        )}
      </div>
    </header>
  );
}