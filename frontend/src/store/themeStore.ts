import { create } from 'zustand';

export type ThemePreference = 'system' | 'light' | 'dark';
export type ResolvedTheme = 'light' | 'dark';

const STORAGE_KEY = 'theme_preference';

function safeGetItem(key: string) {
  try {
    if (typeof window === 'undefined') return null;
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function safeSetItem(key: string, value: string) {
  try {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(key, value);
  } catch {}
}

function resolveTheme(pref: ThemePreference): ResolvedTheme {
  if (pref === 'light') return 'light';
  if (pref === 'dark') return 'dark';
  if (typeof window === 'undefined') return 'light';
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function applyThemeToDom(resolved: ResolvedTheme) {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  root.classList.toggle('dark', resolved === 'dark');
  root.style.colorScheme = resolved;
}

interface ThemeState {
  preference: ThemePreference;
  resolved: ResolvedTheme;
  setPreference: (pref: ThemePreference) => void;
  initFromStorage: () => void;
  syncSystem: () => void;
}

export const useThemeStore = create<ThemeState>((set, get) => ({
  preference: 'system',
  resolved: 'light',

  setPreference: (pref) => {
    safeSetItem(STORAGE_KEY, pref);
    const resolved = resolveTheme(pref);
    applyThemeToDom(resolved);
    set({ preference: pref, resolved });
  },

  initFromStorage: () => {
    const stored = safeGetItem(STORAGE_KEY) as ThemePreference | null;
    const pref: ThemePreference = stored === 'light' || stored === 'dark' || stored === 'system' ? stored : 'system';
    const resolved = resolveTheme(pref);
    applyThemeToDom(resolved);
    set({ preference: pref, resolved });
  },

  syncSystem: () => {
    const { preference } = get();
    if (preference !== 'system') return;
    const resolved = resolveTheme('system');
    applyThemeToDom(resolved);
    set({ resolved });
  },
}));

