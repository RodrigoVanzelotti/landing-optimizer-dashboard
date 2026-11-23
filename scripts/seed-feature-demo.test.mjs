import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { fixtures, demoId, SITE_ID, DATASET } from './seed-feature-demo.mjs';

const requireApi = createRequire(new URL('../../landing-optimizer-api/package.json', import.meta.url));
const { evaluateEvidence } = requireApi('./dist/modules/experiments/experiment-evidence.js');
const data = fixtures({ tenantId: 'tenant', actorId: 'actor', goalId: demoId('goal'), now: new Date('2026-11-23T19:00:00Z') });

test('fixtures are deterministic, isolated and visibly fictitious', () => {
  assert.deepEqual(data, fixtures({ tenantId: 'tenant', actorId: 'actor', goalId: demoId('goal'), now: new Date('2026-11-23T19:00:00Z') }));
  const ids = [...data.insights, ...data.experiments].map(item => item.id);
  assert.equal(new Set(ids).size, ids.length);
  for (const item of [...data.insights, ...data.experiments]) {
    assert.equal(item.siteId, SITE_ID); assert.equal(item.tenantId, 'tenant');
    assert((item.name ?? item.payload.title).startsWith('Demonstração · '));
  }
  for (const insight of data.insights) {
    assert.equal(insight.payload.synthetic, true);
    assert.equal(insight.payload.dataset, DATASET);
    assert(!insight.approvedAt || !insight.rejectedAt);
  }
});

test('results have coherent consolidated series and satisfy the actual statistical rules', () => {
  const completed = data.experiments.filter(item => item.resultSnapshot);
  assert.equal(completed.length, 5);
  for (const experiment of completed) {
    const report = experiment.resultSnapshot;
    assert(report.conclusive);
    assert.equal(report.series.length, 14);
    for (const variant of report.variants) {
      const last = report.series.at(-1).variants.find(item => item.variantId === variant.variantId);
      assert.equal(variant.exposures, last.exposures);
      assert.equal(variant.conversions, last.conversions);
    }
  }
  const accepted = completed.find(item => item.status === 'accepted');
  assert.equal(accepted.winnerVariantId, accepted.variants.create.find(item => !item.isControl).id);
});

test('ongoing traffic has complete sessions, mature conversions and remains inconclusive', () => {
  const sessions = new Map();
  for (const event of data.events) {
    assert.equal(event.site_id, SITE_ID); assert.equal(JSON.parse(event.props).dataset, DATASET);
    const events = sessions.get(event.session_id) ?? [];
    if (event.event_name === 'exposure') assert(events.some(item => item.event_name === 'page_view'));
    if (event.event_name === 'conversion') assert(events.some(item => item.event_name === 'form_submit'));
    events.push(event); sessions.set(event.session_id, events);
  }
  for (const experiment of data.experiments.filter(item => ['running', 'paused'].includes(item.status))) {
    const stats = experiment.variants.create.map(variant => ({ variantId: variant.id, isControl: variant.isControl, exposures: data.events.filter(event => event.variant_id === variant.id && event.event_name === 'exposure').length, conversions: data.events.filter(event => event.variant_id === variant.id && event.event_name === 'conversion').length }));
    assert.equal(stats[0].exposures, 450);
    assert.equal(stats[0].conversions, 45);
    assert.equal(evaluateEvidence(stats, experiment.evaluationPlan, new Date('2026-11-22T00:00:00Z')).conclusive, false);
  }
});
