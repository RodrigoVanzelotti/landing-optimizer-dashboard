'use client';

import type * as React from 'react';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ensureSession, setUnauthorizedHandler } from '@/lib/api';

/**
 * A component that guards a route and ensures the user is authenticated.
 * @param param0 The children to render if the user is authenticated.
 */
export function AuthGuard({
    children,
}: {
    children: React.ReactNode;
}): React.ReactElement {
    const router = useRouter();
    const [authed, setAuthed] = useState(false);

    useEffect(() => {
        let active = true;
        
        setUnauthorizedHandler(() => router.replace('/login'));

        void ensureSession().then((ok) => {
            if (!active) return;
            if (ok) setAuthed(true);
            else router.replace('/login');
        });

        return () => {
            active = false;
            setUnauthorizedHandler(null);
        };
    }, [router]);

    if (!authed) {
        return (
            <div className="flex min-h-screen items-center justify-center">
                <p className="text-sm text-muted-foreground">Loading...</p>
            </div>
        );
    }

    return <>{children}</>;
}


