'use client';

import { useEffect } from 'react';
import { initSentryClient } from '@/lib/sentry';

let _initialized = false;

export default function SentryInit() {
  useEffect(() => {
    if (!_initialized) {
      _initialized = true;
      initSentryClient();
    }
  }, []);
  return null;
}
