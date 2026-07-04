import type * as React from 'react';
import { ComingSoon } from '@/components/coming-soon';

export default function GuardrailsPage(): React.ReactElement {
  return (
    <ComingSoon
      title="Brand guardrails"
      description="Constrain AI copy to your brand voice."
      note="The data model and AI enforcement (banned words, max length, tone) exist in the API and AI service. The editing UI is scheduled for the post-MVP phase."
    />
  );
}
