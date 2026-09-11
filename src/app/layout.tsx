import type * as React from 'react';
import type { Metadata } from 'next';
import { ClientErrorReporter } from '@/components/client-error-reporter';
import './globals.css';

export const metadata: Metadata = {
  title: 'Landing Optimizer',
  description: 'Privacy-preserving AI landing page optimization',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}): React.ReactElement {
  return (
    <html lang="en">
      <body className="min-h-screen antialiased">
        <ClientErrorReporter />
        {children}
      </body>
    </html>
  );
}
