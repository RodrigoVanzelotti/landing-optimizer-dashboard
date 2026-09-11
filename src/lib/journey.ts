'use client';

import { useEffect, useState } from 'react';
import { api, type Journey, type MilestoneId } from './api';

/**
 * User-facing copy for the activation journey. The server owns the state
 * (which milestones are done, current/target progress); this file owns what
 * each step means to the operator and where clicking it takes them. `:siteId`
 * in an href is replaced with the selected site.
 */

export interface MilestoneCopy {
  title: string;
  /** value-forward: what the user GETS, not what the system does. */
  description: string;
  cta?: { href: string; label: string };
  /** short unit label for progress bars, e.g. "page views". */
  unit?: string;
}

export const MILESTONE_COPY: Record<MilestoneId, MilestoneCopy> = {
  site_created: {
    title: 'Create your site',
    description: 'Registers your domain and generates your unique tracking snippet.',
    cta: { href: '/sites', label: 'Create site' },
  },
  snippet_installed: {
    title: 'Install the snippet',
    description:
      'One script tag on your landing page. The moment we receive your first event this checks itself off — watch the live badge above.',
    cta: { href: '/sites/:siteId', label: 'Get my snippet' },
  },
  traffic: {
    title: 'Collect your first 100 page views',
    description:
      'Just let it run — with 100 views the Analytics funnel and Section performance start telling the truth.',
    unit: 'page views',
  },
  goal_defined: {
    title: 'Define a conversion goal',
    description:
      'Tell us what success means (a signup, a booked demo). Until then your conversion rate will honestly read 0.',
    cta: { href: '/sites/:siteId', label: 'Add a goal' },
  },
  conversion_tracked: {
    title: 'Track your first conversion',
    description:
      'Fires when a visitor completes your goal (or your page calls LandingOptimizer.conversion()).',
  },
  snapshot_captured: {
    title: 'Capture a page snapshot',
    description:
      'Open your page with ?lo_capture=1 — the screenshot becomes the canvas your heatmap is painted on.',
    cta: { href: '/heatmap', label: 'How to capture' },
  },
  heatmap_ready: {
    title: 'Unlock the behavior heatmap',
    description:
      'At 200 element interactions the heatmap shows where visitors click, hover, and stop scrolling.',
    cta: { href: '/heatmap', label: 'Open heatmap' },
    unit: 'interactions',
  },
  ai_ready: {
    title: 'Unlock AI insights',
    description:
      'At 500 page views the AI has enough signal to propose experiments worth your time — weak suggestions waste your traffic.',
    cta: { href: '/insights', label: 'Open AI insights' },
    unit: 'page views',
  },
  experiment_created: {
    title: 'Create your first experiment',
    description: 'Start from an AI suggestion or write your own copy test.',
    cta: { href: '/experiments', label: 'Open experiments' },
  },
  experiment_live: {
    title: 'Launch it',
    description:
      'Approve and start — the change is applied as a safe overlay on your page, reversible in one click.',
    cta: { href: '/approvals', label: 'Review queue' },
  },
  results_ready: {
    title: 'Reach your first verdict',
    description:
      '60 exposures (30 per variant) is the statistical minimum for a significance call. The Results page counts down for you.',
    cta: { href: '/results', label: 'Open results' },
    unit: 'exposures',
  },
};

export function milestoneHref(copy: MilestoneCopy, siteId: string): string | undefined {
  return copy.cta?.href.replace(':siteId', siteId);
}

/** Fetch the journey for a site; refetches when the site changes. */
export function useJourney(siteId: string): {
  journey: Journey | null;
  loading: boolean;
} {
  const [journey, setJourney] = useState<Journey | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!siteId) {
      setJourney(null);
      return;
    }
    let active = true;
    setLoading(true);
    api
      .get<Journey>(`/sites/${siteId}/journey`)
      .then((j) => {
        if (active) setJourney(j);
      })
      .catch(() => {
        if (active) setJourney(null);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [siteId]);

  return { journey, loading };
}

export function milestone(journey: Journey | null, id: MilestoneId) {
  return journey?.milestones.find((m) => m.id === id);
}
