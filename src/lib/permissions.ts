export type UserRole = 'admin' | 'editor' | 'viewer';
export interface SessionUser { id: string; name: string | null; email: string; tenantId: string; role: UserRole; platformOwner?: boolean }
export const roleLabels: Record<UserRole, string> = { admin: 'Administrador', editor: 'Editor', viewer: 'Visualizador' };
export const canEdit = (role: UserRole): boolean => role !== 'viewer';
export const canViewRoute = (role: UserRole, path: string, platformOwner = false): boolean => {
  if (path === '/tenants' || path.startsWith('/tenants/')) return platformOwner;
  return role !== 'viewer' || !['/team', '/settings', '/billing'].some((route) => path === route || path.startsWith(`${route}/`));
};
