import Link from 'next/link';
import { ArrowRight, BrainCircuit, Radar, ShieldAlert, Sparkles } from 'lucide-react';
import { PublicNavbar } from '@/components/layout/PublicNavbar';
import { ImpactStats } from '@/features/landing/ImpactStats';
import { Button } from '@/components/ui/Button';

export default function HomePage() {
  return (
    <div className="min-h-screen bg-surface-1 dark:bg-ink-950">
      <PublicNavbar />

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0">
          <div className="absolute -top-32 left-1/2 -translate-x-1/2 h-[520px] w-[920px] rounded-full bg-gradient-to-r from-brand-200/40 via-sky-200/35 to-emerald-200/40 blur-3xl dark:from-brand-500/10 dark:via-cyan-500/10 dark:to-emerald-500/10" />
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_10%,rgba(34,197,94,0.18),transparent_45%),radial-gradient(circle_at_70%_30%,rgba(59,130,246,0.14),transparent_50%)] dark:bg-[radial-gradient(circle_at_30%_10%,rgba(34,197,94,0.10),transparent_45%),radial-gradient(circle_at_70%_30%,rgba(34,211,238,0.08),transparent_50%)]" />
          <div className="absolute inset-0 opacity-[0.12] dark:opacity-[0.10] [background-image:linear-gradient(to_right,rgba(15,23,42,0.08)_1px,transparent_1px),linear-gradient(to_bottom,rgba(15,23,42,0.08)_1px,transparent_1px)] dark:[background-image:linear-gradient(to_right,rgba(255,255,255,0.08)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.08)_1px,transparent_1px)] [background-size:46px_46px]" />
        </div>

        <div className="relative mx-auto max-w-6xl px-4 pt-16 pb-12 md:pt-24 md:pb-20">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-gray-200 bg-white/70 dark:bg-white/5 dark:border-white/10 text-xs font-semibold text-gray-700 dark:text-white/70">
            <Sparkles className="h-3.5 w-3.5 text-brand-600" />
            NGO + AI + Real-time Resource Allocation
          </div>

          <h1 className="mt-5 text-4xl md:text-6xl font-black tracking-tight text-gray-900 dark:text-white">
            Coordinate help faster.
            <span className="block text-transparent bg-clip-text bg-gradient-to-r from-brand-700 via-emerald-600 to-sky-600 dark:from-brand-300 dark:via-emerald-200 dark:to-cyan-200">
              Respond smarter with AI.
            </span>
          </h1>

          <p className="mt-5 max-w-2xl text-base md:text-lg text-gray-600 dark:text-white/70">
            A production-grade platform for NGOs and volunteers: live tracking, AI-assisted matching, and an SOS emergency
            system—built for real-world operations.
          </p>

          <div className="mt-8 flex flex-col sm:flex-row gap-3">
            <Link href="/login">
              <Button variant="secondary" size="lg">
                Login
              </Button>
            </Link>
            <Link href="/signup">
              <Button size="lg" rightIcon={<ArrowRight className="h-5 w-5" />}>
                Get Started
              </Button>
            </Link>
          </div>

          <div className="mt-10 grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="card-glass p-6 hover:translate-y-[-2px] transition-transform">
              <div className="h-10 w-10 rounded-xl bg-sky-500/10 text-sky-600 flex items-center justify-center">
                <Radar className="h-5 w-5" />
              </div>
              <div className="mt-3 font-bold text-gray-900 dark:text-white">Real-time tracking</div>
              <div className="mt-1 text-sm text-gray-600 dark:text-white/70">
                Live map, updates, and instant notifications across NGO teams and volunteers.
              </div>
            </div>
            <div className="card-glass p-6 hover:translate-y-[-2px] transition-transform">
              <div className="h-10 w-10 rounded-xl bg-emerald-500/10 text-emerald-600 flex items-center justify-center">
                <BrainCircuit className="h-5 w-5" />
              </div>
              <div className="mt-3 font-bold text-gray-900 dark:text-white">AI volunteer matching</div>
              <div className="mt-1 text-sm text-gray-600 dark:text-white/70">
                Match skills, availability, and proximity—prioritize urgent needs with intelligent scoring.
              </div>
            </div>
            <div className="card-glass p-6 hover:translate-y-[-2px] transition-transform">
              <div className="h-10 w-10 rounded-xl bg-red-500/10 text-red-600 flex items-center justify-center">
                <ShieldAlert className="h-5 w-5" />
              </div>
              <div className="mt-3 font-bold text-gray-900 dark:text-white">Emergency response</div>
              <div className="mt-1 text-sm text-gray-600 dark:text-white/70">
                One-tap SOS alerts responders nearby, with map highlight and rapid triage.
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="mx-auto max-w-6xl px-4 py-14 md:py-18">
        <div className="flex items-end justify-between gap-6">
          <div>
            <div className="text-sm font-extrabold text-brand-700 dark:text-brand-300">Features</div>
            <h2 className="mt-2 text-2xl md:text-3xl font-black tracking-tight text-gray-900 dark:text-white">
              Built for production teams, not demos
            </h2>
          </div>
          <div className="hidden md:block text-sm text-gray-600 dark:text-white/65 max-w-md">
            Consistent UI primitives, accessible interactions, and real-time workflows that stay fast under load.
          </div>
        </div>

        <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-4">
          {[
            {
              title: 'Real-time tracking',
              body: 'Socket-powered updates for map movement, tasks, and assignments—no manual refresh loops.',
            },
            {
              title: 'AI-powered insights',
              body: 'Generate summaries and priority scoring to focus resources where they matter most.',
            },
            {
              title: 'Operational dashboards',
              body: 'Clean tables, cards, and modals designed for fast scanning and decision-making.',
            },
          ].map((f) => (
            <div key={f.title} className="card-glass p-6 hover:shadow-xl hover:shadow-black/5 dark:hover:shadow-black/40 transition-shadow">
              <div className="font-extrabold text-gray-900 dark:text-white">{f.title}</div>
              <div className="mt-2 text-sm text-gray-600 dark:text-white/70">{f.body}</div>
            </div>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section id="how" className="mx-auto max-w-6xl px-4 pb-14 md:pb-18">
        <div className="card-glass p-8 md:p-10">
          <div className="text-sm font-extrabold text-brand-700 dark:text-brand-300">How it works</div>
          <h2 className="mt-2 text-2xl md:text-3xl font-black tracking-tight text-gray-900 dark:text-white">
            3 steps to coordinated response
          </h2>

          <div className="mt-7 grid grid-cols-1 md:grid-cols-3 gap-4">
            {[
              { step: '01', title: 'Capture the need', body: 'Reports and tasks are created with location and urgency.' },
              { step: '02', title: 'Match & mobilize', body: 'AI ranks volunteers and dispatches assignments in real time.' },
              { step: '03', title: 'Track & close the loop', body: 'Live map visibility and completion signals keep teams aligned.' },
            ].map((s) => (
              <div key={s.step} className="rounded-2xl border border-gray-200 dark:border-white/10 bg-white/60 dark:bg-white/5 p-6">
                <div className="text-xs font-black text-gray-500 dark:text-white/45">{s.step}</div>
                <div className="mt-2 font-extrabold text-gray-900 dark:text-white">{s.title}</div>
                <div className="mt-2 text-sm text-gray-600 dark:text-white/70">{s.body}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Impact */}
      <section id="impact" className="mx-auto max-w-6xl px-4 pb-14 md:pb-18">
        <div className="flex items-end justify-between gap-6">
          <div>
            <div className="text-sm font-extrabold text-brand-700 dark:text-brand-300">Impact</div>
            <h2 className="mt-2 text-2xl md:text-3xl font-black tracking-tight text-gray-900 dark:text-white">
              Faster response, measurable outcomes
            </h2>
          </div>
          <div className="hidden md:block text-sm text-gray-600 dark:text-white/65 max-w-md">
            Animated counters highlight what teams achieve when allocation is automated and visibility is shared.
          </div>
        </div>
        <div className="mt-6">
          <ImpactStats />
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-gray-200/70 dark:border-white/10 bg-white/50 dark:bg-ink-950/40">
        <div className="mx-auto max-w-6xl px-4 py-10 flex flex-col md:flex-row gap-6 md:items-center">
          <div className="text-sm font-extrabold text-gray-900 dark:text-white">TerraSentinel</div>
          <div className="md:ml-auto text-xs text-gray-500 dark:text-white/55">
            © {new Date().getFullYear()} Built for real-world NGO operations.
          </div>
        </div>
      </footer>
    </div>
  );
}
