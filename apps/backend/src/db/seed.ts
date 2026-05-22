import { config } from 'dotenv';
config({ path: '../../.env' });
config({ path: '.env' });

import pg from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import { eq, isNull, sql } from 'drizzle-orm';
import * as argon2 from 'argon2';
import * as crypto from 'node:crypto';
import { generateMemberNumber } from '../lib/member-number.js';
import * as schema from './schema.js';

function encrypt(text: string): string {
  const key = Buffer.from(process.env.ENCRYPTION_KEY || '0'.repeat(64), 'hex');
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const authTag = cipher.getAuthTag().toString('hex');
  return `${iv.toString('hex')}:${authTag}:${encrypted}`;
}

export async function main(databaseUrl?: string) {
  const connStr = databaseUrl || process.env.DATABASE_URL;
  const pool = new pg.Pool({ connectionString: connStr });
  const db = drizzle(pool, { schema });

  try {
    console.log('Seeding database...\n');

    // 1. Organization
    const [existing] = await db
      .select()
      .from(schema.organizations)
      .where(eq(schema.organizations.slug, 'demo-org'))
      .limit(1);
    let org = existing;
    if (!org) {
      [org] = await db
        .insert(schema.organizations)
        .values({
          name: 'Demo Organization',
          slug: 'demo-org',
          settings: { maxConsecutiveMissedVotes: 2, magicLinkExpiryMinutes: 15 },
          updatedAt: new Date().toISOString(),
        })
        .returning();
    }
    console.log(`Organization: ${org.name} (${org.id})`);

    // 2. Admin user
    const adminPassword = await argon2.hash('AdminPass123!', { type: argon2.argon2id });
    const [existingAdmin] = await db
      .select()
      .from(schema.users)
      .where(eq(schema.users.email, 'admin@example.org'))
      .limit(1);
    if (!existingAdmin) {
      await db.insert(schema.users).values({
        organizationId: org.id,
        email: 'admin@example.org',
        role: 'SUPER_ADMIN',
        passwordHash: adminPassword,
        isActive: true,
        updatedAt: new Date().toISOString(),
      });
    }
    console.log('Admin: admin@example.org / AdminPass123!');

    // 3. Manager user
    const managerPassword = await argon2.hash('ManagerPass123!', { type: argon2.argon2id });
    const [existingManager] = await db
      .select()
      .from(schema.users)
      .where(eq(schema.users.email, 'manager@example.org'))
      .limit(1);
    if (!existingManager) {
      await db.insert(schema.users).values({
        organizationId: org.id,
        email: 'manager@example.org',
        role: 'MEMBERSHIP_MANAGER',
        passwordHash: managerPassword,
        isActive: true,
        updatedAt: new Date().toISOString(),
      });
    }
    console.log('Manager: manager@example.org / ManagerPass123!');

    // 3b. Viewer user
    const viewerPassword = await argon2.hash('ViewerPass123!', { type: argon2.argon2id });
    const [existingViewer] = await db
      .select()
      .from(schema.users)
      .where(eq(schema.users.email, 'viewer@example.org'))
      .limit(1);
    if (!existingViewer) {
      await db.insert(schema.users).values({
        organizationId: org.id,
        email: 'viewer@example.org',
        role: 'VIEWER',
        passwordHash: viewerPassword,
        isActive: true,
        updatedAt: new Date().toISOString(),
      });
    }
    console.log('Viewer: viewer@example.org / ViewerPass123!');

    // 5. Sample members — 185 diverse members for realistic demo
    const firstNames = [
      'James',
      'Fatima',
      'Raj',
      'Hassan',
      'Sarah',
      'Omar',
      'Ayesha',
      'Michael',
      'David',
      'Zainab',
      'Carlos',
      'Nadia',
      'Ahmed',
      'Jennifer',
      'Bilal',
      'Priya',
      'Khalid',
      'Emily',
      'Tariq',
      'Aisha',
      'Robert',
      'Samira',
      'Imran',
      'Jessica',
      'Yusuf',
      'Hina',
      'Brandon',
      'Maryam',
      'Ali',
      'Nicole',
      'Usman',
      'Isabella',
      'Hamza',
      'Ashley',
      'Faisal',
      'Deepa',
      'Luis',
      'Amna',
      'Arjun',
      'Christina',
      'Saad',
      'Sana',
      'Muhammad',
      'Rebecca',
      'Ibrahim',
      'Layla',
      'Christopher',
      'Rabia',
      'Daniel',
      'Khadija',
      'Brian',
      'Noor',
      'Salman',
      'Angela',
      'Waqas',
      'Farah',
      'Steven',
      'Ruqayyah',
      'Adnan',
      'Katherine',
      'Zahid',
      'Bushra',
      'Patrick',
      'Tahira',
      'Kevin',
      'Sadaf',
      'Gregory',
      'Hafsa',
      'Ricardo',
      'Asma',
      'Naveed',
      'Shannon',
      'Junaid',
      'Laura',
      'Kamran',
      'Aliya',
      'Anthony',
      'Lubna',
      'Nasir',
      'Heather',
      'Irfan',
      'Sumaya',
      'Timothy',
      'Zara',
      'Shoaib',
      'Maria',
      'Joseph',
      'Aneesa',
      'Rehan',
      'Danielle',
      'Aamir',
      'Mariam',
      'Jason',
      'Sabrina',
      'Farhan',
      'Meena',
      'Nathan',
      'Uzma',
      'Rizwan',
      'Michelle',
      'Owais',
      'Yasmin',
      'Scott',
      'Amber',
      'Shahid',
      'Reshma',
      'Mark',
      'Naila',
      'Talha',
      'Sandra',
      'Kashif',
      'Rania',
      'Derek',
      'Saima',
      'Mohsin',
      'Helen',
      'Tyler',
      'Samina',
      'Qasim',
      'Rachel',
      'Ejaz',
      'Tanveer',
      'Aaron',
      'Abida',
      'Waheed',
      'Sadia',
      'Terry',
      'Ghazala',
      'Nadeem',
      'Amanda',
      'Shafiq',
      'Rubina',
      'Keith',
      'Iram',
      'Mushtaq',
      'Shabana',
      'Kenneth',
      'Fouzia',
      'Pervez',
      'Donna',
      'Akbar',
      'Nasreen',
      'Wesley',
      'Zarqa',
      'Anwar',
      'Victoria',
      'Raymond',
      'Nargis',
      'Rafiq',
      'Tracy',
      'Babar',
      'Farzana',
      'Dennis',
      'Suraya',
      'Majid',
      'Deborah',
      'Howard',
      'Naheed',
      'Latif',
      'Cynthia',
      'Javed',
      'Parveen',
      'Ernest',
      'Kulsum',
      'Tahir',
      'Barbara',
      'Julian',
      'Gulshan',
      'Asad',
      'Karen',
      'Sajid',
      'Riffat',
      'Vincent',
      'Shamim',
      'Zubair',
      'Margaret',
      'Curtis',
      'Abeer',
      'Mazhar',
      'Laura',
      'Mansoor',
      'Robina',
      'Wayne',
      'Ghazal',
    ];
    const lastNames = [
      'Anderson',
      'Al-Rashidi',
      'Patel',
      'Khan',
      'Mitchell',
      'Al-Mahmoud',
      'Siddiqui',
      'Roberts',
      'Thompson',
      'Hussein',
      'Rivera',
      'Abbasi',
      'Malik',
      'Clark',
      'Qureshi',
      'Sharma',
      'Bukhari',
      'Davis',
      'Akhtar',
      'Wilson',
      'Chaudhry',
      'Lopez',
      'Mirza',
      'Walker',
      'Hashmi',
      'Garcia',
      'Sheikh',
      'Martinez',
      'Rizvi',
      'Taylor',
      'Javed',
      'Harris',
      'Farooqi',
      'White',
      'Kazmi',
      'Johnson',
      'Ansari',
      'Brown',
      'Zaidi',
      'Moore',
      'Naqvi',
      'Martin',
      'Gilani',
      'Lee',
      'Baig',
      'Hall',
      'Raza',
      'Allen',
      'Mughal',
      'Young',
      'Butt',
      'King',
      'Awan',
      'Wright',
      'Aslam',
      'Scott',
      'Niazi',
      'Green',
      'Durrani',
      'Baker',
      'Lodhi',
      'Adams',
      'Ghani',
      'Nelson',
      'Toor',
      'Hill',
      'Syed',
      'Campbell',
      'Bhatti',
      'Parker',
      'Dar',
      'Evans',
      'Gondal',
      'Turner',
      'Sipra',
      'Collins',
      'Sethi',
      'Edwards',
      'Rana',
      'Stewart',
      'Rajput',
      'Morris',
      'Gill',
      'Rogers',
      'Sandhu',
      'Cook',
      'Khokhar',
      'Morgan',
      'Wali',
      'Reed',
      'Qamar',
      'Bailey',
      'Essa',
      'Cooper',
      'Sial',
      'Howard',
      'Memon',
      'Bennett',
    ];
    // Accurate Collin County cities with real zip codes and population-weighted distribution
    // Weight represents relative population — members are distributed proportionally
    const cityDefs = [
      { city: 'Plano', zip: '75023', weight: 30 }, // ~290k pop, largest
      { city: 'Frisco', zip: '75034', weight: 22 }, // ~220k pop
      { city: 'McKinney', zip: '75071', weight: 20 }, // ~200k pop
      { city: 'Allen', zip: '75002', weight: 12 }, // ~105k pop
      { city: 'Wylie', zip: '75098', weight: 8 }, // ~55k pop
      { city: 'Prosper', zip: '75078', weight: 6 }, // ~35k pop
      { city: 'Murphy', zip: '75094', weight: 4 }, // ~22k pop
      { city: 'Celina', zip: '75009', weight: 4 }, // ~20k pop
      { city: 'Princeton', zip: '75407', weight: 3 }, // ~18k pop
      { city: 'Fairview', zip: '75069', weight: 3 }, // ~10k pop
      { city: 'Lucas', zip: '75002', weight: 2 }, // ~8k pop
      { city: 'Parker', zip: '75002', weight: 2 }, // ~5k pop
      { city: 'Anna', zip: '75409', weight: 2 }, // ~17k pop
      { city: 'Lavon', zip: '75166', weight: 1 }, // ~4k pop
      { city: 'Josephine', zip: '75189', weight: 1 }, // ~2k pop
    ];
    // Build weighted city list for distribution
    const weightedCities: typeof cityDefs = [];
    for (const def of cityDefs) {
      for (let w = 0; w < def.weight; w++) weightedCities.push(def);
    }
    const zipsForCity: Record<string, string> = {};
    const countyForCity: Record<string, string> = {};
    for (const def of cityDefs) {
      zipsForCity[def.city] = def.zip;
      countyForCity[def.city] = 'Collin'; // All cities are in Collin County
    }

    type MemberDef = {
      first: string;
      last: string;
      email: string;
      phone: string;
      city: string;
      state: string;
      zip: string;
      county: string;
      status: 'APPROVED' | 'PENDING' | 'REJECTED';
      type: 'VOTING' | 'GENERAL';
      dob: string;
      gender: string;
      applicationDate: string;
      membershipStartDate: string | null;
    };
    const sampleMembers: MemberDef[] = [];
    const TOTAL = 185;
    const genders = ['Male', 'Female'];
    for (let i = 0; i < TOTAL; i++) {
      const first = firstNames[i % firstNames.length];
      const last = lastNames[i % lastNames.length];
      const cityDef = weightedCities[i % weightedCities.length];
      const city = cityDef.city;
      const areaCode = ['972', '469', '214'][i % 3];
      const phoneNum = String(5140000 + i).padStart(7, '0');
      // 150 APPROVED VOTING, 15 APPROVED GENERAL, 10 PENDING, 10 REJECTED
      let status: 'APPROVED' | 'PENDING' | 'REJECTED' = 'APPROVED';
      let type: 'VOTING' | 'GENERAL' = 'VOTING';
      if (i >= 150 && i < 165) {
        status = 'APPROVED';
        type = 'GENERAL';
      } else if (i >= 165 && i < 175) {
        status = 'PENDING';
        type = 'GENERAL';
      } else if (i >= 175) {
        status = 'REJECTED';
        type = 'GENERAL';
      }
      // Spread DOBs across 1960-2000
      const year = 1960 + (i % 41);
      const month = String((i % 12) + 1).padStart(2, '0');
      const day = String((i % 28) + 1).padStart(2, '0');
      // Application dates: first 80 members from 2015-2023 (long-standing members with voting history),
      // remaining 105 spread across last 24 months (for good chart coverage)
      const now = new Date();
      let appDate: Date;
      if (i < 80) {
        // Long-standing members: spread from 2015 to mid-2023
        const startYear = 2015;
        const monthsSpan = 8 * 12; // 8 years
        const monthOffset = Math.floor((i / 80) * monthsSpan);
        appDate = new Date(startYear, monthOffset, (i % 28) + 1);
      } else {
        // Recent members: spread across last 24 months
        const monthsAgo = Math.floor(((i - 80) / (TOTAL - 80)) * 24);
        appDate = new Date(now.getFullYear(), now.getMonth() - monthsAgo, (i % 28) + 1);
      }
      const appYear = appDate.getFullYear();
      const appMonth = String(appDate.getMonth() + 1).padStart(2, '0');
      const appDay = String(appDate.getDate()).padStart(2, '0');
      // Approval happens 5-15 days after application
      const approvalDelay = 5 + (i % 11);
      const approvalDate = new Date(appDate.getTime() + approvalDelay * 86400000);
      const msDate = status === 'APPROVED' ? approvalDate.toISOString().slice(0, 10) : null;
      sampleMembers.push({
        first,
        last,
        email: `${first.toLowerCase()}.${last.toLowerCase().replace(/[^a-z]/g, '')}${i}@example.com`,
        phone: `(${areaCode}) ${phoneNum.slice(0, 3)}-${phoneNum.slice(3)}`,
        city,
        state: 'TX',
        zip: zipsForCity[city] || '75023',
        county: countyForCity[city] || 'Collin',
        status,
        type,
        dob: `${year}-${month}-${day}`,
        gender: genders[i % 2],
        applicationDate: `${appYear}-${appMonth}-${appDay}`,
        membershipStartDate: msDate,
      });
    }

    let created = 0;
    // Check if we already have enough members
    const [{ count: existingCount }] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(schema.members)
      .where(eq(schema.members.organizationId, org.id));
    if (existingCount === 0 || existingCount !== TOTAL) {
      // Clear existing data and re-create (respect FK order)
      if (existingCount > 0) {
        await db.delete(schema.users).where(eq(schema.users.role, 'MEMBER'));
        await db.delete(schema.members).where(eq(schema.members.organizationId, org.id));
      }
      for (const m of sampleMembers) {
        await db.insert(schema.members).values({
          organizationId: org.id,
          firstNameEnc: encrypt(m.first),
          lastNameEnc: encrypt(m.last),
          emailEnc: encrypt(m.email),
          phoneEnc: encrypt(m.phone),
          dobEnc: encrypt(m.dob),
          dlNumberEnc: encrypt('DL' + Math.random().toString().slice(2, 10)),
          streetAddressEnc: encrypt(
            `${Math.floor(Math.random() * 9000 + 1000)} ${['Oak', 'Elm', 'Main', 'Park', 'Cedar', 'Maple', 'Pine', 'Birch', 'Walnut', 'Willow'][created % 10]} ${['Ave', 'Blvd', 'St', 'Dr', 'Ln', 'Ct', 'Way', 'Pl'][created % 8]}`,
          ),
          city: m.city,
          state: m.state,
          zipCode: m.zip,
          county: m.county,
          gender: m.gender,
          status: m.status,
          memberType: m.type,
          applicationDate: new Date(m.applicationDate).toISOString(),
          membershipStartDate: m.membershipStartDate
            ? new Date(m.membershipStartDate).toISOString()
            : undefined,
          updatedAt: new Date().toISOString(),
        });
        created++;
      }
    }
    console.log(`Members: ${created} created (${sampleMembers.length} total)`);

    // 5b. Create user accounts for approved members (so they can login)
    const approvedMembersForUsers = await db
      .select()
      .from(schema.members)
      .where(eq(schema.members.status, 'APPROVED'));
    let usersCreated = 0;
    for (const member of approvedMembersForUsers) {
      if (member.userId) continue; // already has a user
      // Decrypt email
      const parts = member.emailEnc.split(':');
      if (parts.length !== 3) continue;
      const iv = Buffer.from(parts[0], 'hex');
      const authTag = Buffer.from(parts[1], 'hex');
      const key = Buffer.from(process.env.ENCRYPTION_KEY || '0'.repeat(64), 'hex');
      const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
      decipher.setAuthTag(authTag);
      let email = decipher.update(parts[2], 'hex', 'utf8');
      email += decipher.final('utf8');

      // Check if user already exists
      const [existingUser] = await db
        .select()
        .from(schema.users)
        .where(eq(schema.users.email, email.toLowerCase()))
        .limit(1);
      if (existingUser) {
        // Only link if no other member already claims this user
        const [alreadyLinked] = await db
          .select()
          .from(schema.members)
          .where(eq(schema.members.userId, existingUser.id))
          .limit(1);
        if (!alreadyLinked) {
          await db
            .update(schema.members)
            .set({ userId: existingUser.id, updatedAt: new Date().toISOString() })
            .where(eq(schema.members.id, member.id));
        }
        continue;
      }

      const [newUser] = await db
        .insert(schema.users)
        .values({
          organizationId: org.id,
          email: email.toLowerCase(),
          role: 'MEMBER',
          isActive: true,
          updatedAt: new Date().toISOString(),
        })
        .returning();

      await db
        .update(schema.members)
        .set({ userId: newUser.id, updatedAt: new Date().toISOString() })
        .where(eq(schema.members.id, member.id));
      usersCreated++;
    }
    if (usersCreated > 0)
      console.log(`Member users: ${usersCreated} created (for magic link login)`);
    // 6b. Change requests (members with pending profile changes)
    // Decrypt actual member data to generate realistic change requests
    const approvedWithUser = await db
      .select()
      .from(schema.members)
      .where(eq(schema.members.status, 'APPROVED'));

    // Helper to decrypt a member field safely
    const tryDecrypt = (enc: string): string => {
      try {
        const parts = enc.split(':');
        if (parts.length !== 3) return '—';
        const iv = Buffer.from(parts[0], 'hex');
        const authTag = Buffer.from(parts[1], 'hex');
        const key = Buffer.from(process.env.ENCRYPTION_KEY || '0'.repeat(64), 'hex');
        const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
        decipher.setAuthTag(authTag);
        return decipher.update(parts[2], 'hex', 'utf8') + decipher.final('utf8');
      } catch {
        return '—';
      }
    };

    let changeReqCount = 0;
    // Pick 4 members at different indices for variety
    const changeIndices = [5, 20, 45, 80].filter((idx) => idx < approvedWithUser.length);
    for (let ci = 0; ci < changeIndices.length; ci++) {
      const member = approvedWithUser[changeIndices[ci]];
      if (member.pendingChanges) continue;

      const lastName = tryDecrypt(member.lastNameEnc);
      const scenarios = [
        { lastName: { from: lastName, to: `${lastName}-Ahmed` } },
        {
          city: { from: member.city, to: member.city === 'Plano' ? 'Frisco' : 'Plano' },
          zipCode: { from: member.zipCode, to: member.zipCode === '75023' ? '75034' : '75023' },
        },
        { streetAddress: { from: 'current', to: '9210 Legacy Dr' } },
        {
          city: { from: member.city, to: 'McKinney' },
          zipCode: { from: member.zipCode, to: '75071' },
        },
      ];

      await db
        .update(schema.members)
        .set({
          pendingChanges: scenarios[ci % scenarios.length],
          updatedAt: new Date().toISOString(),
        })
        .where(eq(schema.members.id, member.id));
      changeReqCount++;
    }
    if (changeReqCount > 0) console.log(`Change requests: ${changeReqCount} pending`);

    // 6c. Demo member with password login (for member portal demo)
    const memberPassword = await argon2.hash('MemberPass123!', { type: argon2.argon2id });
    const [demoMemberUser] = await db
      .select()
      .from(schema.users)
      .where(eq(schema.users.email, 'raj.patel2@example.com'))
      .limit(1);
    if (demoMemberUser) {
      await db
        .update(schema.users)
        .set({
          passwordHash: memberPassword,
          updatedAt: new Date().toISOString(),
        })
        .where(eq(schema.users.id, demoMemberUser.id));
      console.log('Demo member: raj.patel2@example.com / MemberPass123!');
    }

    // 7. Audit log entries
    const [existingLog] = await db.select().from(schema.auditLogs).limit(1);
    if (!existingLog) {
      const [admin] = await db
        .select()
        .from(schema.users)
        .where(eq(schema.users.email, 'admin@example.org'))
        .limit(1);
      if (admin) {
        const auditEntries = [
          {
            action: 'POST',
            table: 'members',
            record: 'seed-approve',
            values: { status: 'APPROVED' },
          },
          {
            action: 'POST',
            table: 'members',
            record: 'seed-approve-2',
            values: { status: 'APPROVED' },
          },
          { action: 'PATCH', table: 'members', record: 'seed-update', values: { city: 'Frisco' } },
          { action: 'POST', table: 'voting', record: 'seed-event', values: { title: 'AGM 2025' } },
          {
            action: 'POST',
            table: 'voting',
            record: 'seed-finalize',
            values: { isFinalized: true },
          },
          { action: 'DELETE', table: 'eligibility-rules', record: 'seed-rule-del', values: null },
          {
            action: 'POST',
            table: 'admin',
            record: 'seed-user-create',
            values: { role: 'VIEWER' },
          },
        ];
        for (const entry of auditEntries) {
          await db.insert(schema.auditLogs).values({
            organizationId: org.id,
            userId: admin.id,
            tableName: entry.table,
            recordId: entry.record,
            action: entry.action,
            newValues: entry.values,
            ipAddress: '127.0.0.1',
          });
        }
        console.log(`Audit logs: ${auditEntries.length} entries`);
      }
    }

    // 8. Backfill member numbers for existing members
    const membersWithoutNumber = await db
      .select({ id: schema.members.id })
      .from(schema.members)
      .where(isNull(schema.members.memberNumber));
    for (const m of membersWithoutNumber) {
      const num = await generateMemberNumber(db);
      await db
        .update(schema.members)
        .set({ memberNumber: num, updatedAt: new Date().toISOString() })
        .where(eq(schema.members.id, m.id));
    }
    if (membersWithoutNumber.length > 0)
      console.log(`Member numbers: ${membersWithoutNumber.length} backfilled`);

    // 9. Backfill search index for encrypted search
    const membersWithoutIndex = await db
      .select({
        id: schema.members.id,
        firstNameEnc: schema.members.firstNameEnc,
        lastNameEnc: schema.members.lastNameEnc,
        emailEnc: schema.members.emailEnc,
        city: schema.members.city,
        zipCode: schema.members.zipCode,
        memberNumber: schema.members.memberNumber,
      })
      .from(schema.members)
      .where(isNull(schema.members.searchIndex));
    if (membersWithoutIndex.length > 0) {
      const encKey = process.env.ENCRYPTION_KEY || '0'.repeat(64);
      for (const m of membersWithoutIndex) {
        try {
          const key = Buffer.from(encKey, 'hex');
          const dec = (enc: string) => {
            const parts = enc.split(':');
            if (parts.length !== 3) return '';
            const iv = Buffer.from(parts[0], 'hex');
            const authTag = Buffer.from(parts[1], 'hex');
            const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
            decipher.setAuthTag(authTag);
            return decipher.update(parts[2], 'hex', 'utf8') + decipher.final('utf8');
          };
          const hmac = (val: string) =>
            crypto
              .createHmac('sha256', key)
              .update(val.toLowerCase().trim())
              .digest('hex')
              .slice(0, 16);
          const words = [
            dec(m.firstNameEnc),
            dec(m.lastNameEnc),
            dec(m.emailEnc),
            m.city,
            m.zipCode,
            m.memberNumber || '',
          ].filter(Boolean);
          const tokens = words.flatMap((w) => {
            const lw = w.toLowerCase().trim();
            const t = [hmac(lw)];
            for (const word of lw.split(/\s+/)) {
              t.push(hmac(word));
              if (word.length >= 3) t.push(hmac(word.slice(0, 3)));
            }
            return t;
          });
          await db
            .update(schema.members)
            .set({
              searchIndex: [...new Set(tokens)].join(' '),
              updatedAt: new Date().toISOString(),
            })
            .where(eq(schema.members.id, m.id));
        } catch {
          /* skip */
        }
      }
      console.log(`Search index: ${membersWithoutIndex.length} members indexed`);
    }

    console.log('\nSeed complete!');
  } finally {
    await pool.end();
  }
}

// Only run when executed directly (not when imported by cron endpoint)
const isDirectExecution =
  process.argv[1]?.endsWith('seed.js') || process.argv[1]?.endsWith('seed.ts');
if (isDirectExecution) {
  main().catch((e) => {
    console.error('Seed failed:', e);
    process.exit(1);
  });
}
