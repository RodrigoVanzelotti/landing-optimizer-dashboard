'use client';

import * as React from 'react';
import { api, type Site } from './api';

/**
 * One shared site selection for the whole dashboard. Previously every page
 * silently pinned sites[0], which reads as broken the moment a tenant has two
 * sites. The selection lives in the sidebar, persists across reloads, and the
 * sites list is fetched once per session instead of once per page.
 */

const STORAGE_KEY = 'lo.selected-site';

export interface SiteContextValue {
  sites: Site[];
  loading: boolean;
  error: string | null;
  siteId: string;
  site: Site | undefined;
  setSiteId: (id: string) => void;
  refresh: () => Promise<void>;
}

const SiteContext = React.createContext<SiteContextValue | null>(null);

export function SiteProvider({ children }: { children: React.ReactNode }): React.ReactElement {
  const [sites, setSites] = React.useState<Site[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [siteId, setSiteIdState] = React.useState('');

  const adopt = React.useCallback((list: Site[]) => {
    setSites(list);
    setSiteIdState((current) => {
      const stored = current || readStored();
      if (stored && list.some((s) => s.id === stored)) return stored;
      return list[0]?.id ?? '';
    });
  }, []);

  const refresh = React.useCallback(async () => {
    try {
      adopt(await api.get<Site[]>('/sites'));
      setError(null);
    } catch (e) {
      setError((e as Error).message);
    }
  }, [adopt]);

  React.useEffect(() => {
    let active = true;
    api
      .get<Site[]>('/sites')
      .then((list) => {
        if (active) adopt(list);
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
  }, [adopt]);

  const setSiteId = React.useCallback((id: string) => {
    setSiteIdState(id);
    try {
      window.localStorage.setItem(STORAGE_KEY, id);
    } catch {
      /* storage may be blocked; selection still works for the session */
    }
  }, []);

  const value: SiteContextValue = {
    sites,
    loading,
    error,
    siteId,
    site: sites.find((s) => s.id === siteId),
    setSiteId,
    refresh,
  };
  return <SiteContext.Provider value={value}>{children}</SiteContext.Provider>;
}

export function useSite(): SiteContextValue {
  const ctx = React.useContext(SiteContext);
  if (!ctx) throw new Error('useSite must be used inside <SiteProvider>');
  return ctx;
}

function readStored(): string {
  try {
    return window.localStorage.getItem(STORAGE_KEY) ?? '';
  } catch {
    return '';
  }
}
