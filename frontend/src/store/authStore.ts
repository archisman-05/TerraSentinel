import { create } from 'zustand';
import { authApi } from '@/lib/api';

export interface UserProfile {
  skills: string[];
  languages?: string[];
  availability: string;
  address?: string;
  city: string;
  country?: string;
  rating: number;
  total_tasks_done: number;
  grace_points?: number;
  experience_years?: number;
  lat?: number | null;
  lng?: number | null;
  radius_km?: number;
  weekly_hours?: number;
  bio?: string;
}

export interface User {
  id: string;
  email: string;
  full_name: string;
  phone?: string | null;
  role: 'admin' | 'volunteer';
  avatar_url?: string | null;
  profile?: UserProfile;
}

interface AuthState {
  user: User | null;
  accessToken: string | null;
  refreshToken: string | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  hasHydratedAuth: boolean;

  login:    (email: string, password: string) => Promise<void>;
  signup:   (data: Record<string, unknown>) => Promise<void>;
  logout:   () => Promise<void>;
  fetchMe:  () => Promise<void>;
}

// SSR-safe localStorage helpers
const ls = {
  get: (key: string) => {
    try { return typeof window !== 'undefined' ? localStorage.getItem(key) : null; }
    catch { return null; }
  },
  set: (key: string, val: string) => {
    try { if (typeof window !== 'undefined') localStorage.setItem(key, val); } catch {}
  },
  del: (key: string) => {
    try { if (typeof window !== 'undefined') localStorage.removeItem(key); } catch {}
  },
};

export const useAuthStore = create<AuthState>((set, get) => ({
  // Start null on server — AuthBootstrap hydrates on client
  user:            null,
  accessToken:     null,
  refreshToken:    null,
  isLoading:       false,
  isAuthenticated: false,
  hasHydratedAuth: false,

  login: async (email, password) => {
    set({ isLoading: true });
    try {
      const res  = await authApi.login({ email, password });
      const { user, accessToken, refreshToken } = res.data.data;
      ls.set('accessToken',  accessToken);
      ls.set('refreshToken', refreshToken);
      set({ user, accessToken, refreshToken, isAuthenticated: true, isLoading: false, hasHydratedAuth: true });
    } catch (err) {
      set({ isLoading: false });
      throw err;
    }
  },

  signup: async (formData) => {
    set({ isLoading: true });
    try {
      const res  = await authApi.signup(formData);
      const { user, accessToken, refreshToken } = res.data.data;
      ls.set('accessToken',  accessToken);
      ls.set('refreshToken', refreshToken);
      set({ user, accessToken, refreshToken, isAuthenticated: true, isLoading: false, hasHydratedAuth: true });
    } catch (err) {
      set({ isLoading: false });
      throw err;
    }
  },

  logout: async () => {
    ls.del('accessToken');
    ls.del('refreshToken');
    set({ user: null, accessToken: null, refreshToken: null, isAuthenticated: false, hasHydratedAuth: true });
    window.location.href = '/login';
  },

  // Called once on client mount by AuthBootstrap
  fetchMe: async () => {
    const token = ls.get('accessToken');
    if (!token) { set({ isAuthenticated: false, hasHydratedAuth: true }); return; }

    // Optimistically set token so api calls can attach it
    set({ accessToken: token, refreshToken: ls.get('refreshToken') });

    try {
      const res = await authApi.me();
      set({ user: res.data.data as User, isAuthenticated: true, hasHydratedAuth: true });
    } catch (err: any) {
      // Keep session for transient backend errors; only hard-logout on auth failures.
      const status = err?.response?.status;
      if (status === 401 || status === 403) {
        ls.del('accessToken');
        ls.del('refreshToken');
        set({ user: null, accessToken: null, refreshToken: null, isAuthenticated: false, hasHydratedAuth: true });
        return;
      }
      set({ isAuthenticated: true, hasHydratedAuth: true });
    }
  },
}));
