'use client';

import { useEffect, useMemo, useRef, useState } from 'react';

function useInView<T extends HTMLElement>() {
  const ref = useRef<T | null>(null);
  const [inView, setInView] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) setInView(true);
      },
      { threshold: 0.25 }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  return { ref, inView };
}

function Counter({ to, suffix = '' }: { to: number; suffix?: string }) {
  const { ref, inView } = useInView<HTMLSpanElement>();
  const [val, setVal] = useState(0);

  useEffect(() => {
    if (!inView) return;
    const start = performance.now();
    const duration = 1100;
    const tick = (t: number) => {
      const p = Math.min(1, (t - start) / duration);
      const eased = 1 - Math.pow(1 - p, 3);
      setVal(Math.round(eased * to));
      if (p < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }, [inView, to]);

  return (
    <span ref={ref} className="tabular-nums">
      {val.toLocaleString()}
      {suffix}
    </span>
  );
}

export function ImpactStats() {
  const stats = useMemo(
    () => [
      { label: 'Requests matched', value: 18240, suffix: '+' },
      { label: 'Avg response time', value: 6, suffix: 'm' },
      { label: 'Active volunteers', value: 3100, suffix: '+' },
      { label: 'Cities covered', value: 42, suffix: '+' },
    ],
    []
  );

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      {stats.map((s) => (
        <div key={s.label} className="card-glass p-5">
          <div className="text-2xl font-extrabold tracking-tight text-gray-900 dark:text-white">
            <Counter to={s.value} suffix={s.suffix} />
          </div>
          <div className="mt-1 text-xs font-semibold text-gray-600 dark:text-white/60">{s.label}</div>
        </div>
      ))}
    </div>
  );
}

