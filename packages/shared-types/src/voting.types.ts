// ============================================================
// VOTING TYPES
// ============================================================

export interface VotingEvent {
  id: string;
  organizationId: string;
  title: string;
  description?: string;
  eventDate: string;
  isFinalized: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface VoteRecord {
  id: string;
  votingEventId: string;
  memberId: string;
  attended: boolean;
  recordedAt: string;
  recordedBy?: string;
}

export interface CreateVotingEventInput {
  title: string;
  description?: string;
  eventDate: string;
}

export interface RecordAttendanceInput {
  records: Array<{
    memberId: string;
    attended: boolean;
  }>;
}

export enum ReinstatementStatus {
  PENDING = 'PENDING',
  APPROVED = 'APPROVED',
  DENIED = 'DENIED',
}

export interface ReinstatementRequest {
  id: string;
  organizationId: string;
  memberId: string;
  reason: string;
  status: ReinstatementStatus;
  reviewedBy?: string;
  reviewedAt?: string;
  reviewNotes?: string;
  createdAt: string;
}

export interface CreateReinstatementInput {
  reason: string;
}
