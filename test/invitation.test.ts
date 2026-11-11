import { describe, expect, it } from 'vitest';
import { InvitationSchema } from '../src/lib/invitation';

describe('invitation URL parameters', () => {
  it('accepts decoded names and normalizes the invited email', () => {
    const params = new URLSearchParams('name=Ana%20Lu%C3%ADsa&email=Ana%2Bcliente%40Example.com');
    expect(InvitationSchema.parse(Object.fromEntries(params))).toEqual({ name: 'Ana Luísa', email: 'ana+cliente@example.com' });
  });

  it.each([
    {}, { name: 'Ana' }, { email: 'ana@example.com' },
    { name: ' ', email: 'ana@example.com' }, { name: 'Ana', email: 'invalid' },
    { name: ['Ana', 'Maria'], email: 'ana@example.com' },
    { name: 'a'.repeat(121), email: 'ana@example.com' },
  ])('rejects incomplete or ambiguous invitation parameters: %j', (params) => {
    expect(InvitationSchema.safeParse(params).success).toBe(false);
  });
});
