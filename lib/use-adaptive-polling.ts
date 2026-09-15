'use client';

import { useEffect } from 'react';

type AdaptivePollingOptions = {
  enabled?: boolean;
  intervalMs: number;
  idleAfterMs?: number;
};

export function useAdaptivePolling(
  poll: () => void | Promise<void>,
  { enabled = true, intervalMs, idleAfterMs = 60 * 60 * 1000 }: AdaptivePollingOptions,
) {
  useEffect(() => {
    if (!enabled) return;

    let cancelled = false;
    let running = false;
    let timer: number | null = null;
    let lastActivityAt = Date.now();

    const clearTimer = () => {
      if (timer !== null) {
        window.clearTimeout(timer);
        timer = null;
      }
    };

    const schedule = () => {
      clearTimer();
      if (cancelled || document.hidden || Date.now() - lastActivityAt >= idleAfterMs) return;
      timer = window.setTimeout(() => void run(), intervalMs);
    };

    const run = async () => {
      if (cancelled || running || document.hidden || Date.now() - lastActivityAt >= idleAfterMs) {
        schedule();
        return;
      }

      running = true;
      try {
        await poll();
      } finally {
        running = false;
        schedule();
      }
    };

    const markActive = () => {
      const wasIdle = Date.now() - lastActivityAt >= idleAfterMs;
      lastActivityAt = Date.now();
      if (wasIdle && !document.hidden) void run();
    };

    const handleVisibilityChange = () => {
      clearTimer();
      if (document.hidden) return;
      lastActivityAt = Date.now();
      void run();
    };

    window.addEventListener('pointerdown', markActive, { passive: true });
    window.addEventListener('touchstart', markActive, { passive: true });
    window.addEventListener('keydown', markActive);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    void run();

    return () => {
      cancelled = true;
      clearTimer();
      window.removeEventListener('pointerdown', markActive);
      window.removeEventListener('touchstart', markActive);
      window.removeEventListener('keydown', markActive);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [enabled, idleAfterMs, intervalMs, poll]);
}
