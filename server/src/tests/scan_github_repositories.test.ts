import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { scanSessionsTable, scannedRepositoriesTable } from '../db/schema';
import { type GitHubScanInput, type SignupInput } from '../schema';
import { scanGitHubRepositories } from '../handlers/scan_github_repositories';
import { signup } from '../handlers/auth';
import { eq } from 'drizzle-orm';

const testInput: GitHubScanInput = {
  username: 'testuser',
  personalAccessToken: 'test-token',
};

const testUserInput: SignupInput = {
  email: 'test@example.com',
  password: 'testpassword123',
};

// Mock fetch to avoid real API calls in tests
const originalFetch = globalThis.fetch;

const mockGitHubResponse = {
  data: {
    user: {
      repositories: {
        nodes: [
          {
            name: 'awesome-project',
            description: 'A really cool project',
            url: 'https://github.com/testuser/awesome-project',
            isPrivate: false,
            primaryLanguage: {
              name: 'JavaScript',
            },
            stargazerCount: 42,
            forkCount: 7,
            object: {
              entries: [
                {
                  name: 'README.md',
                  type: 'blob',
                  object: {
                    text: '# Awesome Project\n\nThis is a great project!\n\n## Installation\n\nRun npm install\n\n## Usage\n\nJust use it!\n\n## License\n\nMIT License',
                  },
                },
                {
                  name: 'LICENSE',
                  type: 'blob',
                  object: {
                    text: 'MIT License...',
                  },
                },
              ],
            },
          },
          {
            name: 'simple-repo',
            description: null,
            url: 'https://github.com/testuser/simple-repo',
            isPrivate: false,
            primaryLanguage: null,
            stargazerCount: 1,
            forkCount: 0,
            object: null,
          },
        ],
      },
    },
  },
};

describe('scanGitHubRepositories', () => {
  let userId: number;

  beforeEach(async () => {
    await createDB();
    
    // Create a test user
    const signupResult = await signup(testUserInput);
    userId = signupResult.user.id;
    
    // Mock fetch for GitHub API
    const mockFetch = async (url: string | URL | Request, options?: RequestInit) => {
      if (url === 'https://api.github.com/graphql') {
        return new Response(JSON.stringify(mockGitHubResponse), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      return originalFetch(url, options);
    };
    
    globalThis.fetch = mockFetch as any;
  });

  afterEach(async () => {
    globalThis.fetch = originalFetch;
    await resetDB();
  });

  it('should scan repositories and return results', async () => {
    const result = await scanGitHubRepositories(testInput, userId);

    expect(result.username).toEqual('testuser');
    expect(result.totalRepositories).toEqual(2);
    expect(result.repositories).toHaveLength(2);
    expect(result.scannedAt).toBeInstanceOf(Date);

    // Check first repository
    const firstRepo = result.repositories[0];
    expect(firstRepo.name).toEqual('awesome-project');
    expect(firstRepo.description).toEqual('A really cool project');
    expect(firstRepo.url).toEqual('https://github.com/testuser/awesome-project');
    expect(firstRepo.isPrivate).toEqual(false);
    expect(firstRepo.language).toEqual('JavaScript');
    expect(firstRepo.stars).toEqual(42);
    expect(firstRepo.forks).toEqual(7);
    expect(firstRepo.qualityScore.totalScore).toBeGreaterThan(0);
  });

  it('should save scan session to database with user association', async () => {
    const result = await scanGitHubRepositories(testInput, userId);

    const sessions = await db.select()
      .from(scanSessionsTable)
      .where(eq(scanSessionsTable.userId, userId))
      .execute();

    expect(sessions).toHaveLength(1);
    expect(sessions[0].username).toEqual('testuser');
    expect(sessions[0].userId).toEqual(userId);
    expect(sessions[0].totalRepositories).toEqual(2);
    expect(sessions[0].scannedAt).toBeInstanceOf(Date);
  });

  it('should save repository data to database', async () => {
    await scanGitHubRepositories(testInput, userId);

    const repositories = await db.select()
      .from(scannedRepositoriesTable)
      .execute();

    expect(repositories).toHaveLength(2);
    
    const awesomeProject = repositories.find(r => r.name === 'awesome-project');
    expect(awesomeProject).toBeDefined();
    expect(awesomeProject!.description).toEqual('A really cool project');
    expect(awesomeProject!.stars).toEqual(42);
    expect(awesomeProject!.qualityScore).toBeDefined();
  });

  it('should calculate quality scores correctly', async () => {
    const result = await scanGitHubRepositories(testInput, userId);

    const awesomeProject = result.repositories.find(r => r.name === 'awesome-project');
    expect(awesomeProject).toBeDefined();
    
    const qualityScore = awesomeProject!.qualityScore;
    
    // Repository name score should be high for 'awesome-project'
    expect(qualityScore.repositoryName).toBeGreaterThan(0);
    
    // README exists should be 10 points
    expect(qualityScore.readmeExists).toEqual(10);
    
    // README content should have some points
    expect(qualityScore.readmeContent.total).toBeGreaterThan(0);
    expect(qualityScore.readmeContent.installationSection).toEqual(8);
    expect(qualityScore.readmeContent.usageSection).toEqual(8);
    expect(qualityScore.readmeContent.licenceSection).toEqual(10);
    
    // License file should be 20 points
    expect(qualityScore.licenseFile).toEqual(20);
    
    // Total should be sum of all parts
    const expectedTotal = qualityScore.repositoryName + 
                         qualityScore.readmeExists + 
                         qualityScore.readmeContent.total + 
                         qualityScore.licenseFile;
    expect(qualityScore.totalScore).toEqual(expectedTotal);
  });

  it('should handle repositories without README or LICENSE', async () => {
    const result = await scanGitHubRepositories(testInput, userId);

    const simpleRepo = result.repositories.find(r => r.name === 'simple-repo');
    expect(simpleRepo).toBeDefined();
    
    const qualityScore = simpleRepo!.qualityScore;
    
    // No README
    expect(qualityScore.readmeExists).toEqual(0);
    expect(qualityScore.readmeContent.total).toEqual(0);
    
    // No LICENSE
    expect(qualityScore.licenseFile).toEqual(0);
    
    // Should still have some repository name score
    expect(qualityScore.repositoryName).toBeGreaterThan(0);
  });

  it('should handle rate limit errors', async () => {
    // Mock rate limit error response
    const mockRateLimitFetch = async () => {
      return new Response('Rate limit exceeded', {
        status: 403,
        headers: { 
          'Content-Type': 'application/json',
          'x-ratelimit-reset': '1234567890',
        },
      });
    };
    
    globalThis.fetch = mockRateLimitFetch as any;

    await expect(scanGitHubRepositories(testInput, userId)).rejects.toThrow(/GITHUB_RATE_LIMIT_EXCEEDED/);
  });

  it('should handle API errors gracefully', async () => {
    // Mock API error response
    const mockErrorFetch = async () => {
      return new Response(JSON.stringify({ errors: ['API Error'] }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    };
    
    globalThis.fetch = mockErrorFetch as any;

    await expect(scanGitHubRepositories(testInput, userId)).rejects.toThrow(/API errors/i);
  });

  it('should handle empty repository list', async () => {
    // Mock empty response
    const mockEmptyFetch = async () => {
      return new Response(JSON.stringify({
        data: {
          user: {
            repositories: {
              nodes: [],
            },
          },
        },
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    };
    
    globalThis.fetch = mockEmptyFetch as any;

    const result = await scanGitHubRepositories(testInput, userId);

    expect(result.username).toEqual('testuser');
    expect(result.totalRepositories).toEqual(0);
    expect(result.repositories).toHaveLength(0);
  });
});