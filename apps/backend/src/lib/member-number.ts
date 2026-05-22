import { sql } from 'drizzle-orm';
import { members } from '../db/schema.js';
import type { Db } from '../db/index.js';

/**
 * Generate a sequential member number: MEM-YYYY-NNNNN
 * e.g., MEM-2026-00001, MEM-2026-00042
 */
export async function generateMemberNumber(db: Db): Promise<string> {
  const year = new Date().getFullYear();
  const prefix = `MEM-${year}-`;

  // Find the highest number for this year
  const [result] = await db.select({ maxNum: sql<string>`max(member_number)` }).from(members);

  const maxNum = result?.maxNum;
  let nextSeq = 1;

  if (maxNum && maxNum.startsWith(prefix)) {
    const seq = parseInt(maxNum.slice(prefix.length), 10);
    if (!isNaN(seq)) nextSeq = seq + 1;
  }

  return `${prefix}${String(nextSeq).padStart(5, '0')}`;
}
