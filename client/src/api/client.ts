import type { Seat, User } from "../types";

const API_BASE = "http://localhost:4000/api";

interface ApiResult<T> {
  ok: boolean;
  status: number;
  data: T;
  error?: string;
}

async function request<T>(path: string, options?: RequestInit): Promise<ApiResult<T>> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...options?.headers,
    },
  });

  const payload = await res.json().catch(() => ({}));

  return {
    ok: res.ok,
    status: res.status,
    data: payload as T,
    error: payload?.error,
  };
}

export const apiClient = {
  getMe: () => request<User>("/auth/me", { method: "GET" }),

  login: (email: string, password: string) =>
    request<User>("/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    }),

  register: (email: string, password: string) =>
    request<User>("/auth/register", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    }),

  logout: () => request<{ message: string }>("/auth/logout", { method: "POST" }),

  getSeats: () => request<Seat[]>("/seats", { method: "GET" }),

  holdSeat: (seatId: string) =>
    request<Seat>(`/seats/${seatId}/hold`, { method: "POST" }),

  confirmSeat: (seatId: string, outcome: "SUCCESS" | "FAIL") => {
    const idempotencyKey = `idemp_${seatId}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    return request<{ bookingId: string; seatId: string; status: string; version: number }>(
      `/seats/${seatId}/confirm`,
      {
        method: "POST",
        body: JSON.stringify({ outcome, idempotencyKey }),
      }
    );
  },
};