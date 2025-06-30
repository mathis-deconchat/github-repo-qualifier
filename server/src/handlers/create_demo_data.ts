import { db } from '../db';
import { usersTable, scanSessionsTable, scannedRepositoriesTable } from '../db/schema';
import { eq } from 'drizzle-orm';

// Simple hash function for demonstration
function simpleHash(password: string): string {
  return Buffer.from(password + 'salt').toString('base64');
}

export const createDemoData = async (): Promise<{ message: string }> => {
  try {
    // Check if demo user already exists
    const existingUser = await db.select()
      .from(usersTable)
      .where(eq(usersTable.email, 'demo@example.com'))
      .execute();

    if (existingUser.length > 0) {
      return { message: 'Demo data already exists' };
    }

    // Create demo user
    const userResult = await db.insert(usersTable)
      .values({
        email: 'demo@example.com',
        passwordHash: simpleHash('password123'),
      })
      .returning()
      .execute();

    const userId = userResult[0].id;

    // Create demo scan session
    const sessionResult = await db.insert(scanSessionsTable)
      .values({
        userId,
        username: 'octocat',
        totalRepositories: 3,
      })
      .returning()
      .execute();

    const sessionId = sessionResult[0].id;

    // Create demo repositories with quality scores
    await db.insert(scannedRepositoriesTable)
      .values([
        {
          sessionId,
          name: 'awesome-project',
          description: 'A really cool open source project with great documentation',
          url: 'https://github.com/octocat/awesome-project',
          isPrivate: false,
          language: 'JavaScript',
          stars: 1247,
          forks: 89,
          qualityScore: {
            repositoryName: 20,
            readmeExists: 10,
            readmeContent: {
              quickPresentation: 10,
              badges: 10,
              installationSection: 8,
              usageSection: 8,
              goalSection: 7,
              roadmapSection: 7,
              licenceSection: 10,
              total: 50,
            },
            licenseFile: 20,
            totalScore: 100,
          },
        },
        {
          sessionId,
          name: 'simple-lib',
          description: 'A simple utility library',
          url: 'https://github.com/octocat/simple-lib',
          isPrivate: false,
          language: 'TypeScript',
          stars: 324,
          forks: 45,
          qualityScore: {
            repositoryName: 15,
            readmeExists: 10,
            readmeContent: {
              quickPresentation: 8,
              badges: 5,
              installationSection: 8,
              usageSection: 8,
              goalSection: 0,
              roadmapSection: 0,
              licenceSection: 10,
              total: 39,
            },
            licenseFile: 20,
            totalScore: 84,
          },
        },
        {
          sessionId,
          name: 'test-repo',
          description: null,
          url: 'https://github.com/octocat/test-repo',
          isPrivate: false,
          language: null,
          stars: 12,
          forks: 3,
          qualityScore: {
            repositoryName: 0,
            readmeExists: 0,
            readmeContent: {
              quickPresentation: 0,
              badges: 0,
              installationSection: 0,
              usageSection: 0,
              goalSection: 0,
              roadmapSection: 0,
              licenceSection: 0,
              total: 0,
            },
            licenseFile: 0,
            totalScore: 0,
          },
        },
      ])
      .execute();

    return { message: 'Demo data created successfully' };
  } catch (error) {
    console.error('Failed to create demo data:', error);
    throw error;
  }
};