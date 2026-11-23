'use client';

import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { api, type Site } from '@/lib/api';
import { useSession } from '@/lib/session';

interface SitesContextValue {
  sites: Site[];
  loading: boolean;
  error: string | null;
  siteId: string;
  selectSite: (id: string) => void;
  favoriteSiteId: string | null;
  favoriteBusy: boolean;
  preferenceError: string | null;
  setFavorite: (id: string | null) => Promise<void>;
  addSite: (site: Site) => void;
  removeSite: (id: string) => void;
  reload: () => void;
}
const SitesContext = createContext<SitesContextValue | null>(null);

export function SitesProvider({ children }: { children: ReactNode }) {
  const user = useSession();
  // A new account/workspace must never inherit the previous account's selection.
  return <SitesState key={`${user.tenantId}:${user.id}`}>{children}</SitesState>;
}

function SitesState({ children }: { children: ReactNode }) {
  const removedIds = useRef(new Set<string>());
  const [sites, setSites] = useState<Site[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState('');
  const [favoriteSiteId, setFavoriteSiteId] = useState<string | null>(null);
  const [favoriteBusy, setFavoriteBusy] = useState(false);
  const [preferenceError, setPreferenceError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const reload = useCallback(() => setAttempt(value => value + 1), []);
  const selectSite = useCallback((id: string) => { if (sites.some(site => site.id === id)) setSelected(id); }, [sites]);

  useEffect(() => {
    let active = true;
    setLoading(true); setError(null); setPreferenceError(null);
    void Promise.allSettled([api.get<Site[]>('/sites'), api.get<{ favoriteSiteId: string | null }>('/auth/preferences')]).then(([list, preferences]) => {
      if (!active) return;
      if (list.status === 'rejected') { setError('Não foi possível carregar os sites. Tente novamente.'); setLoading(false); return; }
      list.value = list.value.filter(site => !removedIds.current.has(site.id));
      const favorite = preferences.status === 'fulfilled' && list.value.some(site => site.id === preferences.value.favoriteSiteId) ? preferences.value.favoriteSiteId : null;
      if (preferences.status === 'rejected') setPreferenceError('Não foi possível consultar seu favorito. Tente novamente.');
      setSites(list.value); setFavoriteSiteId(favorite);
      setSelected(current => list.value.some(site => site.id === current) ? current : favorite ?? list.value[0]?.id ?? '');
      setLoading(false);
    });
    return () => { active = false; };
  }, [attempt]);

  async function setFavorite(id: string | null) {
    if (favoriteBusy || (id !== null && !sites.some(site => site.id === id))) return;
    setFavoriteBusy(true); setPreferenceError(null);
    try {
      const saved = await api.put<{ favoriteSiteId: string | null }>('/auth/preferences', { favoriteSiteId: id });
      setFavoriteSiteId(saved.favoriteSiteId && removedIds.current.has(saved.favoriteSiteId) ? null : saved.favoriteSiteId);
    } catch {
      setPreferenceError('Não foi possível salvar seu favorito. Sua preferência anterior foi mantida. Tente novamente.');
    } finally { setFavoriteBusy(false); }
  }

  function removeSite(id: string) {
    removedIds.current.add(id);
    setSites(current => current.filter(site => site.id !== id));
    setFavoriteSiteId(current => current === id ? null : current);
  }
  const siteId = sites.some(site => site.id === selected) ? selected : sites.find(site => site.id === favoriteSiteId)?.id ?? sites[0]?.id ?? '';
  return <SitesContext.Provider value={{ sites, loading, error, siteId, selectSite, favoriteSiteId, favoriteBusy, preferenceError, setFavorite, addSite: site => { setSites(current => [site, ...current]); setSelected(current => current || site.id); }, removeSite, reload }}>{children}</SitesContext.Provider>;
}

export function useSites(): SitesContextValue {
  const value = useContext(SitesContext);
  if (!value) throw new Error('useSites must be used inside SitesProvider');
  return value;
}
