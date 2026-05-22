import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

export type UserRole = 'admin' | 'editor' | 'reviewer';

export interface AuthUser {
  id: string;
  email: string;
  role: UserRole;
}

interface AuthState {
  currentUser: AuthUser | null;
  isLoading: boolean;
  setUser: (user: AuthUser) => void;
  clearUser: () => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      currentUser: null,
      isLoading: false,

      setUser: (user: AuthUser) => set({ currentUser: user, isLoading: false }),

      clearUser: () => set({ currentUser: null, isLoading: false }),

      logout: () => {
        set({ currentUser: null, isLoading: false });
      },
    }),
    {
      name: 'knitting-admin-auth',
      storage: createJSONStorage(() =>
        typeof window !== 'undefined' ? sessionStorage : {
          getItem: () => null,
          setItem: () => {},
          removeItem: () => {},
        }
      ),
      partialize: (state) => ({ currentUser: state.currentUser }),
    },
  ),
);
