import type * as React from 'react';
import { AuthGuard } from '@/components/auth-guard';
import { Sidebar } from '@/components/sidebar';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}): React.ReactElement {
  return (
    <AuthGuard>
      <div className="flex min-h-screen flex-col md:flex-row">
        <Sidebar />
        <main className="min-w-0 flex-1 p-5 sm:p-8">
          <div className="mx-auto w-full min-w-0 max-w-6xl">{children}</div>
        </main>
      </div>
    </AuthGuard>
  );
}
