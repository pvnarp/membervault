// ============================================================
// MEMBER TYPES
// ============================================================

export enum MemberStatus {
  PENDING = 'PENDING',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
  SUSPENDED = 'SUSPENDED',
  INACTIVE = 'INACTIVE',
}

export enum MemberType {
  GENERAL = 'GENERAL',
  VOTING = 'VOTING',
}

export interface MemberProfile {
  id: string;
  firstName: string;
  lastName: string;
  middleName?: string;
  email: string;
  phone: string;
  dob: string;
  dlNumber: string;
  streetAddress: string;
  city: string;
  state: string;
  zipCode: string;
  county?: string;
  gender: string;
  status: MemberStatus;
  memberType: MemberType;
  membershipStartDate?: string;
  applicationDate: string;
  consecutiveMissedVotes: number;
  lastVotedAt?: string;
  wasDowngraded: boolean;
  pendingChanges?: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface CreateMemberInput {
  firstName: string;
  lastName: string;
  middleName?: string;
  email: string;
  phone: string;
  dob: string;
  dlNumber: string;
  streetAddress: string;
  city: string;
  state: string;
  zipCode: string;
  county?: string;
  gender: string;
}

export interface UpdateMemberInput {
  firstName?: string;
  lastName?: string;
  middleName?: string;
  email?: string;
  phone?: string;
  dob?: string;
  dlNumber?: string;
  streetAddress?: string;
  city?: string;
  state?: string;
  zipCode?: string;
  county?: string;
  gender?: string;
  status?: MemberStatus;
  memberType?: MemberType;
}

export interface MemberChangeRequest {
  id: string;
  memberId: string;
  changes: Record<string, { from: string; to: string }>;
  status: 'PENDING' | 'APPROVED' | 'DENIED';
  createdAt: string;
}
