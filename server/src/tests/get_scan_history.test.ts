
import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { scanSessionsTable, scannedRepositoriesTable } from '../db/schema';
import { getScanHistory } from '../handlers/get_scan_history';
import { type RepositoryQualityScore } from '../schema';

describe('getScanHistory', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  const sampleQualityScore: RepositoryQualityScore = {
    repositoryName: 15,
    readmeExists: 10,
    readmeContent: {
      quickPresentation: 8,
      badges: 5,
      installationSection: 6,
      usageSection: 7,
      goalSection: 5,
      roadmapSection: 4,
      licenceSection: 8,
      total: 43,
    },
    licenseFile: 15,
    totalScore: 83,
  };

  it('should return empty array for user with no scan history', async () => {
    const result = await getScanHistory('nonexistent_user');
    expect(result).toEqual([]);
  });

  it('should return scan history for user with one session', async () => {
    // Create a scan session
    const sessionResult = await db.insert(scanSessionsTable)
      .values({
        username: 'testuser',
        totalRepositories: 2,
      })
      .returning()
      .execute();

    const sessionId = sessionResult[0].id;

    // Create repositories for this session
    await db.insert(scannedRepositoriesTable)
      .values([
        {
          sessionId,
          name: 'repo1',
          description: 'First repository',
          url: 'https://github.com/testuser/repo1',
          isPrivate: false,
          language: 'JavaScript',
          stars: 10,
          forks: 5,
          qualityScore: sampleQualityScore,
        },
        {
          sessionId,
          name: 'repo2',
          description: null,
          url: 'https://github.com/testuser/repo2',
          isPrivate: true,
          language: null,
          stars: 0,
          forks: 0,
          qualityScore: sampleQualityScore,
        },
      ])
      .execute();

    const results = await getScanHistory('testuser');

    expect(results).toHaveLength(1);
    expect(results[0].username).toBe('testuser');
    expect(results[0].totalRepositories).toBe(2);
    expect(results[0].repositories).toHaveLength(2);
    expect(results[0].scannedAt).toBeInstanceOf(Date);

    // Check first repository
    const repo1 = results[0].repositories.find(r => r.name === 'repo1');
    expect(repo1).toBeDefined();
    expect(repo1!.description).toBe('First repository');
    expect(repo1!.url).toBe('https://github.com/testuser/repo1');
    expect(repo1!.isPrivate).toBe(false);
    expect(repo1!.language).toBe('JavaScript');
    expect(repo1!.stars).toBe(10);
    expect(repo1!.forks).toBe(5);
    expect(repo1!.qualityScore).toEqual(sampleQualityScore);

    // Check second repository
    const repo2 = results[0].repositories.find(r => r.name === 'repo2');
    expect(repo2).toBeDefined();
    expect(repo2!.description).toBe(null);
    expect(repo2!.language).toBe(null);
  });

  it('should return multiple scan sessions ordered by most recent first', async () => {
    const now = new Date();
    const olderDate = new Date(now.getTime() - 24 * 60 * 60 * 1000); // 1 day ago

    // Create older session first
    const olderSessionResult = await db.insert(scanSessionsTable)
      .values({
        username: 'testuser',
        totalRepositories: 1,
        scannedAt: olderDate,
      })
      .returning()
      .execute();

    // Create newer session
    const newerSessionResult = await db.insert(scanSessionsTable)
      .values({
        username: 'testuser',
        totalRepositories: 1,
        scannedAt: now,
      })
      .returning()
      .execute();

    // Add repositories to both sessions
    await db.insert(scannedRepositoriesTable)
      .values([
        {
          sessionId: olderSessionResult[0].id,
          name: 'old-repo',
          description: 'Old repository',
          url: 'https://github.com/testuser/old-repo',
          isPrivate: false,
          language: 'Python',
          stars: 5,
          forks: 2,
          qualityScore: sampleQualityScore,
        },
        {
          sessionId: newerSessionResult[0].id,
          name: 'new-repo',
          description: 'New repository',
          url: 'https://github.com/testuser/new-repo',
          isPrivate: false,
          language: 'TypeScript',
          stars: 15,
          forks: 8,
          qualityScore: sampleQualityScore,
        },
      ])
      .execute();

    const results = await getScanHistory('testuser');

    expect(results).toHaveLength(2);
    
    // First result should be the newer session
    expect(results[0].repositories[0].name).toBe('new-repo');
    expect(results[0].scannedAt >= results[1].scannedAt).toBe(true);
    
    // Second result should be the older session
    expect(results[1].repositories[0].name).toBe('old-repo');
  });

  it('should handle user with sessions but no repositories', async () => {
    // Create session without repositories
    await db.insert(scanSessionsTable)
      .values({
        username: 'testuser',
        totalRepositories: 0,
      })
      .execute();

    const results = await getScanHistory('testuser');

    expect(results).toHaveLength(1);
    expect(results[0].username).toBe('testuser');
    expect(results[0].totalRepositories).toBe(0);
    expect(results[0].repositories).toHaveLength(0);
  });
});
