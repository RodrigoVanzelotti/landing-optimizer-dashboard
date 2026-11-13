import Link from 'next/link';
import { Button } from '@/components/ui/button';

export function DataState({ title, description, loading = false, error = false, href, action, onRetry }: {
  title: string; description?: string; loading?: boolean; error?: boolean;
  href?: string; action?: string; onRetry?: () => void;
}) {
  return <div role={error ? 'alert' : 'status'} className="rounded-lg border border-dashed border-border bg-muted/30 p-6 sm:p-8">
    <p className="font-medium">{title}</p>
    {description && <p className="mt-2 max-w-prose text-sm leading-relaxed text-muted-foreground">{description}</p>}
    {loading && <div aria-hidden="true" className="mt-4 h-1 w-24 rounded bg-border motion-safe:animate-pulse" />}
    {href && action && <Link href={href} className="mt-4 inline-flex min-h-11 items-center text-sm font-medium text-primary underline underline-offset-4">{action}</Link>}
    {onRetry && <Button variant="outline" className="mt-4 h-11" onClick={onRetry}>Tentar novamente</Button>}
  </div>;
}
