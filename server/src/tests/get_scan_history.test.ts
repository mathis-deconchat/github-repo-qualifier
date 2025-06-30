import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { scanSessionsTable, scannedRepositoriesTable } from '../db/schema';
import { getScanHistory } from '../handlers/get_scan_history';
import { signup } from '../handlers/auth';
import { type RepositoryQualityScore, type SignupInput } from '../schema';

const testUser1Input: SignupInput = {
  email: 'test1@example.com',
  password: 'testpassword123',
};

const testUser2Input: SignupInput = {
  email: 'test2@example.com',
  password: 'testpassword123',
};

describe('getScanHistory', () => {
  let user1Id: number;
  let user2Id: number;

  beforeEach(async () => {
    await createDB();
    
    // Create test users
    const signup1Result = await signup(testUser1Input);
    user1Id = signup1Result.user.id;
    
    const signup2Result = await signup(testUser2Input);
    user2Id = signup2Result.user.id;
  });
  
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
    const result = await getScanHistory(user1Id);
    expect(result).toEqual([]);
  });

  it('should return scan history for user with one session', async () => {
    // Create a scan session for user1
    const sessionResult = await db.insert(scanSessionsTable)
      .values({
        userId: user1Id,
        username: 'testuser1',
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
          url: 'https://github.com/testuser1/repo1',
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
          url: 'https://github.com/testuser1/repo2',
          isPrivate: true,
          language: null,
          stars: 0,
          forks: 0,
          qualityScore: sampleQualityScore,
        },
      ])
      .execute();

    const results = await getScanHistory(user1Id);

    expect(results).toHaveLength(1);
    expect(results[0].username).toBe('testuser1');
    expect(results[0].totalRepositories).toBe(2);
    expect(results[0].repositories).toHaveLength(2);
    expect(results[0].scannedAt).toBeInstanceOf(Date);

    // Check first repository
    const repo1 = results[0].repositories.find(r => r.name === 'repo1');
    expect(repo1).toBeDefined();
    expect(repo1!.description).toBe('First repository');
    expect(repo1!.url).toBe('https://github.com/testuser1/repo1');
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

  it('should return only authenticated users scan history', async () => {
    // Create scan session for user1
    const session1Result = await db.insert(scanSessionsTable)
      .values({
        userId: user1Id,
        username: 'testuser1',
        totalRepositories: 1,
      })
      .returning()
      .execute();

    // Create scan session for user2
    const session2Result = await db.insert(scanSessionsTable)
      .values({
        userId: user2Id,
        username: 'testuser2',
        totalRepositories: 1,
      })
      .returning()
      .execute();

    // Add repositories to both sessions
    await db.insert(scannedRepositoriesTable)
      .values([
        {
          sessionId: session1Result[0].id,
          name: 'user1-repo',
          description: 'User 1 repository',
          url: 'https://github.com/testuser1/user1-repo',
          isPrivate: false,
          language: 'Python',
          stars: 5,
          forks: 2,
          qualityScore: sampleQualityScore,
        },
        {
          sessionId: session2Result[0].id,
          name: 'user2-repo',
          description: 'User 2 repository',
          url: 'https://github.com/testuser2/user2-repo',
          isPrivate: false,
          language: 'TypeScript',
          stars: 15,
          forks: 8,
          qualityScore: sampleQualityScore,
        },
      ])
      .execute();

    // User 1 should only see their own scans
    const user1Results = await getScanHistory(user1Id);
    expect(user1Results).toHaveLength(1);
    expect(user1Results[0].username).toBe('testuser1');
    expect(user1Results[0].repositories[0].name).toBe('user1-repo');

    // User 2 should only see their own scans
    const user2Results = await getScanHistory(user2Id);
    expect(user2Results).toHaveLength(1);
    expect(user2Results[0].username).toBe('testuser2');
    expect(user2Results[0].repositories[0].name).toBe('user2-repo');
  });

  it('should return multiple scan sessions ordered by most recent first', async () => {
    const now = new Date();
    const olderDate = new Date(now.getTime() - 24 * 60 * 60 * 1000); // 1 day ago

    // Create older session first
    const olderSessionResult = await db.insert(scanSessionsTable)
      .values({
        userId: user1Id,
        username: 'testuser1',
        totalRepositories: 1,
        scannedAt: olderDate,
      })
      .returning()
      .execute();

    // Create newer session
    const newerSessionResult = await db.insert(scanSessionsTable)
      .values({
        userId: user1Id,
        username: 'testuser1',
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
          url: 'https://github.com/testuser1/old-repo',
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
          url: 'https://github.com/testuser1/new-repo',
          isPrivate: false,
          language: 'TypeScript',
          stars: 15,
          forks: 8,
          qualityScore: sampleQualityScore,
        },
      ])
      .execute();

    const results = await getScanHistory(user1Id);

    expect(results).toHaveLength(2);
    
    // First result should be the newer session
    expect(results[0].repositories[0].name).toBe('new-repo');
    expect(results[0].scannedAt >= results[1].scannedAt).toBe(true);
    
    // Second result should be the older session
    expect(results[1].repositories[0].name).toBe('old-repo');
  });

  it('should handle user with sessions but no repositories', async () => {
    // Create session without repositories for user1
    await db.insert(scanSessionsTable)
      .values({
        userId: user1Id,
        username: 'testuser1',
        totalRepositories: 0,
      })
      .execute();

    const results = await getScanHistory(user1Id);

    expect(results).toHaveLength(1);
    expect(results[0].username).toBe('testuser1');
    expect(results[0].totalRepositories).toBe(0);
    expect(results[0].repositories).toHaveLength(0);
  });
});