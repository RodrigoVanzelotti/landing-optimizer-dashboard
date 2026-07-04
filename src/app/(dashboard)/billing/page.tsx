import type * as React from 'react';
import { ComingSoon } from '@/components/coming-soon';

export default function BillingPage(): React.ReactElement {
  return (
    <ComingSoon
      title="Billing"
      description="Usage-based billing."
      note="Billing is a post-MVP placeholder (see ROADMAP.md). No billing provider is wired up yet."
    />
  );
}
