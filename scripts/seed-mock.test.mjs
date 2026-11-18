import test from 'node:test';
import assert from 'node:assert/strict';
import { trafficDay, DAY, id } from './seed-mock.mjs';

test('deterministic traffic follows the session, form and temporal contracts', () => {
  const start = new Date('2024-11-13T00:00:00Z'), end = new Date(+start + 735 * DAY);
  const sessions = new Map(), totals = new Map(), days = new Set();
  for (let index = 0; index < 735; index++) {
    const day = new Date(+start + index * DAY);
    const input = { day, start, end, tenantId: id('tenant'), siteId: id('site') };
    const rows = trafficDay(input);
    if (index === 734) assert.deepEqual(rows, trafficDay(input));
    for (const row of rows) {
      assert(+new Date(row.event_time + 'Z') >= +day && +new Date(row.event_time + 'Z') < +day + DAY);
      assert(row.scroll_depth >= 0 && row.scroll_depth <= 100);
      assert(row.dwell_ms >= 0 && row.dwell_ms <= DAY);
      assert(row.site_id === input.siteId && row.tenant_id === input.tenantId);
      assert.equal(JSON.parse(row.props).synthetic, true);
      const events = sessions.get(row.session_id) ?? [];
      if (row.event_name === 'form_submit') assert(events.some(e => e.event_name === 'form_start' && e.selector === row.selector && e.page_path === row.page_path));
      if (row.event_name === 'conversion') assert(events.some(e => e.event_name === 'form_submit'));
      if (row.event_name === 'exposure') assert.notEqual(row.variant_id, '00000000-0000-0000-0000-000000000000');
      if (events.length) assert(row.event_time >= events.at(-1).event_time);
      events.push(row); sessions.set(row.session_id, events);
      totals.set(row.event_name, (totals.get(row.event_name) ?? 0) + 1);
      days.add(row.event_time.slice(0, 10));
    }
  }
  assert.equal(days.size, 735);
  for (const name of ['page_view', 'scroll_depth', 'cta_click', 'dead_click', 'rage_click', 'form_start', 'form_submit', 'conversion', 'section_view', 'hover', 'dwell', 'dropoff', 'exposure']) assert(totals.get(name) > 0, name);
  assert(sessions.size > 10000);
});
