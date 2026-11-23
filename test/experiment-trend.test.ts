import * as React from 'react';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, expect, it } from 'vitest';
import { ExperimentTrend } from '../src/components/experiment-trend';
import { ExperimentOutcome } from '../src/components/experiment-outcome';
import type { ExperimentReport } from '../src/lib/api';

let host: HTMLDivElement, root: Root;
const control = { variantId: 'control', name: 'Site base', isControl: true, exposures: 1000, conversions: 100, conversionRate: .1, lift: null, pValue: null, significant: false };
const proposal = { ...control, variantId: 'proposal', name: 'Mudança proposta', isControl: false, conversions: 120, conversionRate: .12, lift: .2, pValue: .2 };
const report: ExperimentReport = { experimentId: 'experiment', experiment: { id: 'experiment', name: 'Teste', siteId: 'site', status: 'running' }, goal: { id: 'goal', name: 'Leads' }, variants: [control, proposal], plan: null, conclusive: false, coverageComplete: true, conversionWindowHours: 24, recordedAt: '2026-11-23', evidence: [], series: [
  { date: '2026-11-20', variants: [{ variantId: 'control', exposures: 500, conversions: 50, conversionRate: .1 }, { variantId: 'proposal', exposures: 0, conversions: 0, conversionRate: null }] },
  { date: '2026-11-21', variants: [{ variantId: 'control', exposures: 1000, conversions: 100, conversionRate: .1 }, { variantId: 'proposal', exposures: 1000, conversions: 120, conversionRate: .12 }] },
] };
beforeEach(() => { Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true }); host = document.createElement('div'); document.body.append(host); root = createRoot(host); });
afterEach(async () => { await act(async () => root.unmount()); host.remove(); });
it('distinguishes 20% relative effect from 2 percentage points without declaring an inconclusive result a win', async () => {
  await act(async () => root.render(React.createElement(ExperimentOutcome, { variant: proposal, control, partial: true })));
  expect(host.textContent).toContain('+20%'); expect(host.textContent).toContain('+2 p.p.');
  expect(host.textContent).toContain('Resultado parcial'); expect(host.textContent).not.toContain('Melhora significativa');
});
it('compares actual time series by keyboard and keeps unobserved rates unavailable', async () => {
  await act(async () => root.render(React.createElement(ExperimentTrend, { report, variantId: 'proposal' })));
  const group = host.querySelector('[role="group"]')!;
  expect(host.querySelector('[aria-live]')?.textContent).toContain('mudança proposta 12%');
  await act(async () => group.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true })));
  expect(host.querySelector('[aria-live]')?.textContent).toContain('mudança proposta Sem dados');
  await act(async () => group.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true })));
  expect(host.querySelector('[aria-live]')?.textContent).toContain('mudança proposta 12%');
  expect(host.querySelector('table')?.textContent).toContain('Sem dados');
  expect(host.querySelector('svg')?.getAttribute('aria-label')).toContain('Eixo Y: taxa de conversão');
});
