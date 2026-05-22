export interface AuthUser {
  id: string;
  email: string;
  role: 'SUPER_ADMIN' | 'MEMBERSHIP_MANAGER' | 'VIEWER' | 'MEMBER';
  organizationId: string;
  assignedEventId?: string;
}

export type UserRole = AuthUser['role'];
