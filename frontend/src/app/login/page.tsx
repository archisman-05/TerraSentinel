'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/authStore';
import { Activity, Loader2, Eye, EyeOff } from 'lucide-react';
import toast from 'react-hot-toast';
import Link from 'next/link';

export default function LoginPage() {
  const router          = useRouter();
  const { login }       = useAuthStore();
  const [form, setForm] = useState({ email: '', password: '' });
  const [loading, setLoading]   = useState(false);
  const [showPass, setShowPass] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await login(form.email, form.password);
      toast.success('Welcome back!');
      router.push('/dashboard');
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ||
        'Login failed';
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-brand-50 via-white to-blue-50 dark:from-ink-950 dark:via-ink-950 dark:to-slate-900 flex items-center justify-center p-4 text-gray-900 dark:text-white">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="flex flex-col items-center mb-8">
          <div className="w-14 h-14 bg-brand-600 rounded-2xl flex items-center justify-center shadow-lg mb-3">
            <Activity className="w-7 h-7 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900">TerraSentinel</h1>
          <p className="text-sm text-gray-500">Smart Emergency Resource Allocation System</p>
        </div>

        {/* Login form */}
        <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-md dark:border-white/10 dark:bg-white/5">
          <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-5">Sign in</h2>
          <div className="mb-4 rounded-xl border border-brand-200/70 bg-brand-50/70 dark:border-brand-400/25 dark:bg-brand-500/10 p-3 space-y-1">
            <p className="text-xs font-semibold text-brand-700 dark:text-brand-200">Demo Credentials</p>
            <p className="text-xs text-gray-700 dark:text-white/80">
              Admin: <span className="font-mono">admin@gmail.com</span> / <span className="font-mono">admin123</span>
            </p>
            <p className="text-xs text-gray-700 dark:text-white/80">
              Volunteer: <span className="font-mono">volunteer@gmail.com</span> / <span className="font-mono">vol12345</span>
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="label">Email</label>
              <input
                className="input"
                type="email"
                required
                autoComplete="email"
                placeholder="you@example.com"
                value={form.email}
                onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
              />
            </div>
            <div>
              <label className="label">Password</label>
              <div className="relative">
                <input
                  className="input pr-10"
                  type={showPass ? 'text' : 'password'}
                  required
                  placeholder="••••••••"
                  value={form.password}
                  onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                />
                <button
                  type="button"
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700 dark:text-white/60 dark:hover:text-white"
                  onClick={() => setShowPass(s => !s)}
                >
                  {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
            <button type="submit" className="btn-primary w-full justify-center" disabled={loading}>
              {loading && <Loader2 className="w-4 h-4 animate-spin" />}
              {loading ? 'Signing in…' : 'Sign In'}
            </button>
          </form>

          <p className="text-sm text-center text-gray-500 dark:text-white/65 mt-4">
            Don&apos;t have an account?{' '}
            <Link href="/signup" className="text-brand-600 hover:underline font-medium">
              Sign up
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
