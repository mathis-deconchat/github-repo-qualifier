
import { TRPCError } from '@trpc/server';
import { db } from '../db';
import { scanSessionsTable, scannedRepositoriesTable } from '../db/schema';
import { type GitHubScanInput, type GitHubScanResult, type GitHubRepositoryData, type RepositoryQualityScore } from '../schema';

export async function scanGitHubRepositories(input: GitHubScanInput, userId: number): Promise<GitHubScanResult> {
  try {
    // Fetch repositories from GitHub API
    const repositories = await fetchGitHubRepositories(input.username, input.personalAccessToken);
    
    // Analyze quality scores for each repository
    const analyzedRepositories = repositories.map(repo => analyzeRepositoryQuality(repo));
    
    // Store scan session in database with user ID
    const sessionResult = await db.insert(scanSessionsTable)
      .values({
        userId,
        username: input.username,
        totalRepositories: repositories.length,
      })
      .returning()
      .execute();
    
    const sessionId = sessionResult[0].id;
    
    // Store individual repository results
    if (analyzedRepositories.length > 0) {
      await db.insert(scannedRepositoriesTable)
        .values(analyzedRepositories.map(repo => ({
          sessionId,
          name: repo.name,
          description: repo.description,
          url: repo.url,
          isPrivate: repo.isPrivate,
          language: repo.language,
          stars: repo.stars,
          forks: repo.forks,
          qualityScore: repo.qualityScore,
        })))
        .execute();
    }
    
    return {
      username: input.username,
      totalRepositories: repositories.length,
      repositories: analyzedRepositories.map(repo => ({
        ...repo,
        id: 0, // Will be set by database
        scannedAt: new Date(),
      })),
      scannedAt: new Date(),
    };
  } catch (error) {
    console.error('GitHub scan failed:', error);
    throw error;
  }
}

async function fetchGitHubRepositories(username: string, token?: string): Promise<GitHubRepositoryData[]> {
  const query = `
    query($username: String!) {
      user(login: $username) {
        repositories(first: 100, privacy: PUBLIC) {
          nodes {
            name
            description
            url
            isPrivate
            primaryLanguage {
              name
            }
            stargazerCount
            forkCount
            object(expression: "HEAD:") {
              ... on Tree {
                entries {
                  name
                  type
                  object {
                    ... on Blob {
                      text
                    }
                  }
                }
              }
            }
          }
        }
      }
    }
  `;

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch('https://api.github.com/graphql', {
    method: 'POST',
    headers,
    body: JSON.stringify({
      query,
      variables: { username },
    }),
  });

  if (!response.ok) {
    // Handle rate limiting specifically
    if (response.status === 403 || response.status === 429) {
      const rateLimitReset = response.headers.get('x-ratelimit-reset');
      const retryAfter = response.headers.get('retry-after');
      
      throw new TRPCError({
        code: 'TOO_MANY_REQUESTS',
        message: 'GITHUB_RATE_LIMIT_EXCEEDED',
        cause: {
          rateLimitReset: rateLimitReset ? parseInt(rateLimitReset) : null,
          retryAfter: retryAfter ? parseInt(retryAfter) : null,
        },
      });
    }
    
    throw new TRPCError({
      code: 'INTERNAL_SERVER_ERROR',
      message: `GitHub API request failed: ${response.status}`,
    });
  }

  const data: any = await response.json();
  
  if (data.errors) {
    throw new Error(`GitHub API errors: ${JSON.stringify(data.errors)}`);
  }

  return data.data?.user?.repositories?.nodes || [];
}

function analyzeRepositoryQuality(repo: GitHubRepositoryData): {
  name: string;
  description: string | null;
  url: string;
  isPrivate: boolean;
  language: string | null;
  stars: number;
  forks: number;
  qualityScore: RepositoryQualityScore;
} {
  const qualityScore = calculateQualityScore(repo);
  
  return {
    name: repo.name,
    description: repo.description,
    url: repo.url,
    isPrivate: repo.isPrivate,
    language: repo.primaryLanguage?.name || null,
    stars: repo.stargazerCount,
    forks: repo.forkCount,
    qualityScore,
  };
}

function calculateQualityScore(repo: GitHubRepositoryData): RepositoryQualityScore {
  // Repository name score (20 points max)
  const repositoryNameScore = calculateRepositoryNameScore(repo.name);
  
  // Find README and LICENSE files
  const files = repo.object?.entries || [];
  const readmeFile = files.find(file => 
    file.name.toLowerCase() === 'readme.md' || file.name.toLowerCase() === 'readme'
  );
  const licenseFile = files.find(file => 
    file.name.toLowerCase().startsWith('license') || file.name.toLowerCase().startsWith('licence')
  );
  
  // README exists score (10 points max)
  const readmeExists = readmeFile ? 10 : 0;
  
  // README content analysis (50 points max total)
  const readmeContent = readmeFile?.object?.text 
    ? analyzeReadmeContent(readmeFile.object.text)
    : {
        quickPresentation: 0,
        badges: 0,
        installationSection: 0,
        usageSection: 0,
        goalSection: 0,
        roadmapSection: 0,
        licenceSection: 0,
        total: 0,
      };
  
  // License file score (20 points max)
  const licenseFileScore = licenseFile ? 20 : 0;
  
  // Total score
  const totalScore = repositoryNameScore + readmeExists + readmeContent.total + licenseFileScore;
  
  return {
    repositoryName: repositoryNameScore,
    readmeExists,
    readmeContent,
    licenseFile: licenseFileScore,
    totalScore,
  };
}

function calculateRepositoryNameScore(name: string): number {
  // Basic scoring based on name quality
  let score = 0;
  
  // Not just numbers or single letters (5 points)
  if (name.length > 2 && !/^\d+$/.test(name) && !/^[a-zA-Z]$/.test(name)) {
    score += 5;
  }
  
  // Uses meaningful separators (5 points)
  if (name.includes('-') || name.includes('_')) {
    score += 5;
  }
  
  // Reasonable length (5 points)
  if (name.length >= 5 && name.length <= 50) {
    score += 5;
  }
  
  // Not default names (5 points)
  const defaultNames = ['hello-world', 'test', 'my-project', 'untitled'];
  if (!defaultNames.includes(name.toLowerCase())) {
    score += 5;
  }
  
  return Math.min(score, 20);
}

function analyzeReadmeContent(content: string): {
  quickPresentation: number;
  badges: number;
  installationSection: number;
  usageSection: number;
  goalSection: number;
  roadmapSection: number;
  licenceSection: number;
  total: number;
} {
  const lowerContent = content.toLowerCase();
  
  // Quick presentation (10 points max)
  const quickPresentation = (content.length > 100 && content.split('\n')[0].length > 10) ? 10 : 0;
  
  // Badges (10 points max)
  const badges = (content.includes('![') || content.includes('https://img.shields.io')) ? 10 : 0;
  
  // Installation section (8 points max)
  const installationSection = (
    lowerContent.includes('install') || 
    lowerContent.includes('setup') || 
    lowerContent.includes('getting started')
  ) ? 8 : 0;
  
  // Usage section (8 points max)
  const usageSection = (
    lowerContent.includes('usage') || 
    lowerContent.includes('example') || 
    lowerContent.includes('how to use')
  ) ? 8 : 0;
  
  // Goal section (7 points max)
  const goalSection = (
    lowerContent.includes('goal') || 
    lowerContent.includes('purpose') || 
    lowerContent.includes('about') ||
    lowerContent.includes('description')
  ) ? 7 : 0;
  
  // Roadmap section (7 points max)
  const roadmapSection = (
    lowerContent.includes('roadmap') || 
    lowerContent.includes('todo') || 
    lowerContent.includes('future')
  ) ? 7 : 0;
  
  // License section (10 points max)
  const licenceSection = (
    lowerContent.includes('license') || 
    lowerContent.includes('licence')
  ) ? 10 : 0;
  
  const total = quickPresentation + badges + installationSection + usageSection + goalSection + roadmapSection + licenceSection;
  
  return {
    quickPresentation,
    badges,
    installationSection,
    usageSection,
    goalSection,
    roadmapSection,
    licenceSection,
    total,
  };
}
