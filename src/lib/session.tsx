'use client';
import { createContext, useContext } from 'react';
import type { SessionUser } from './permissions';

export const SessionContext = createContext<SessionUser | null>(null);
export function useSession(): SessionUser {
  const user = useContext(SessionContext);
  if (!user) throw new Error('Session is not ready');
  return user;
}
