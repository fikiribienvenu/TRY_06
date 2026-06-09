import { create } from "zustand";
import { persist } from "zustand/middleware";
import Cookies from "js-cookie";
import type { User } from "@/types";

interface AuthStore {
  user: User | null;
  accessToken: string | null;
  refreshToken: string | null;
  isAuthenticated: boolean;
  mustChangePassword: boolean;
  setAuth: (data: {
    user: User;
    accessToken: string;
    refreshToken: string;
    mustChangePassword: boolean;
  }) => void;
  setUser: (user: User) => void;
  clearAuth: () => void;
  setMustChangePassword: (val: boolean) => void;
}

export const useAuthStore = create<AuthStore>()(
  persist(
    (set) => ({
      user: null,
      accessToken: null,
      refreshToken: null,
      isAuthenticated: false,
      mustChangePassword: false,

      setAuth: ({ user, accessToken, refreshToken, mustChangePassword }) => {
        Cookies.set("access_token", accessToken, { expires: 1, secure: true, sameSite: "strict" });
        Cookies.set("refresh_token", refreshToken, { expires: 7, secure: true, sameSite: "strict" });
        set({ user, accessToken, refreshToken, isAuthenticated: true, mustChangePassword });
      },

      setUser: (user) => set({ user }),

      clearAuth: () => {
        Cookies.remove("access_token");
        Cookies.remove("refresh_token");
        set({ user: null, accessToken: null, refreshToken: null, isAuthenticated: false, mustChangePassword: false });
      },

      setMustChangePassword: (val) => set({ mustChangePassword: val }),
    }),
    {
      name: "pulmoscan-auth",
      partialize: (state) => ({
        user: state.user,
        accessToken: state.accessToken,
        refreshToken: state.refreshToken,
        isAuthenticated: state.isAuthenticated,
        mustChangePassword: state.mustChangePassword,
      }),
    }
  )
);
