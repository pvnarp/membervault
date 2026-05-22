import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MemberService } from './member.service.js';

describe('MemberService', () => {
  let service: MemberService;
  let mockDb: any;
  let mockEncryption: any;

  const mockMember = {
    id: 'member-1',
    organizationId: 'org-1',
    userId: 'user-1',
    firstNameEnc: 'enc:John',
    lastNameEnc: 'enc:Doe',
    middleNameEnc: null,
    emailEnc: 'enc:john@example.com',
    phoneEnc: 'enc:555-1234',
    dobEnc: 'enc:1990-01-01',
    dlNumberEnc: 'enc:DL123',
    streetAddressEnc: 'enc:123 Main',
    city: 'Plano',
    state: 'TX',
    zipCode: '75023',
    county: 'Collin',
    gender: 'Male',
    status: 'APPROVED',
    memberType: 'VOTING',
    consecutiveMissedVotes: 0,
    wasDowngraded: false,
    pendingChanges: null,
    applicationDate: '2025-01-01',
    createdAt: '2025-01-01',
    updatedAt: '2025-01-01',
  };

  beforeEach(() => {
    mockDb = {
      select: vi.fn(),
      insert: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      transaction: vi.fn(async (fn: Function) => fn(mockDb)),
    };

    mockEncryption = {
      encrypt: vi.fn((text: string) => `enc:${text}`),
      decrypt: vi.fn((text: string) => text.replace('enc:', '')),
      hash: vi.fn((text: string) => `hash:${text}`),
      generateToken: vi.fn().mockReturnValue('mock-token'),
    };

    service = new MemberService(mockDb, mockEncryption);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  // ============================================================
  // CALCULATE MEMBER TYPE (pure function)
  // ============================================================
  describe('decryptMember', () => {
    it('should decrypt all PII fields', () => {
      const decrypted = service.decryptMember(mockMember);
      expect(decrypted.firstName).toBe('John');
      expect(decrypted.lastName).toBe('Doe');
      expect(decrypted.email).toBe('john@example.com');
      expect(decrypted.phone).toBe('555-1234');
    });

    it('should remove encrypted fields from output', () => {
      const decrypted = service.decryptMember(mockMember);
      expect(decrypted.firstNameEnc).toBeUndefined();
      expect(decrypted.lastNameEnc).toBeUndefined();
      expect(decrypted.emailEnc).toBeUndefined();
    });

    it('should handle null encrypted fields', () => {
      const decrypted = service.decryptMember({ ...mockMember, middleNameEnc: null });
      expect(decrypted.middleName).toBeNull();
    });

    it('should return original member on decryption error', () => {
      mockEncryption.decrypt.mockImplementation(() => {
        throw new Error('decrypt failed');
      });
      const result = service.decryptMember(mockMember);
      expect(result).toEqual(mockMember);
    });
  });

  // ============================================================
  // GET MEMBER
  // ============================================================
  describe('getMember', () => {
    it('should return decrypted member', async () => {
      mockDb.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([mockMember]),
          }),
        }),
      });

      const result = await service.getMember('member-1', 'org-1');
      expect(result.firstName).toBe('John');
    });

    it('should throw NotFound for missing member', async () => {
      mockDb.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([]),
          }),
        }),
      });

      await expect(service.getMember('bad-id', 'org-1')).rejects.toThrow('Member not found');
    });
  });

  // ============================================================
  // GET OWN PROFILE
  // ============================================================
  describe('getOwnProfile', () => {
    it('should return decrypted profile by userId', async () => {
      mockDb.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([mockMember]),
          }),
        }),
      });

      const result = await service.getOwnProfile('user-1');
      expect(result.firstName).toBe('John');
    });

    it('should throw NotFound if no member for userId', async () => {
      mockDb.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([]),
          }),
        }),
      });

      await expect(service.getOwnProfile('bad-user')).rejects.toThrow('Member profile not found');
    });
  });

  // ============================================================
  // REJECT MEMBER
  // ============================================================
  describe('rejectMember', () => {
    it('should throw NotFound if member not pending', async () => {
      mockDb.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([]),
          }),
        }),
      });

      await expect(service.rejectMember('member-1', 'org-1', 'admin-1', 'reason')).rejects.toThrow(
        'Pending member not found',
      );
    });
  });

  // ============================================================
  // DELETE MEMBER
  // ============================================================
  describe('deleteMember', () => {
    it('should throw NotFound if member does not exist', async () => {
      mockDb.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([]),
          }),
        }),
      });

      await expect(service.deleteMember('bad-id', 'org-1')).rejects.toThrow('Member not found');
    });
  });

  // ============================================================
  // REQUEST PROFILE CHANGE
  // ============================================================
  describe('requestProfileChange', () => {
    it('should reject non-critical fields', async () => {
      mockDb.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([mockMember]),
          }),
        }),
      });

      await expect(service.requestProfileChange('user-1', { phone: '555-9999' })).rejects.toThrow(
        'Non-critical fields',
      );
    });
  });

  // ============================================================
  // DENY CHANGE REQUEST
  // ============================================================
  describe('denyChangeRequest', () => {
    it('should throw NotFound if no pending changes', async () => {
      mockDb.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([{ ...mockMember, pendingChanges: null }]),
          }),
        }),
      });

      await expect(service.denyChangeRequest('member-1', 'org-1')).rejects.toThrow(
        'No pending change request',
      );
    });
  });

  // ============================================================
  // APPROVE MEMBER (success path)
  // ============================================================
  describe('approveMember', () => {
    it('should approve a pending member, create user, and classify', async () => {
      const pendingMember = { ...mockMember, status: 'PENDING', memberNumber: 'MEM-001' };

      // First select: find pending member
      // Second select (inside getMember after linking): find member by id+org
      // Third select: find newly created user by email+org
      // Fourth select (classifyMember): find member
      // Fifth select (classifyMember): eligibility rules
      // Sixth select (getMember at end): find member
      let selectCallCount = 0;
      const rulesData = [
        { ruleType: 'county', value: 'Collin', isActive: true },
        { ruleType: 'voting_zip', value: '75023', isActive: true },
      ];
      mockDb.select.mockImplementation(() => {
        selectCallCount++;
        const memberData =
          selectCallCount === 1
            ? pendingMember
            : { ...pendingMember, status: 'APPROVED', userId: 'new-user-1' };
        // where() is terminal for rules query (no .limit()), has .limit() for member queries
        const whereMock: any = vi.fn().mockImplementation(() => {
          const result = Object.assign(Promise.resolve(rulesData), {
            limit: vi.fn().mockResolvedValue([memberData]),
            then: (resolve: Function) => resolve(rulesData),
          });
          return result;
        });
        return {
          from: vi.fn().mockImplementation(() => ({
            where: whereMock,
          })),
        };
      });

      // Transaction: update member status + insert user
      mockDb.transaction.mockImplementation(async (fn: Function) => {
        const tx = {
          update: vi.fn().mockReturnValue({
            set: vi.fn().mockReturnValue({
              where: vi.fn().mockResolvedValue(undefined),
            }),
          }),
          insert: vi.fn().mockReturnValue({
            values: vi.fn().mockResolvedValue(undefined),
          }),
        };
        return fn(tx);
      });

      // Post-transaction: update member with userId + classifyMember update
      mockDb.update.mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            returning: vi
              .fn()
              .mockResolvedValue([{ ...pendingMember, status: 'APPROVED', userId: 'new-user-1' }]),
          }),
        }),
      });

      const result = await service.approveMember('member-1', 'org-1', 'admin-1');
      expect(result).toBeDefined();
      expect(mockDb.transaction).toHaveBeenCalled();
    });
  });

  // ============================================================
  // REJECT MEMBER (success path)
  // ============================================================
  describe('rejectMember - success', () => {
    it('should reject a pending member and return decrypted result', async () => {
      const pendingMember = { ...mockMember, status: 'PENDING' };
      const rejectedMember = {
        ...pendingMember,
        status: 'REJECTED',
        rejectionReason: 'Incomplete docs',
      };

      mockDb.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([pendingMember]),
          }),
        }),
      });

      mockDb.update.mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            returning: vi.fn().mockResolvedValue([rejectedMember]),
          }),
        }),
      });

      const result = await service.rejectMember('member-1', 'org-1', 'admin-1', 'Incomplete docs');
      expect(result.firstName).toBe('John');
      expect(result.lastName).toBe('Doe');
      expect(result.status).toBe('REJECTED');
      expect(result.rejectionReason).toBe('Incomplete docs');
    });
  });

  // ============================================================
  // DELETE MEMBER (success path)
  // ============================================================
  describe('deleteMember - success', () => {
    it('should delete member and associated user', async () => {
      mockDb.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([mockMember]),
          }),
        }),
      });

      mockDb.delete.mockReturnValue({
        where: vi.fn().mockResolvedValue(undefined),
      });

      const result = await service.deleteMember('member-1', 'org-1');
      expect(result).toEqual({ message: 'Member deleted successfully' });
      // delete called twice: once for user, once for member
      expect(mockDb.delete).toHaveBeenCalledTimes(2);
    });

    it('should delete member without user if userId is null', async () => {
      const memberNoUser = { ...mockMember, userId: null };

      mockDb.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([memberNoUser]),
          }),
        }),
      });

      mockDb.delete.mockReturnValue({
        where: vi.fn().mockResolvedValue(undefined),
      });

      const result = await service.deleteMember('member-1', 'org-1');
      expect(result).toEqual({ message: 'Member deleted successfully' });
      // delete called once: only for member (no userId)
      expect(mockDb.delete).toHaveBeenCalledTimes(1);
    });
  });

  // ============================================================
  // UPDATE OWN PROFILE
  // ============================================================
  describe('updateOwnProfile', () => {
    it('should update phone for member', async () => {
      const updatedMember = { ...mockMember, phoneEnc: 'enc:555-9999' };

      mockDb.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([mockMember]),
          }),
        }),
      });

      mockDb.update.mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            returning: vi.fn().mockResolvedValue([updatedMember]),
          }),
        }),
      });

      const result = await service.updateOwnProfile('user-1', { phone: '555-9999' });
      expect(result.phone).toBe('555-9999');
      expect(mockEncryption.encrypt).toHaveBeenCalledWith('555-9999');
    });

    it('should update email and also update user record', async () => {
      const updatedMember = { ...mockMember, emailEnc: 'enc:new@example.com' };

      mockDb.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([mockMember]),
          }),
        }),
      });

      mockDb.update.mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            returning: vi.fn().mockResolvedValue([updatedMember]),
          }),
        }),
      });

      const result = await service.updateOwnProfile('user-1', { email: 'new@example.com' });
      expect(result.email).toBe('new@example.com');
      // update called twice: once for users table (email sync), once for members table
      expect(mockDb.update).toHaveBeenCalledTimes(2);
    });

    it('should throw BadRequest when no fields provided', async () => {
      mockDb.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([mockMember]),
          }),
        }),
      });

      await expect(service.updateOwnProfile('user-1', {})).rejects.toThrow('No fields to update');
    });

    it('should throw NotFound if member profile not found', async () => {
      mockDb.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([]),
          }),
        }),
      });

      await expect(service.updateOwnProfile('bad-user', { phone: '555' })).rejects.toThrow(
        'Member profile not found',
      );
    });
  });

  // ============================================================
  // REQUEST PROFILE CHANGE (success path)
  // ============================================================
  describe('requestProfileChange - success', () => {
    it('should accept critical field changes and store as pendingChanges', async () => {
      mockDb.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([mockMember]),
          }),
        }),
      });

      mockDb.update.mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue(undefined),
        }),
      });

      const result = await service.requestProfileChange('user-1', { firstName: 'Jane' });
      expect(result.message).toBe('Change request submitted for admin review');
      expect(result.changes.firstName).toEqual({ from: 'John', to: 'Jane' });
    });

    it('should accept multiple critical fields at once', async () => {
      mockDb.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([mockMember]),
          }),
        }),
      });

      mockDb.update.mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue(undefined),
        }),
      });

      const result = await service.requestProfileChange('user-1', {
        firstName: 'Jane',
        lastName: 'Smith',
        city: 'Dallas',
      });
      expect(result.changes.firstName).toEqual({ from: 'John', to: 'Jane' });
      expect(result.changes.lastName).toEqual({ from: 'Doe', to: 'Smith' });
      expect(result.changes.city).toEqual({ from: 'Plano', to: 'Dallas' });
    });
  });

  // ============================================================
  // APPROVE CHANGE REQUEST
  // ============================================================
  describe('approveChangeRequest', () => {
    it('should apply pending changes and return updated member', async () => {
      const memberWithChanges = {
        ...mockMember,
        pendingChanges: {
          firstName: { from: 'John', to: 'Jane' },
          city: { from: 'Plano', to: 'Dallas' },
        },
      };
      const updatedMember = {
        ...mockMember,
        firstNameEnc: 'enc:Jane',
        city: 'Dallas',
        pendingChanges: null,
      };

      let selectCallCount = 0;
      const rulesData: any[] = [];
      mockDb.select.mockImplementation(() => {
        selectCallCount++;
        const data = selectCallCount === 1 ? memberWithChanges : updatedMember;
        const whereMock: any = vi.fn().mockImplementation(() => {
          const result = Object.assign(Promise.resolve(rulesData), {
            limit: vi.fn().mockResolvedValue([data]),
            then: (resolve: Function) => resolve(rulesData),
          });
          return result;
        });
        return {
          from: vi.fn().mockReturnValue({ where: whereMock }),
        };
      });

      mockDb.update.mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            returning: vi.fn().mockResolvedValue([updatedMember]),
          }),
        }),
      });

      const result = await service.approveChangeRequest('member-1', 'org-1');
      expect(result).toBeDefined();
      expect(mockEncryption.encrypt).toHaveBeenCalledWith('Jane');
    });

    it('should throw NotFound if member has no pending changes', async () => {
      mockDb.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([{ ...mockMember, pendingChanges: null }]),
          }),
        }),
      });

      await expect(service.approveChangeRequest('member-1', 'org-1')).rejects.toThrow(
        'No pending change request found',
      );
    });

    it('should throw NotFound if member does not exist', async () => {
      mockDb.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([]),
          }),
        }),
      });

      await expect(service.approveChangeRequest('bad-id', 'org-1')).rejects.toThrow(
        'No pending change request found',
      );
    });
  });

  // ============================================================
  // LIST MEMBERS
  // ============================================================
  describe('listMembers', () => {
    it('should return paginated list with meta', async () => {
      const members2 = [mockMember, { ...mockMember, id: 'member-2' }];

      mockDb.select.mockImplementation(() => ({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockImplementation(() => ({
            orderBy: vi.fn().mockReturnValue({
              limit: vi.fn().mockReturnValue({
                offset: vi.fn().mockResolvedValue(members2),
              }),
            }),
            // for the count query (no orderBy, returns array with count)
          })),
        }),
      }));

      // Override to handle both the data query and count query via Promise.all
      // The service calls db.select().from().where().orderBy().limit().offset() for data
      // and db.select({count}).from().where() for count
      mockDb.select.mockImplementation((selectArg?: any) => {
        if (selectArg && selectArg.count !== undefined) {
          // count query
          return {
            from: vi.fn().mockReturnValue({
              where: vi.fn().mockResolvedValue([{ count: 2 }]),
            }),
          };
        }
        // data query
        return {
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              orderBy: vi.fn().mockReturnValue({
                limit: vi.fn().mockReturnValue({
                  offset: vi.fn().mockResolvedValue(members2),
                }),
              }),
            }),
          }),
        };
      });

      const result = await service.listMembers('org-1', { page: 1, limit: 20 });
      expect(result.data).toHaveLength(2);
      expect(result.meta).toEqual({
        page: 1,
        limit: 20,
        total: 2,
        totalPages: 1,
      });
      expect(result.data[0].firstName).toBe('John');
    });

    it('should use default page and limit when not provided', async () => {
      mockDb.select.mockImplementation((selectArg?: any) => {
        if (selectArg && selectArg.count !== undefined) {
          return {
            from: vi.fn().mockReturnValue({
              where: vi.fn().mockResolvedValue([{ count: 0 }]),
            }),
          };
        }
        return {
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              orderBy: vi.fn().mockReturnValue({
                limit: vi.fn().mockReturnValue({
                  offset: vi.fn().mockResolvedValue([]),
                }),
              }),
            }),
          }),
        };
      });

      const result = await service.listMembers('org-1', {});
      expect(result.meta.page).toBe(1);
      expect(result.meta.limit).toBe(20);
      expect(result.data).toHaveLength(0);
    });
  });
});
