'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'react-hot-toast';
import { useState, useEffect } from 'react';
import { useRealtimeNotifications } from '@/hooks/useSocket';
import { useAuthStore } from '@/store/authStore';
import { GlobalOverlays } from '@/components/layout/GlobalOverlays';

// This pattern avoids server/client mismatch that causes React hydration errors.
function AuthBootstrap() {
  const fetchMe = useAuthStore((s) => s.fetchMe);
  useEffect(() => {
    fetchMe();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  return null;
}

function RealtimeLayer() {
  useRealtimeNotifications();
  return null;
}

function BackendWarmup() {
  useEffect(() => {
    const runWarmup = async () => {
      if (typeof window === 'undefined') return;
      if (sessionStorage.getItem('backend_warmup_done') === '1') return;

      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api';
      const backendBase = apiUrl.replace(/\/api\/?$/, '');

      try {
        await fetch(`${backendBase}/health`, { method: 'GET' });
      } catch {
        // Ignore warmup errors; login flow handles actual auth failures separately.
      } finally {
        sessionStorage.setItem('backend_warmup_done', '1');
      }
    };

    runWarmup();
  }, []);

  return null;
}

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime:            60 * 1000,
            retry:                1,
            refetchOnWindowFocus: false,
          },
        },
      })
  );

  return (
    <QueryClientProvider client={queryClient}>
      <BackendWarmup />
      <AuthBootstrap />
      <RealtimeLayer />
      {children}
      <GlobalOverlays />
      <Toaster
        position="top-right"
        toastOptions={{
          duration: 4000,
          style: {
            borderRadius: '12px',
            background: '#0b0d14eb',
            color: '#f9fafb',
            fontSize: '13px',
            border: '1px solid rgba(255,255,255,0.08)',
            backdropFilter: 'blur(10px)',
          },
          success: { iconTheme: { primary: '#22c55e', secondary: '#fff' } },
          error: { iconTheme: { primary: '#ef4444', secondary: '#fff' } },
        }}
      />
    </QueryClientProvider>
  );
}
