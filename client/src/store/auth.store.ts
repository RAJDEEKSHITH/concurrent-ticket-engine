import { create } from "zustand";
import { apiClient } from "../api/client";
import type { User } from "../types";

interface AuthState {
  user: User | null;
  isInitialized: boolean;
  isSubmitting: boolean;
  error: string | null;
  checkAuth: () => Promise<void>;
  login: (email: string, password: string) => Promise<boolean>;
  register: (email: string, password: string) => Promise<boolean>;
  logout: () => Promise<void>;
  clearError: () => void;
}

export const useAuthStore = create<AuthState>()((set) => ({
  user: null,
  isInitialized: false,
  isSubmitting: false,
  error: null,

  checkAuth: async () => {
    try {
      const res = await apiClient.getMe();
      set({ user: res.ok ? res.data : null, isInitialized: true });
    } catch {
      set({ user: null, isInitialized: true });
    }
  },

  login: async (email, password) => {
    set({ isSubmitting: true, error: null });
    const res = await apiClient.login(email, password);
    if (res.ok) {
      set({ user: res.data, isSubmitting: false, error: null });
      return true;
    }
    set({ error: res.error ?? "Invalid email or password", isSubmitting: false });
    return false;
  },

  register: async (email, password) => {
    set({ isSubmitting: true, error: null });
    const res = await apiClient.register(email, password);
    if (res.ok) {
      set({ user: res.data, isSubmitting: false, error: null });
      return true;
    }
    set({ error: res.error ?? "Registration failed", isSubmitting: false });
    return false;
  },

  logout: async () => {
    await apiClient.logout();
    set({ user: null, error: null });
  },

  clearError: () => set({ error: null }),
}));