
import { serial, text, pgTable, timestamp, integer, boolean, jsonb } from 'drizzle-orm/pg-core';

// Scan sessions table - tracks when users scan their repositories
export const scanSessionsTable = pgTable('scan_sessions', {
  id: serial('id').primaryKey(),
  username: text('username').notNull(),
  totalRepositories: integer('total_repositories').notNull(),
  scannedAt: timestamp('scanned_at').defaultNow().notNull(),
});

// Scanned repositories table - stores individual repository scan results
export const scannedRepositoriesTable = pgTable('scanned_repositories', {
  id: serial('id').primaryKey(),
  sessionId: integer('session_id').notNull().references(() => scanSessionsTable.id),
  name: text('name').notNull(),
  description: text('description'), // Nullable
  url: text('url').notNull(),
  isPrivate: boolean('is_private').notNull(),
  language: text('language'), // Nullable
  stars: integer('stars').notNull(),
  forks: integer('forks').notNull(),
  qualityScore: jsonb('quality_score').notNull(), // Store the quality score breakdown as JSON
  scannedAt: timestamp('scanned_at').defaultNow().notNull(),
});

// TypeScript types for the table schemas
export type ScanSession = typeof scanSessionsTable.$inferSelect;
export type NewScanSession = typeof scanSessionsTable.$inferInsert;
export type ScannedRepository = typeof scannedRepositoriesTable.$inferSelect;
export type NewScannedRepository = typeof scannedRepositoriesTable.$inferInsert;

// Export all tables for relation queries
export const tables = { 
  scanSessions: scanSessionsTable,
  scannedRepositories: scannedRepositoriesTable,
};
