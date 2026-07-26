'use client';

import { useEffect } from 'react';
import { useThemeStore } from '@/store/themeStore';

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const initFromStorage = useThemeStore((s) => s.initFromStorage);
  const syncSystem = useThemeStore((s) => s.syncSystem);
  const preference = useThemeStore((s) => s.preference);

  useEffect(() => {
    initFromStorage();
  }, [initFromStorage]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const mql = window.matchMedia?.('(prefers-color-scheme: dark)');
    if (!mql) return;

    const onChange = () => syncSystem();
    onChange();

    // Safari fallback
    if (typeof mql.addEventListener === 'function') {
      mql.addEventListener('change', onChange);
      return () => mql.removeEventListener('change', onChange);
    }
    (mql as any).addListener?.(onChange);
    return () => (mql as any).removeListener?.(onChange);
  }, [syncSystem, preference]);

  return children;
}

