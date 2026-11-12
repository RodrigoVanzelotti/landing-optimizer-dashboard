import type * as React from 'react';

export function PageHeader({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
}): React.ReactElement {
  return (
    <header className="mb-8 flex flex-col items-start gap-4 sm:flex-row sm:justify-between">
      <div className="min-w-0">
        <h1 className="break-words text-2xl font-semibold tracking-tight">{title}</h1>
        {description ? <p className="mt-2 max-w-prose text-sm leading-relaxed text-muted-foreground">{description}</p> : null}
      </div>
      {action ? <div className="flex shrink-0 flex-wrap items-center gap-2">{action}</div> : null}
    </header>
  );
}
