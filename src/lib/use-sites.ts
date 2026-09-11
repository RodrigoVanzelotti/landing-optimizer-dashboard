'use client';

import { useSite } from './site-context';
import type { Site } from './api';

/**
 * Back-compat wrapper over the shared SiteProvider. Pages that only need the
 * list keep working; pages that need the SELECTED site should use `useSite()`
 * from site-context instead.
 */
export function useSites(): {
  sites: Site[];
  loading: boolean;
  error: string | null;
} {
  const { sites, loading, error } = useSite();
  return { sites, loading, error };
}
