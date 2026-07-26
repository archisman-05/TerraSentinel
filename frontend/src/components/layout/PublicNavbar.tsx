'use client';

import Link from 'next/link';
import { Activity, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { useAuthStore } from '@/store/authStore';

export function PublicNavbar() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  return (
    <header className="sticky top-0 z-50 border-b border-gray-200/60 dark:border-white/10 bg-white/70 dark:bg-ink-950/70 backdrop-blur-xl">
      <div className="mx-auto max-w-6xl px-4 py-3 flex items-center gap-3">
        <Link href="/" className="flex items-center gap-2 group">
          <span className="h-9 w-9 rounded-xl bg-brand-600 flex items-center justify-center shadow-sm shadow-brand-600/25">
            <Activity className="h-4 w-4 text-white" />
          </span>
          <div className="leading-tight">
            <div className="text-sm font-extrabold tracking-tight text-gray-900 dark:text-white">
              TerraSentinel
            </div>
            <div className="text-[11px] text-gray-500 dark:text-white/55">Smart Emergency Resource Allocation Platform</div>
          </div>
        </Link>

        <nav className="hidden md:flex items-center gap-6 ml-6 text-sm font-semibold text-gray-600 dark:text-white/70">
          <a href="#features" className="hover:text-gray-900 dark:hover:text-white transition-colors">
            Features
          </a>
          <a href="#how" className="hover:text-gray-900 dark:hover:text-white transition-colors">
            How it works
          </a>
          <a href="#impact" className="hover:text-gray-900 dark:hover:text-white transition-colors">
            Impact
          </a>
        </nav>

        <div className="ml-auto flex items-center gap-2">
          {isAuthenticated ? (
            <Link href="/dashboard">
              <Button variant="secondary" size="sm" rightIcon={<ArrowRight className="h-4 w-4" />}>
                Dashboard
              </Button>
            </Link>
          ) : (
            <>
              <Link href="/login">
                <Button variant="secondary" size="sm">
                  Login
                </Button>
              </Link>
              <Link href="/signup">
                <Button size="sm" rightIcon={<ArrowRight className="h-4 w-4" />}>
                  Get Started
                </Button>
              </Link>
            </>
          )}
        </div>
      </div>
    </header>
  );
}

