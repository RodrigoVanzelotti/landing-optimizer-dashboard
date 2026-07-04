import type * as React from 'react';
import { ComingSoon } from '@/components/coming-soon';

export default function TeamPage(): React.ReactElement {
  return (
    <ComingSoon
      title="Team members"
      description="Invite teammates and manage roles."
      note="Role-based access (owner/admin/editor/viewer) is enforced by the API today. Member management UI arrives in the post-MVP phase."
    />
  );
}
