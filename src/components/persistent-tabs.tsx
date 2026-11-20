'use client';

import { useEffect, useState, type AnchorHTMLAttributes, type ReactNode } from 'react';

/** Keep tab changes in history without navigating/remounting the page. */
export function TabLink({ href, onClick, ...props }: AnchorHTMLAttributes<HTMLAnchorElement> & { href: string }) {
  return <a {...props} href={href} onClick={event => {
    onClick?.(event);
    if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || props.target) return;
    const url = new URL(href, window.location.href);
    if (url.origin !== window.location.origin || url.pathname !== window.location.pathname) return;
    event.preventDefault();
    if (url.href !== window.location.href) window.history.pushState(null, '', url);
  }} />;
}

/** Mount on first visit and preserve local state while another tab is visible. */
export function PersistentPanel({ active, children }: { active: boolean; children: ReactNode }) {
  const [visited, setVisited] = useState(active);
  useEffect(() => { if (active) setVisited(true); }, [active]);
  return <div hidden={!active}>{(active || visited) && children}</div>;
}
