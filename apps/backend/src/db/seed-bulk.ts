/**
 * Generate 200 demo members with diverse names and realistic data.
 * Run after main seed: npx tsx src/db/seed-bulk.ts
 */
import { config } from 'dotenv';
config({ path: '../../.env' });

import pg from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import { eq } from 'drizzle-orm';
import * as crypto from 'node:crypto';
import * as schema from './schema.js';
import { generateMemberNumber } from '../lib/member-number.js';

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const db = drizzle(pool, { schema });

function encrypt(text: string): string {
  const key = Buffer.from(process.env.ENCRYPTION_KEY || '0'.repeat(64), 'hex');
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  return `${iv.toString('hex')}:${cipher.getAuthTag().toString('hex')}:${encrypted}`;
}

const FIRST_NAMES = [
  // Caucasian
  'James',
  'Emily',
  'Robert',
  'Jessica',
  'Michael',
  'Sarah',
  'David',
  'Jennifer',
  'William',
  'Amanda',
  'Daniel',
  'Stephanie',
  'Christopher',
  'Nicole',
  'Matthew',
  'Ashley',
  'Andrew',
  'Megan',
  'Joshua',
  'Brittany',
  'Brian',
  'Lauren',
  'Kevin',
  'Rachel',
  'Brandon',
  'Samantha',
  'Ryan',
  'Katherine',
  'Jason',
  'Elizabeth',
  // Arab
  'Ahmed',
  'Fatima',
  'Omar',
  'Aisha',
  'Hassan',
  'Layla',
  'Ali',
  'Noor',
  'Khalid',
  'Mariam',
  'Mohammed',
  'Hana',
  'Youssef',
  'Sara',
  'Ibrahim',
  'Dalal',
  'Tariq',
  'Reem',
  'Faisal',
  'Amira',
  // Indian
  'Raj',
  'Priya',
  'Arjun',
  'Ananya',
  'Vikram',
  'Deepa',
  'Arun',
  'Meera',
  'Sanjay',
  'Kavita',
  'Rahul',
  'Neha',
  'Suresh',
  'Pooja',
  'Kiran',
  'Sunita',
  'Rohan',
  'Isha',
  'Nikhil',
  'Divya',
  // Pakistani
  'Hassan',
  'Ayesha',
  'Bilal',
  'Sana',
  'Usman',
  'Zainab',
  'Imran',
  'Nadia',
  'Kamran',
  'Hira',
  'Faizan',
  'Amna',
  'Saad',
  'Bushra',
  'Hamza',
  'Rabia',
  'Junaid',
  'Madiha',
  'Farhan',
  'Sadia',
  // Hispanic
  'Carlos',
  'Maria',
  'Luis',
  'Carmen',
  'Diego',
  'Sofia',
  'Miguel',
  'Isabella',
  'Ricardo',
  'Valentina',
];

const LAST_NAMES = [
  // Caucasian
  'Anderson',
  'Thompson',
  'Mitchell',
  'Roberts',
  'Wilson',
  'Taylor',
  'Johnson',
  'Williams',
  'Brown',
  'Davis',
  'Miller',
  'Jackson',
  'White',
  'Harris',
  'Clark',
  'Lewis',
  'Walker',
  'Hall',
  'Young',
  'King',
  // Arab
  'Al-Rashidi',
  'Al-Mahmoud',
  'Al-Farsi',
  'Al-Sayed',
  'Al-Hashimi',
  'Al-Khalifa',
  'Al-Nasser',
  'Al-Dosari',
  'Mansouri',
  'Zahrani',
  // Indian
  'Patel',
  'Sharma',
  'Gupta',
  'Singh',
  'Reddy',
  'Kumar',
  'Nair',
  'Joshi',
  'Desai',
  'Rao',
  // Pakistani
  'Khan',
  'Siddiqui',
  'Abbasi',
  'Malik',
  'Hussain',
  'Qureshi',
  'Raza',
  'Sheikh',
  'Iqbal',
  'Butt',
  // Hispanic
  'Rivera',
  'Rodriguez',
  'Garcia',
  'Martinez',
  'Lopez',
  'Hernandez',
  'Torres',
  'Ramirez',
  'Flores',
  'Gomez',
];

const CITIES = [
  {
    city: 'Chicago',
    state: 'IL',
    zips: ['60601', '60602', '60605', '60606', '60614'],
    county: 'Cook',
  },
  {
    city: 'Phoenix',
    state: 'AZ',
    zips: ['85001', '85003', '85004', '85006', '85008'],
    county: 'Maricopa',
  },
  {
    city: 'Atlanta',
    state: 'GA',
    zips: ['30301', '30303', '30305', '30306', '30309'],
    county: 'Fulton',
  },
  {
    city: 'Seattle',
    state: 'WA',
    zips: ['98101', '98102', '98103', '98105', '98107'],
    county: 'King',
  },
  {
    city: 'Denver',
    state: 'CO',
    zips: ['80201', '80202', '80203', '80204', '80205'],
    county: 'Denver',
  },
  {
    city: 'Houston',
    state: 'TX',
    zips: ['77001', '77002', '77003', '77004', '77005'],
    county: 'Harris',
  },
  {
    city: 'Boston',
    state: 'MA',
    zips: ['02101', '02110', '02111', '02116', '02118'],
    county: 'Suffolk',
  },
  {
    city: 'Miami',
    state: 'FL',
    zips: ['33101', '33102', '33125', '33127', '33128'],
    county: 'Miami-Dade',
  },
  {
    city: 'Minneapolis',
    state: 'MN',
    zips: ['55401', '55402', '55403', '55404', '55408'],
    county: 'Hennepin',
  },
  {
    city: 'Portland',
    state: 'OR',
    zips: ['97201', '97202', '97203', '97204', '97205'],
    county: 'Multnomah',
  },
  {
    city: 'Nashville',
    state: 'TN',
    zips: ['37201', '37203', '37204', '37205', '37206'],
    county: 'Davidson',
  },
  {
    city: 'Austin',
    state: 'TX',
    zips: ['78701', '78702', '78703', '78704', '78705'],
    county: 'Travis',
  },
];

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

async function main() {
  const [org] = await db.select().from(schema.organizations).limit(1);
  if (!org) {
    console.error('No org found. Run main seed first.');
    process.exit(1);
  }

  const existing = await db.select({ id: schema.members.id }).from(schema.members);
  const target = 200;
  const toCreate = target - existing.length;
  if (toCreate <= 0) {
    console.log(`Already have ${existing.length} members.`);
    await pool.end();
    return;
  }

  console.log(`Creating ${toCreate} members (have ${existing.length}, target ${target})...`);

  const statuses: Array<'APPROVED' | 'PENDING' | 'REJECTED'> = [];
  // 60% approved, 25% pending, 15% rejected
  for (let i = 0; i < toCreate; i++) {
    const r = Math.random();
    statuses.push(r < 0.6 ? 'APPROVED' : r < 0.85 ? 'PENDING' : 'REJECTED');
  }

  let created = 0;
  for (const status of statuses) {
    const first = pick(FIRST_NAMES);
    const last = pick(LAST_NAMES);
    const loc = pick(CITIES);
    const zip = pick(loc.zips);
    const email = `${first.toLowerCase()}.${last.toLowerCase()}${Math.floor(Math.random() * 999)}@example.com`;
    const areaCodes: Record<string, string[]> = {
      IL: ['312', '773'],
      AZ: ['602', '480'],
      GA: ['404', '678'],
      WA: ['206', '425'],
      CO: ['303', '720'],
      TX: ['713', '832'],
      MA: ['617', '857'],
      FL: ['305', '786'],
      MN: ['612', '651'],
      OR: ['503', '971'],
      TN: ['615', '629'],
    };
    const stateCodes = areaCodes[loc.state] || ['555'];
    const phone = `(${pick(stateCodes)}) ${Math.floor(100 + Math.random() * 900)}-${Math.floor(1000 + Math.random() * 9000)}`;
    const memberNumber = await generateMemberNumber(db);
    const memberType = 'GENERAL';

    const now = new Date().toISOString();
    const appDate = new Date(
      Date.now() - Math.floor(Math.random() * 90 * 24 * 60 * 60 * 1000),
    ).toISOString();

    await db.insert(schema.members).values({
      memberNumber,
      organizationId: org.id,
      firstNameEnc: encrypt(first),
      lastNameEnc: encrypt(last),
      emailEnc: encrypt(email),
      phoneEnc: encrypt(phone),
      dobEnc: encrypt(
        `${1970 + Math.floor(Math.random() * 35)}-${String(1 + Math.floor(Math.random() * 12)).padStart(2, '0')}-${String(1 + Math.floor(Math.random() * 28)).padStart(2, '0')}`,
      ),
      dlNumberEnc: encrypt('pending-verification'),
      streetAddressEnc: encrypt(
        `${Math.floor(1000 + Math.random() * 9000)} ${pick(['Oak', 'Elm', 'Main', 'Cedar', 'Park', 'Lake', 'Spring', 'Hill', 'River', 'Forest'])} ${pick(['St', 'Ave', 'Blvd', 'Dr', 'Ln', 'Way', 'Ct'])}`,
      ),
      city: loc.city,
      state: loc.state,
      zipCode: zip,
      county: loc.county,
      gender: pick(['Male', 'Female', 'Non-binary', 'Prefer not to say']),
      status,
      memberType,
      applicationDate: appDate,
      ...(status === 'APPROVED' ? { approvedAt: now, membershipStartDate: now } : {}),
      ...(status === 'REJECTED'
        ? {
            rejectedAt: now,
            rejectionReason: pick([
              'Address mismatch',
              'Incomplete documentation',
              'Failed verification',
              'Duplicate application',
            ]),
          }
        : {}),
      updatedAt: now,
    });

    // Create user for approved members
    if (status === 'APPROVED') {
      const [newUser] = await db
        .insert(schema.users)
        .values({
          organizationId: org.id,
          email: email.toLowerCase(),
          role: 'MEMBER',
          isActive: true,
          updatedAt: now,
        })
        .returning();
      // Link
      const [mem] = await db
        .select()
        .from(schema.members)
        .where(eq(schema.members.memberNumber, memberNumber))
        .limit(1);
      if (mem && newUser) {
        await db
          .update(schema.members)
          .set({ userId: newUser.id })
          .where(eq(schema.members.id, mem.id));
      }
    }

    created++;
    if (created % 50 === 0) console.log(`  ${created}/${toCreate} created...`);
  }

  console.log(`
Done! Created ${created} members.`);
  console.log(`Total members: ${existing.length + created}`);
  await pool.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
