import { and, desc, eq, inArray } from 'drizzle-orm';
import type { Clock } from '../clock.js';
import type { Queryable, Tx } from '../db/client.js';
import {
  accounts,
  announcementReads,
  announcements,
  feedbackEntries,
  type FeedbackKind,
} from '../db/schema.js';
import { publishGlobal } from '../stream/bus.js';

export async function listAnnouncements(db: Queryable, accountId: string) {
  const rows = await db
    .select({
      id: announcements.id,
      title: announcements.title,
      bodyHtml: announcements.bodyHtml,
      publishedAt: announcements.publishedAt,
    })
    .from(announcements)
    .orderBy(desc(announcements.publishedAt), desc(announcements.id))
    .limit(30);
  if (rows.length === 0) return { announcements: [] };

  const readRows = await db
    .select({ announcementId: announcementReads.announcementId })
    .from(announcementReads)
    .where(and(
      eq(announcementReads.accountId, accountId),
      inArray(announcementReads.announcementId, rows.map((row) => row.id)),
    ));
  const read = new Set(readRows.map((row) => row.announcementId));
  return {
    announcements: rows.map((row) => ({ ...row, seen: read.has(row.id) })),
  };
}

export async function markAnnouncementsRead(
  db: Queryable,
  accountId: string,
  ids: readonly string[],
  clock: Clock,
): Promise<{ marked: number }> {
  if (ids.length === 0) return { marked: 0 };
  const existing = await db
    .select({ id: announcements.id })
    .from(announcements)
    .where(inArray(announcements.id, [...ids]));
  if (existing.length === 0) return { marked: 0 };
  const inserted = await db
    .insert(announcementReads)
    .values(existing.map(({ id }) => ({ accountId, announcementId: id, readAt: clock.now() })))
    .onConflictDoNothing()
    .returning({ id: announcementReads.announcementId });
  return { marked: inserted.length };
}

export async function publishAnnouncement(
  db: Tx,
  authorAccountId: string,
  input: { title: string; bodyHtml: string },
  clock: Clock,
) {
  const [created] = await db
    .insert(announcements)
    .values({ ...input, authorAccountId, publishedAt: clock.now() })
    .returning({
      id: announcements.id,
      title: announcements.title,
      bodyHtml: announcements.bodyHtml,
      publishedAt: announcements.publishedAt,
    });
  if (!created) throw new Error('announcement insert returned no row');
  await publishGlobal(db, 'announcement');
  return { announcement: { ...created, seen: false } };
}

export async function submitFeedback(
  db: Queryable,
  accountId: string,
  input: { kind: FeedbackKind; message: string },
  clock: Clock,
) {
  const [created] = await db
    .insert(feedbackEntries)
    .values({ ...input, accountId, createdAt: clock.now() })
    .returning({ id: feedbackEntries.id, createdAt: feedbackEntries.createdAt });
  if (!created) throw new Error('feedback insert returned no row');
  return { feedback: created };
}

export async function listFeedback(db: Queryable) {
  const feedback = await db
    .select({
      id: feedbackEntries.id,
      kind: feedbackEntries.kind,
      message: feedbackEntries.message,
      createdAt: feedbackEntries.createdAt,
      accountId: feedbackEntries.accountId,
      username: accounts.username,
      displayName: accounts.displayName,
    })
    .from(feedbackEntries)
    .innerJoin(accounts, eq(feedbackEntries.accountId, accounts.id))
    .orderBy(desc(feedbackEntries.createdAt), desc(feedbackEntries.id))
    .limit(100);
  return { feedback };
}
