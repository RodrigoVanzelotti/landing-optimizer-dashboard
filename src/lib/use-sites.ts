'use client';

import { useEffect, useState } from 'react';
import { api, type Site } from '@/lib/api';

/** Loads the tenant's sites once and exposes selection state. */
export function useSites(): {
  sites: Site[];
  loading: boolean;
  error: string | null;
} {
  const [sites, setSites] = useState<Site[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    api
      .get<Site[]>('/sites')
      .then((data) => {
        if (active) setSites(data);
      })
      .catch((e: Error) => {
        if (active) setError(e.message);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  return { sites, loading, error };
}
