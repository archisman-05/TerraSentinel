'use client';

import { useEffect } from 'react';
import Lenis from 'lenis';

let lenisInstance: Lenis | null = null;
let lenisRafId: number | null = null;
let lenisConsumers = 0;

export function SmoothScroll({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    lenisConsumers += 1;
    if (!lenisInstance) {
      lenisInstance = new Lenis({
        duration: 1.05,
        smoothWheel: true,
        wheelMultiplier: 0.95,
        touchMultiplier: 1.0,
        syncTouch: true,
        syncTouchLerp: 0.08,
      });
    }
    if (lenisRafId == null) {
      const raf = (time: number) => {
        lenisInstance?.raf(time);
        lenisRafId = requestAnimationFrame(raf);
      };
      lenisRafId = requestAnimationFrame(raf);
    }

    return () => {
      lenisConsumers = Math.max(0, lenisConsumers - 1);
      if (lenisConsumers === 0) {
        if (lenisRafId != null) {
          cancelAnimationFrame(lenisRafId);
          lenisRafId = null;
        }
        lenisInstance?.destroy();
        lenisInstance = null;
      }
    };
  }, []);

  return children;
}

