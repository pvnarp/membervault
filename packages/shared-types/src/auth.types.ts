// ============================================================
// AUTH TYPES
// ============================================================

export enum UserRole {
  SUPER_ADMIN = 'SUPER_ADMIN',
  MEMBERSHIP_MANAGER = 'MEMBERSHIP_MANAGER',
  VIEWER = 'VIEWER',
  MEMBER = 'MEMBER',
}

export interface JwtPayload {
  sub: string;
  email: string;
  role: UserRole;
  organizationId: string;
  iat: number;
  exp: number;
}

export interface LoginResponse {
  accessToken: string;
  user: {
    id: string;
    email: string;
    role: UserRole;
    organizationId: string;
  };
}

export interface MfaPendingResponse {
  mfaRequired: true;
  tempToken: string;
}

export interface MfaSetupResponse {
  secret: string;
  qrCodeUri: string;
}

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

export interface MagicLinkRequestInput {
  email: string;
}

export interface AdminLoginInput {
  email: string;
  password: string;
}

export interface MfaVerifyInput {
  code: string;
  tempToken: string;
}

export interface RegisterInput {
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
  captchaToken: string;
}
