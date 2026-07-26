'use client';

import { Moon, Sun } from 'lucide-react';
import { useThemeStore } from '@/store/themeStore';
import { Button } from '@/components/ui/Button';

export function ThemeToggle({ variant = 'ghost' }: { variant?: 'ghost' | 'secondary' }) {
  const resolved = useThemeStore((s) => s.resolved);
  const preference = useThemeStore((s) => s.preference);
  const setPreference = useThemeStore((s) => s.setPreference);

  const isDark = resolved === 'dark';
  const next = isDark ? 'light' : 'dark';

  return (
    <Button
      type="button"
      variant={variant}
      size="sm"
      onClick={() => setPreference(next)}
      aria-label={`Switch to ${next} mode${preference === 'system' ? ' (currently following system)' : ''}`}
      leftIcon={isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
      className="rounded-xl"
    >
      {isDark ? 'Light' : 'Dark'}
    </Button>
  );
}

