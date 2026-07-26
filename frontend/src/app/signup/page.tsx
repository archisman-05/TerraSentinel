'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/authStore';
import { Activity, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';
import Link from 'next/link';

const SKILLS_OPTIONS = ['medical','driving','cooking','construction','teaching','counseling','logistics','translation','IT support','fundraising'];

export default function SignupPage() {
  const router         = useRouter();
  const { signup }     = useAuthStore();
  const [form, setForm] = useState({ email:'', password:'', full_name:'', role:'volunteer', phone:'', skills:[] as string[] });
  const [loading, setLoading] = useState(false);

  const toggleSkill = (s: string) =>
    setForm(f => ({ ...f, skills: f.skills.includes(s) ? f.skills.filter(x=>x!==s) : [...f.skills, s] }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await signup(form);
      toast.success('Account created!');
      router.push('/dashboard');
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message || 'Signup failed';
      toast.error(msg);
    } finally { setLoading(false); }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-brand-50 via-white to-blue-50 dark:from-ink-950 dark:via-ink-950 dark:to-slate-900 flex items-center justify-center p-4 text-gray-900 dark:text-white">
      <div className="w-full max-w-md">
        <div className="flex flex-col items-center mb-8">
          <div className="w-12 h-12 bg-brand-600 rounded-2xl flex items-center justify-center shadow-lg mb-3">
            <Activity className="w-6 h-6 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Join NGO Resource</h1>
          <p className="text-sm text-gray-500">Make a difference in your community</p>
        </div>

        <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-md dark:border-white/10 dark:bg-white/5">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <label className="label">Full Name *</label>
                <input className="input" required value={form.full_name} onChange={e => setForm(f => ({ ...f, full_name: e.target.value }))} placeholder="Your full name" />
              </div>
              <div className="col-span-2">
                <label className="label">Email *</label>
                <input className="input" type="email" required value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} placeholder="you@example.com" />
              </div>
              <div className="col-span-2">
                <label className="label">Password *</label>
                <input className="input" type="password" required minLength={8} value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))} placeholder="At least 8 characters" />
              </div>
              <div>
                <label className="label">Phone</label>
                <input className="input" type="tel" value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} placeholder="+91 ..." />
              </div>
              <div>
                <label className="label">Role *</label>
                <select className="input" value={form.role} onChange={e => setForm(f => ({ ...f, role: e.target.value }))}>
                  <option value="volunteer">Volunteer</option>
                  <option value="admin">NGO Admin</option>
                </select>
              </div>
            </div>

            {form.role === 'volunteer' && (
              <div>
                <label className="label">Skills (select all that apply)</label>
                <div className="flex flex-wrap gap-1.5 mt-1">
                  {SKILLS_OPTIONS.map(s => (
                    <button
                      key={s} type="button"
                      onClick={() => toggleSkill(s)}
                      className={`px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${form.skills.includes(s) ? 'bg-brand-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <button type="submit" className="btn-primary w-full" disabled={loading}>
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
              {loading ? 'Creating account…' : 'Create Account'}
            </button>
          </form>

          <p className="text-sm text-center text-gray-500 mt-4">
            Already have an account?{' '}
            <Link href="/login" className="text-brand-600 hover:underline font-medium">Sign in</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
