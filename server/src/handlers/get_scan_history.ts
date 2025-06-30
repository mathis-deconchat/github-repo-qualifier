
import { db } from '../db';
import { scanSessionsTable, scannedRepositoriesTable } from '../db/schema';
import { type GitHubScanResult, type RepositoryQualityScore, type ScannedRepository as SchemaScannedRepository } from '../schema';
import { eq, desc, inArray } from 'drizzle-orm';

export async function getScanHistory(userId: number): Promise<GitHubScanResult[]> {
  try {
    // Get all scan sessions for the authenticated user, ordered by most recent first
    const sessions = await db.select()
      .from(scanSessionsTable)
      .where(eq(scanSessionsTable.userId, userId))
      .orderBy(desc(scanSessionsTable.scannedAt))
      .execute();

    if (sessions.length === 0) {
      return [];
    }

    // Get all repositories for all sessions
    const sessionIds = sessions.map(session => session.id);
    const allRepositories = await db.select()
      .from(scannedRepositoriesTable)
      .where(inArray(scannedRepositoriesTable.sessionId, sessionIds))
      .execute();

    // Group repositories by session ID
    const repositoriesBySession = new Map<number, typeof allRepositories>();
    for (const repo of allRepositories) {
      if (!repositoriesBySession.has(repo.sessionId)) {
        repositoriesBySession.set(repo.sessionId, []);
      }
      repositoriesBySession.get(repo.sessionId)!.push(repo);
    }

    // Transform to GitHubScanResult format
    const results: GitHubScanResult[] = sessions.map(session => ({
      username: session.username,
      totalRepositories: session.totalRepositories,
      repositories: (repositoriesBySession.get(session.id) || []).map(repo => ({
        id: repo.id,
        name: repo.name,
        description: repo.description,
        url: repo.url,
        isPrivate: repo.isPrivate,
        language: repo.language,
        stars: repo.stars,
        forks: repo.forks,
        qualityScore: repo.qualityScore as RepositoryQualityScore,
        scannedAt: repo.scannedAt,
      })),
      scannedAt: session.scannedAt,
    }));

    return results;
  } catch (error) {
    console.error('Failed to get scan history:', error);
    throw error;
  }
}
