import type * as React from 'react';
import { Card, CardTitle } from '@/components/ui/card';
import { PageHeader } from '@/components/page-header';

/** Honest placeholder for features scheduled after the MVP (see ROADMAP.md). */
export function ComingSoon({
  title,
  description,
  note,
}: {
  title: string;
  description: string;
  note: string;
}): React.ReactElement {
  return (
    <div>
      <PageHeader title={title} description={description} />
      <Card>
        <CardTitle>Planned for a later milestone</CardTitle>
        <p className="mt-2 text-sm text-muted-foreground">{note}</p>
      </Card>
    </div>
  );
}
