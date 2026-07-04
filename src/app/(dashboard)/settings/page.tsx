import type * as React from 'react';
import { ComingSoon } from '@/components/coming-soon';

export default function SettingsPage(): React.ReactElement {
  return (
    <ComingSoon
      title="Settings"
      description="Tenant and data-region configuration."
      note="Tenant settings and data-region controls are stored in the API. The settings UI is scheduled for a later milestone."
    />
  );
}
