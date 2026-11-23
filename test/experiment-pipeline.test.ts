import { expect, it } from 'vitest';
import { filterExperiments, experimentStage, type ExperimentFilters } from '../src/lib/experiments';
import type { Experiment } from '../src/lib/api';

const now = Date.parse('2026-11-21T12:00:00Z');
const base: Experiment = { id: 'one', name: 'Título principal', type: 'headline', status: 'approved', siteId: 'site', insightId: 'insight', createdAt: '2026-11-20T12:00:00Z', riskScore: 30, allocation: 0.5 };
const filters: ExperimentFilters = { search: '', type: '', risk: '', origin: '', period: '', sort: 'newest' };

it('combines search, type, risk, origin and creation period without mutating the source', () => {
  const items = [base, { ...base, id: 'high', riskScore: 70 }, { ...base, id: 'manual', insightId: null }, { ...base, id: 'old', createdAt: '2026-10-01T12:00:00Z' }];
  expect(filterExperiments(items, { ...filters, search: ' TÍTULO ', type: 'headline', risk: 'low', origin: 'insight', period: '7' }, now).map(item => item.id)).toEqual(['one']);
  expect(items.map(item => item.id)).toEqual(['one', 'high', 'manual', 'old']);
  expect(filterExperiments(items, { ...filters, type: 'cta' }, now)).toEqual([]);
});

it('uses explicit risk boundaries, excludes future dates in date filters and sorts results', () => {
  const items = [base, { ...base, id: 'medium', name: 'Botão', riskScore: 60 }, { ...base, id: 'high', riskScore: 61 }, { ...base, id: 'future', createdAt: '2026-12-01T00:00:00Z' }];
  expect(filterExperiments(items, { ...filters, risk: 'medium' }, now).map(item => item.id)).toEqual(['medium']);
  expect(filterExperiments(items, { ...filters, period: '7' }, now)).toHaveLength(3);
  expect(filterExperiments(items, { ...filters, sort: 'name' }, now)[0].id).toBe('medium');
  expect(filterExperiments(items, { ...filters, sort: 'risk' }, now)[0].id).toBe('high');
});

it('groups approvals, live tests, results and refusals without expiring tests that already started', () => {
  expect(experimentStage(base, now)).toBe('waiting');
  const old = { ...base, createdAt: '2026-11-14T12:00:00Z' };
  expect(experimentStage(old, now - 1)).toBe('waiting');
  expect(experimentStage(old, now)).toBe('expired');
  expect(experimentStage({ ...old, status: 'scheduled', startedAt: '2026-11-30T00:00:00Z' }, now)).toBe('expired');
  expect(experimentStage({ ...old, status: 'running' }, now)).toBe('running');
  expect(experimentStage({ ...old, status: 'paused', startedAt: '2026-11-16T00:00:00Z' }, now)).toBe('running');
  expect(experimentStage({ ...old, status: 'paused', startedAt: null }, now)).toBe('expired');
  expect(experimentStage({ ...old, status: 'completed' }, now)).toBe('results');
  expect(experimentStage({ ...old, status: 'rolled_back' }, now)).toBe('rejected');
  expect(experimentStage({ ...old, status: 'killed' }, now)).toBe('rejected');
  expect(experimentStage({ ...old, status: 'accepted' }, now)).toBe('accepted');
  expect(experimentStage({ ...old, status: 'rejected' }, now)).toBe('rejected');
});
