import type * as React from 'react';
import { AuthGuard } from '@/components/auth-guard';
import { Sidebar } from '@/components/sidebar';
import { SitesProvider } from '@/lib/use-sites';
import { SiteScope } from '@/components/site-navigation';
import { ToastViewport } from '@/components/ui/toast';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}): React.ReactElement {
  return (
    <AuthGuard>
      <SitesProvider>
      <div className="flex min-h-screen flex-col md:flex-row">
        <Sidebar />
        <main className="min-w-0 flex-1 p-5 sm:p-8">
          <div className="mx-auto w-full min-w-0 max-w-6xl"><SiteScope>{children}</SiteScope></div>
        </main>
      </div>
      <ToastViewport />
      </SitesProvider>
    </AuthGuard>
  );
}
