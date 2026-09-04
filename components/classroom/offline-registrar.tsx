'use client';

import { useEffect } from 'react';

export function OfflineRegistrar() {
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;
    if (location.hostname === 'localhost') {
      navigator.serviceWorker.getRegistrations().then((items) => items.forEach((item) => void item.unregister()));
      return;
    }
    navigator.serviceWorker.register('/sw.js').catch(() => undefined);
  }, []);
  return null;
}
