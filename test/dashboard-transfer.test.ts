import * as React from 'react';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { metricDelta, conversionDrivers } from '../src/lib/analytics';
import { OverviewAnalytics } from '../src/components/overview-analytics';
import { BarChart } from '../src/components/bar-chart';
import { api, type AnalyticsReport } from '../src/lib/api';

vi.mock('../src/lib/api', () => ({ api: { get: vi.fn() } }));
vi.mock('../src/components/trend-chart', () => ({
  TrendChart: () => React.createElement('div', { 'data-testid': 'trend' }),
  metricValue: (value: number | null, rate = false) => value === null ? 'Sem dados' : rate ? `${(value * 100).toFixed(1)}%` : String(value),
  dateSpan: () => 'Período', reportDate: () => '01/01/2026',
}));

afterEach(() => vi.resetAllMocks());

describe('dashboard transfer', () => {
  it('distinguishes rate points, count growth and missing baselines', () => {
    expect(metricDelta(120, 100)).toBe(20);
    expect(metricDelta(.12, .1, true)).toBeCloseTo(2);
    expect(metricDelta(10, 0)).toBeNull();
    expect(metricDelta(null, 10)).toBeNull();
    expect(metricDelta(0, 0)).toBe(0);
  });
  it('keeps traffic plus rate contributions equal to the conversion difference', () => {
    const result = conversionDrivers({ pageViews: 1200, conversions: 90 }, { pageViews: 1000, conversions: 100 })!;
    expect(result.traffic).toBe(20);
    expect(result.rate).toBe(-30);
    expect(result.traffic + result.rate).toBe(-10);
    expect(conversionDrivers({ pageViews: 100, conversions: 10 }, { pageViews: 0, conversions: 0 })).toBeNull();
  });
  it('keeps bar scales shared and renders true zero and missing values without infinite widths', () => {
    const markup = renderToStaticMarkup(React.createElement(BarChart, { title: 'Comparação', reference: { label: 'Controle', value: 100 }, rows: [{ id: 'a', label: 'A', value: 50 }, { id: 'b', label: 'B', value: null }] }));
    expect(markup).toContain('width:50%');
    expect(markup).toContain('Sem dados');
    expect(markup).not.toMatch(/NaN|Infinity/);
  });
  it('disables KPI deltas and conversion decomposition for partial history, preserving true form journeys', async () => {
    const metrics = { pageViews: 1000, sessions: 800, ctaClicks: 200, conversions: 60, formStarts: 100, formCompletions: 70, formSubmits: 80, formCompletionRate: .7 };
    const report: AnalyticsReport = {
      timeframe: '30d', timezone: 'UTC', granularity: 'day',
      range: { from: '2026-10-01T00:00:00Z', to: '2026-10-31T00:00:00Z', previousFrom: '2026-09-01T00:00:00Z', previousTo: '2026-10-01T00:00:00Z' },
      coverage: { currentComplete: true, previousComplete: false, availableFrom: '2026-09-15T00:00:00Z' },
      current: metrics, previous: metrics, series: [], events: [{ event: 'page_view', count: 1000 }], sections: [],
    };
    vi.mocked(api.get).mockImplementation(async path => path.endsWith('/goals') ? [] : report);
    Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
    const container = document.createElement('div');
    const root = createRoot(container);
    try {
      await act(async () => root.render(React.createElement(OverviewAnalytics, { siteId: 'site', timeframe: '30d', onTimeframeChange: vi.fn(), refreshKey: 0 })));
      expect(container.textContent).toContain('Histórico parcial');
      expect(container.textContent).toContain('Sem comparação');
      expect(container.textContent).not.toContain('Variação nas conversões');
      expect(container.textContent).toContain('30 sessões');
      expect(container.textContent).toContain('sem envio observado');
      expect(container.querySelectorAll('[data-testid="trend"]')).toHaveLength(2);
    } finally { await act(async () => root.unmount()); }
  });
});
