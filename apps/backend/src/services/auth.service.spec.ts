import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AuthService } from './auth.service.js';
import type { Env } from '../config/env.js';

// Mock argon2
vi.mock('argon2', () => ({
  hash: vi.fn().mockResolvedValue('hashed-password'),
  verify: vi.fn().mockResolvedValue(true),
  argon2id: 2,
}));

// Mock member number generation
vi.mock('../lib/member-number.js', () => ({
  generateMemberNumber: vi.fn().mockResolvedValue('MEM-2026-00001'),
}));

// Hoisted mocks (must be defined before vi.mock calls which are hoisted)
const { mockJwtVerify, mockOtplib } = vi.hoisted(() => ({
  mockJwtVerify: vi.fn(),
  mockOtplib: {
    generateSecret: vi.fn().mockReturnValue('JBSWY3DPEHPK3PXP'),
    generateURI: vi
      .fn()
      .mockReturnValue(
        'otpauth://totp/Membership:test@example.com?secret=JBSWY3DPEHPK3PXP&issuer=Membership',
      ),
    verify: vi.fn().mockResolvedValue({ valid: true }),
  },
}));

// Mock otplib (dynamic import in service)
vi.mock('otplib', () => mockOtplib);

// Mock jose (keep real SignJWT, mock jwtVerify)
vi.mock('jose', async () => {
  const actual = await vi.importActual<typeof import('jose')>('jose');
  return { ...actual, jwtVerify: mockJwtVerify };
});

describe('AuthService', () => {
  let service: AuthService;
  let mockDb: any;
  let mockEncryption: any;
  let mockEmail: any;
  let mockEnv: Env;

  const mockOrg = {
    id: 'org-1',
    name: 'Test Org',
    slug: 'test',
    settings: {},
    createdAt: '2025-01-01',
    updatedAt: '2025-01-01',
  };

  const mockUser = {
    id: 'user-1',
    organizationId: 'org-1',
    email: 'test@example.com',
    role: 'MEMBER',
    passwordHash: null,
    mfaSecret: null,
    mfaEnabled: false,
    refreshToken: null,
    magicLinkToken: null,
    magicLinkExpiry: null,
    isActive: true,
    lastLoginAt: null,
    createdAt: '2025-01-01',
    updatedAt: '2025-01-01',
  };

  const mockAdminUser = {
    ...mockUser,
    id: 'admin-1',
    email: 'admin@example.com',
    role: 'SUPER_ADMIN',
    passwordHash: 'hashed-password',
  };

  beforeEach(() => {
    mockDb = {
      select: vi.fn(),
      insert: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    };

    mockEncryption = {
      encrypt: vi.fn((text: string) => `enc:${text}`),
      decrypt: vi.fn((text: string) => text.replace('enc:', '')),
      hash: vi.fn((text: string) => `hash:${text}`),
      blindIndex: vi.fn((text: string) => `bi:${text}`),
      generateToken: vi.fn().mockReturnValue('mock-token'),
    };

    mockEmail = {
      send: vi.fn(),
      sendMagicLink: vi.fn(),
      sendSignupConfirmation: vi.fn().mockResolvedValue(undefined),
      sendWeeklyReminder: vi.fn().mockResolvedValue(undefined),
      sendApplicationApproved: vi.fn().mockResolvedValue(undefined),
      sendApplicationRejected: vi.fn().mockResolvedValue(undefined),
    };

    mockEnv = {
      DATABASE_URL: 'postgresql://test',
      JWT_SECRET: 'a'.repeat(32),
      JWT_REFRESH_SECRET: 'b'.repeat(32),
      ENCRYPTION_KEY: '0'.repeat(64),
      RESEND_API_KEY: '',
      EMAIL_FROM: 'test@example.org',
      ALTCHA_HMAC_KEY: '',
      NODE_ENV: 'development',
      PORT: 3000,
      CORS_ORIGIN: 'http://localhost:5173',
      UPLOAD_PATH: './uploads',
    } as Env;

    service = new AuthService(mockDb, mockEncryption, mockEmail, mockEnv);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  // ============================================================
  // REGISTRATION
  // ============================================================
  describe('register', () => {
    it('should create a new member with encrypted PII', async () => {
      // No existing members with this email (blind-index lookup returns empty)
      mockDb.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([]),
          }),
        }),
      });

      const insertChain: any = {
        values: vi.fn().mockReturnValue({
          returning: vi
            .fn()
            .mockResolvedValue([
              { id: 'member-1', status: 'PENDING', applicationDate: '2025-01-01' },
            ]),
        }),
      };
      mockDb.insert.mockReturnValue(insertChain);

      const result = await service.register({
        firstName: 'John',
        lastName: 'Doe',
        email: 'john@example.com',
        phone: '555-1234',
        dob: '1990-01-01',
        dlNumber: 'DL123',
        streetAddress: '123 Main St',
        city: 'Plano',
        state: 'TX',
        zipCode: '75023',
        gender: 'Male',
        organizationId: 'org-1',
      });

      expect(result).toEqual({ id: 'member-1', status: 'PENDING', applicationDate: '2025-01-01' });
      expect(mockEncryption.encrypt).toHaveBeenCalledWith('John');
      expect(mockEncryption.encrypt).toHaveBeenCalledWith('john@example.com');
    });

    it('should reject duplicate email', async () => {
      // Blind-index lookup finds an existing member with the same email token
      mockDb.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([{ id: 'existing-member-1' }]),
          }),
        }),
      });

      await expect(
        service.register({
          firstName: 'John',
          lastName: 'Doe',
          email: 'john@example.com',
          phone: '555-1234',
          dob: '1990-01-01',
          dlNumber: 'DL123',
          streetAddress: '123 Main St',
          city: 'Plano',
          state: 'TX',
          zipCode: '75023',
          gender: 'Male',
          organizationId: 'org-1',
        }),
      ).rejects.toThrow('already exists');
    });
  });

  // ============================================================
  // MAGIC LINK
  // ============================================================
  describe('requestMagicLink', () => {
    it('should return success message even if user not found', async () => {
      mockDb.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([]),
          }),
        }),
      });

      const result = await service.requestMagicLink('nonexistent@example.com', 'org-1');
      expect(result.message).toContain('If an account exists');
    });

    it('should generate token and return devToken in development', async () => {
      mockDb.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([mockUser]),
          }),
        }),
      });

      const updateChain: any = {
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue(undefined),
        }),
      };
      mockDb.update.mockReturnValue(updateChain);

      const result = await service.requestMagicLink('test@example.com', 'org-1');
      expect(result.devToken).toBe('mock-token');
      expect(mockEncryption.generateToken).toHaveBeenCalledWith(64);
    });

    it('should call sendMagicLink with user email and token', async () => {
      mockDb.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([mockUser]),
          }),
        }),
      });

      const updateChain: any = {
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue(undefined),
        }),
      };
      mockDb.update.mockReturnValue(updateChain);

      await service.requestMagicLink('test@example.com', 'org-1');
      expect(mockEmail.sendMagicLink).toHaveBeenCalledWith(
        mockUser.email,
        'mock-token',
        mockEnv.CORS_ORIGIN,
      );
    });

    it('should not send email when user is not found', async () => {
      mockDb.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([]),
          }),
        }),
      });

      await service.requestMagicLink('nonexistent@example.com', 'org-1');
      expect(mockEmail.sendMagicLink).not.toHaveBeenCalled();
    });

    it('should not return devToken in production mode', async () => {
      mockDb.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([mockUser]),
          }),
        }),
      });

      const updateChain: any = {
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue(undefined),
        }),
      };
      mockDb.update.mockReturnValue(updateChain);

      const prodEnv = { ...mockEnv, NODE_ENV: 'production' as const };
      const prodService = new AuthService(mockDb, mockEncryption, mockEmail, prodEnv);
      const result = await prodService.requestMagicLink('test@example.com', 'org-1');
      expect(result.devToken).toBeUndefined();
      expect(result.message).toContain('If an account exists');
    });
  });

  // ============================================================
  // ADMIN LOGIN
  // ============================================================
  describe('loginAdmin', () => {
    it('should throw on invalid credentials', async () => {
      mockDb.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([]),
          }),
        }),
      });

      await expect(service.loginAdmin('bad@example.com', 'password', 'org-1')).rejects.toThrow(
        'Invalid credentials',
      );
    });

    it('should throw for MEMBER role', async () => {
      mockDb.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([{ ...mockUser, passwordHash: 'hash' }]),
          }),
        }),
      });

      await expect(service.loginAdmin('test@example.com', 'password', 'org-1')).rejects.toThrow(
        'Invalid credentials',
      );
    });

    it('should return MFA required if MFA is enabled', async () => {
      mockDb.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([{ ...mockAdminUser, mfaEnabled: true }]),
          }),
        }),
      });

      const result = await service.loginAdmin('admin@example.com', 'password', 'org-1');
      expect(result).toHaveProperty('mfaRequired', true);
      expect(result).toHaveProperty('tempToken');
    });

    it('should return tokens on successful login', async () => {
      mockDb.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([mockAdminUser]),
          }),
        }),
      });

      const updateChain: any = {
        set: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue(undefined) }),
      };
      mockDb.update.mockReturnValue(updateChain);

      const result = await service.loginAdmin('admin@example.com', 'password', 'org-1');
      expect(result).toHaveProperty('accessToken');
      expect(result).toHaveProperty('refreshToken');
      expect(result).toHaveProperty('user');
    });
  });

  // ============================================================
  // LOGOUT
  // ============================================================
  describe('logout', () => {
    it('should clear refresh token', async () => {
      const updateChain: any = {
        set: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue(undefined) }),
      };
      mockDb.update.mockReturnValue(updateChain);

      const result = await service.logout('user-1');
      expect(result.message).toBe('Logged out successfully');
    });
  });

  // ============================================================
  // GET DEFAULT ORGANIZATION
  // ============================================================
  describe('getDefaultOrganization', () => {
    it('should return first organization', async () => {
      mockDb.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          orderBy: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([mockOrg]),
          }),
        }),
      });

      const result = await service.getDefaultOrganization();
      expect(result).toEqual(mockOrg);
    });

    it('should throw if no organization exists', async () => {
      mockDb.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          orderBy: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([]),
          }),
        }),
      });

      await expect(service.getDefaultOrganization()).rejects.toThrow('No organization configured');
    });
  });

  // ============================================================
  // HASH PASSWORD
  // ============================================================
  describe('hashPassword', () => {
    it('should hash password with argon2id', async () => {
      const hash = await service.hashPassword('password123');
      expect(hash).toBe('hashed-password');
    });
  });

  // ============================================================
  // VERIFY MAGIC LINK
  // ============================================================
  describe('verifyMagicLink', () => {
    it('should return tokens for valid, non-expired token', async () => {
      const validUser = {
        ...mockUser,
        magicLinkToken: 'hash:the-magic-token',
        magicLinkExpiry: new Date(Date.now() + 60_000).toISOString(),
      };

      // First select: find user by token hash + expiry
      mockDb.select.mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([validUser]),
          }),
        }),
      });

      // update: clear magic link fields + set lastLoginAt
      const updateClear: any = {
        set: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue(undefined) }),
      };
      // update: issueTokenPair stores refresh token hash
      const updateRefresh: any = {
        set: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue(undefined) }),
      };
      mockDb.update.mockReturnValueOnce(updateClear).mockReturnValueOnce(updateRefresh);

      const result = await service.verifyMagicLink('the-magic-token');

      expect(mockEncryption.hash).toHaveBeenCalledWith('the-magic-token');
      expect(result).toHaveProperty('accessToken');
      expect(result).toHaveProperty('refreshToken');
      expect(result).toHaveProperty('user');
      expect(result.user.id).toBe(validUser.id);
    });

    it('should throw for expired token', async () => {
      // select returns no rows (gt filter excludes expired)
      mockDb.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([]),
          }),
        }),
      });

      await expect(service.verifyMagicLink('expired-token')).rejects.toThrow(
        'Invalid or expired magic link',
      );
    });

    it('should throw when no matching user found', async () => {
      mockDb.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([]),
          }),
        }),
      });

      await expect(service.verifyMagicLink('unknown-token')).rejects.toThrow(
        'Invalid or expired magic link',
      );
    });
  });

  // ============================================================
  // SETUP MFA
  // ============================================================
  describe('setupMfa', () => {
    it('should generate secret and return QR URI', async () => {
      // select: find user by id
      mockDb.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([mockAdminUser]),
          }),
        }),
      });

      // update: store encrypted MFA secret
      const updateChain: any = {
        set: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue(undefined) }),
      };
      mockDb.update.mockReturnValue(updateChain);

      const result = await service.setupMfa('admin-1');

      expect(result).toHaveProperty('secret', 'JBSWY3DPEHPK3PXP');
      expect(result).toHaveProperty('qrCodeUri');
      expect(result.qrCodeUri).toContain('otpauth://');
      expect(mockEncryption.encrypt).toHaveBeenCalledWith('JBSWY3DPEHPK3PXP');
    });
  });

  // ============================================================
  // VERIFY MFA
  // ============================================================
  describe('verifyMfa', () => {
    it('should return tokens for valid MFA code', async () => {
      mockJwtVerify.mockResolvedValueOnce({
        payload: { sub: 'admin-1', purpose: 'mfa' },
      });

      const mfaUser = {
        ...mockAdminUser,
        mfaEnabled: true,
        mfaSecret: 'enc:JBSWY3DPEHPK3PXP',
      };

      // select: find user by id from payload.sub
      mockDb.select.mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([mfaUser]),
          }),
        }),
      });

      // update: lastLoginAt (user already has mfaEnabled=true, so no enable update)
      const updateLogin: any = {
        set: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue(undefined) }),
      };
      // update: issueTokenPair stores refresh token hash
      const updateRefresh: any = {
        set: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue(undefined) }),
      };
      mockDb.update.mockReturnValueOnce(updateLogin).mockReturnValueOnce(updateRefresh);

      const result = await service.verifyMfa('valid-temp-token', '123456');

      expect(result).toHaveProperty('accessToken');
      expect(result).toHaveProperty('refreshToken');
      expect(result).toHaveProperty('user');
      expect(result.user.id).toBe('admin-1');
    });

    it('should throw for invalid temp token', async () => {
      mockJwtVerify.mockRejectedValueOnce(new Error('invalid token'));

      await expect(service.verifyMfa('bad-temp-token', '123456')).rejects.toThrow(
        'Invalid or expired MFA session',
      );
    });
  });

  // ============================================================
  // REFRESH TOKENS
  // ============================================================
  describe('refreshTokens', () => {
    it('should return new token pair for valid refresh token', async () => {
      mockJwtVerify.mockResolvedValueOnce({
        payload: { sub: 'admin-1' },
      });

      const userWithRefresh = {
        ...mockAdminUser,
        refreshToken: 'hash:valid-refresh-token',
        isActive: true,
      };

      // select: find user by id
      mockDb.select.mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([userWithRefresh]),
          }),
        }),
      });

      // update: issueTokenPair stores new refresh token hash
      const updateChain: any = {
        set: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue(undefined) }),
      };
      mockDb.update.mockReturnValue(updateChain);

      const result = await service.refreshTokens('valid-refresh-token');

      expect(result).toHaveProperty('accessToken');
      expect(result).toHaveProperty('refreshToken');
      expect(result).toHaveProperty('user');
      expect(result.user.id).toBe('admin-1');
    });

    it('should detect token reuse and revoke session', async () => {
      mockJwtVerify.mockResolvedValueOnce({
        payload: { sub: 'admin-1' },
      });

      const userWithDifferentRefresh = {
        ...mockAdminUser,
        refreshToken: 'hash:different-token',
        isActive: true,
      };

      // select: find user by id
      mockDb.select.mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([userWithDifferentRefresh]),
          }),
        }),
      });

      // update: revoke session (set refreshToken to null)
      const updateChain: any = {
        set: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue(undefined) }),
      };
      mockDb.update.mockReturnValue(updateChain);

      await expect(service.refreshTokens('reused-refresh-token')).rejects.toThrow(
        'Token reuse detected',
      );
    });
  });
});
