import { describe, expect, it } from 'vitest';
import { canEdit, canViewRoute } from '../src/lib/permissions';

describe('dashboard role permissions', () => {
  it.each(['admin', 'editor', 'viewer'] as const)('restricts platform management independently of the %s tenant role', (role) => {
    expect(canViewRoute(role, '/tenants')).toBe(false);
    expect(canViewRoute(role, '/tenants/another', false)).toBe(false);
    expect(canViewRoute(role, '/tenants', true)).toBe(true);
  });
  it.each(['/team', '/settings', '/billing', '/team/anything'])('hides and blocks %s for viewers while allowing editor consultation', (path) => {
    expect(canViewRoute('viewer', path)).toBe(false);
    expect(canViewRoute('editor', path)).toBe(true);
    expect(canViewRoute('admin', path)).toBe(true);
  });

  it('keeps operational reads available and denies all viewer writes', () => {
    for (const path of ['/overview', '/sites', '/experiments/id', '/guardrails', '/results']) {
      expect(canViewRoute('viewer', path)).toBe(true);
    }
    expect(canEdit('viewer')).toBe(false);
    expect(canEdit('editor')).toBe(true);
    expect(canEdit('admin')).toBe(true);
  });
});
