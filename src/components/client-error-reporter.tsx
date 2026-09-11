'use client';

import { useEffect } from 'react';
import { installGlobalErrorReporting } from '@/lib/client-log';

/**
 * Mounts the window-level error/unhandledrejection catchers that forward
 * otherwise-untraced browser errors to the log relay. Renders nothing.
 */
export function ClientErrorReporter(): null {
  useEffect(() => {
    installGlobalErrorReporting();
  }, []);
  return null;
}
