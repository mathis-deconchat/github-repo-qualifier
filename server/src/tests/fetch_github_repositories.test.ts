
import { describe, it, expect } from 'bun:test';
import { fetchGitHubRepositories } from '../handlers/fetch_github_repositories';

describe('fetchGitHubRepositories', () => {
  it('should fetch repositories for a valid GitHub username', async () => {
    // Override fetch to simulate successful response
    const originalFetch = globalThis.fetch;
    
    const mockFetch = Object.assign(
      async () => {
        return new Response(JSON.stringify({
          data: {
            user: {
              repositories: {
                pageInfo: { hasNextPage: false, endCursor: null },
                nodes: [
                  {
                    name: 'Hello-World',
                    description: 'My first repository on GitHub!',
                    url: 'https://github.com/octocat/Hello-World',
                    isPrivate: false,
                    primaryLanguage: { name: 'C' },
                    stargazerCount: 1500,
                    forkCount: 800,
                    object: {
                      entries: [
                        {
                          name: 'README.md',
                          type: 'blob',
                          object: { text: '# Hello World\nThis is my first repository.' }
                        },
                        {
                          name: 'LICENSE',
                          type: 'blob',
                          object: { text: 'MIT License...' }
                        }
                      ]
                    }
                  },
                  {
                    name: 'Spoon-Knife',
                    description: null,
                    url: 'https://github.com/octocat/Spoon-Knife',
                    isPrivate: false,
                    primaryLanguage: null,
                    stargazerCount: 12000,
                    forkCount: 140000,
                    object: null
                  }
                ]
              }
            }
          }
        }), { status: 200 });
      },
      { preconnect: () => {} }
    );
    
    globalThis.fetch = mockFetch as any;

    try {
      const repositories = await fetchGitHubRepositories('octocat');

      expect(repositories).toBeInstanceOf(Array);
      expect(repositories.length).toBe(2);

      // Validate structure of first repository
      const firstRepo = repositories[0];
      expect(firstRepo.name).toBe('Hello-World');
      expect(firstRepo.description).toBe('My first repository on GitHub!');
      expect(firstRepo.url).toBe('https://github.com/octocat/Hello-World');
      expect(firstRepo.isPrivate).toBe(false);
      expect(firstRepo.stargazerCount).toBe(1500);
      expect(firstRepo.forkCount).toBe(800);
      expect(firstRepo.primaryLanguage?.name).toBe('C');

      // Validate second repository with null values
      const secondRepo = repositories[1];
      expect(secondRepo.name).toBe('Spoon-Knife');
      expect(secondRepo.description).toBeNull();
      expect(secondRepo.primaryLanguage).toBeNull();
      expect(secondRepo.object).toBeNull();
    } finally {
      // Restore original fetch
      globalThis.fetch = originalFetch;
    }
  });

  it('should include repository file tree data', async () => {
    // Override fetch to simulate response with file tree
    const originalFetch = globalThis.fetch;
    
    const mockFetch = Object.assign(
      async () => {
        return new Response(JSON.stringify({
          data: {
            user: {
              repositories: {
                pageInfo: { hasNextPage: false, endCursor: null },
                nodes: [
                  {
                    name: 'test-repo',
                    description: 'Test repository',
                    url: 'https://github.com/octocat/test-repo',
                    isPrivate: false,
                    primaryLanguage: { name: 'JavaScript' },
                    stargazerCount: 10,
                    forkCount: 5,
                    object: {
                      entries: [
                        {
                          name: 'README.md',
                          type: 'blob',
                          object: { text: '# Test Repository\nThis is a test.' }
                        },
                        {
                          name: 'src',
                          type: 'tree',
                          object: {}
                        }
                      ]
                    }
                  }
                ]
              }
            }
          }
        }), { status: 200 });
      },
      { preconnect: () => {} }
    );
    
    globalThis.fetch = mockFetch as any;

    try {
      const repositories = await fetchGitHubRepositories('octocat');
      
      const repoWithFiles = repositories[0];
      expect(repoWithFiles.object?.entries).toBeDefined();
      expect(repoWithFiles.object!.entries).toHaveLength(2);
      
      const readmeFile = repoWithFiles.object!.entries[0];
      expect(readmeFile.name).toBe('README.md');
      expect(readmeFile.type).toBe('blob');
      expect(readmeFile.object?.text).toBe('# Test Repository\nThis is a test.');
      
      const srcDir = repoWithFiles.object!.entries[1];
      expect(srcDir.name).toBe('src');
      expect(srcDir.type).toBe('tree');
    } finally {
      // Restore original fetch
      globalThis.fetch = originalFetch;
    }
  });

  it('should handle non-existent username', async () => {
    // Override fetch to simulate user not found
    const originalFetch = globalThis.fetch;
    
    const mockFetch = Object.assign(
      async () => {
        return new Response(JSON.stringify({
          data: {
            user: null
          }
        }), { status: 200 });
      },
      { preconnect: () => {} }
    );
    
    globalThis.fetch = mockFetch as any;

    try {
      await expect(fetchGitHubRepositories('this-user-definitely-does-not-exist-12345'))
        .rejects.toThrow(/not found/i);
    } finally {
      // Restore original fetch
      globalThis.fetch = originalFetch;
    }
  });

  it('should handle network errors gracefully', async () => {
    // Override fetch to simulate network error
    const originalFetch = globalThis.fetch;
    
    // Mock fetch function that includes preconnect property
    const mockFetch = Object.assign(
      async () => {
        throw new Error('Network error');
      },
      { preconnect: () => {} }
    );
    
    globalThis.fetch = mockFetch as any;

    try {
      await expect(fetchGitHubRepositories('octocat'))
        .rejects.toThrow(/network error/i);
    } finally {
      // Restore original fetch
      globalThis.fetch = originalFetch;
    }
  });

  it('should handle API rate limiting', async () => {
    // Override fetch to simulate rate limit response
    const originalFetch = globalThis.fetch;
    
    // Mock fetch function that includes preconnect property
    const mockFetch = Object.assign(
      async () => {
        return new Response('Rate limit exceeded', { status: 403 });
      },
      { preconnect: () => {} }
    );
    
    globalThis.fetch = mockFetch as any;

    try {
      await expect(fetchGitHubRepositories('octocat'))
        .rejects.toThrow(/rate limit/i);
    } finally {
      // Restore original fetch
      globalThis.fetch = originalFetch;
    }
  });

  it('should handle authentication errors', async () => {
    // Override fetch to simulate auth error
    const originalFetch = globalThis.fetch;
    
    // Mock fetch function that includes preconnect property
    const mockFetch = Object.assign(
      async () => {
        return new Response('Unauthorized', { status: 401 });
      },
      { preconnect: () => {} }
    );
    
    globalThis.fetch = mockFetch as any;

    try {
      await expect(fetchGitHubRepositories('octocat', 'invalid-token'))
        .rejects.toThrow(/authentication failed/i);
    } finally {
      // Restore original fetch
      globalThis.fetch = originalFetch;
    }
  });

  it('should accept personal access token parameter', async () => {
    // This test verifies the function accepts a PAT without actually using one
    // We'll use a mock to verify the Authorization header is set correctly
    const originalFetch = globalThis.fetch;
    let capturedHeaders: Record<string, string> | undefined;
    
    // Mock fetch function that includes preconnect property
    const mockFetch = Object.assign(
      async (url: string | URL | Request, options?: any) => {
        capturedHeaders = options?.headers as Record<string, string>;
        return new Response(JSON.stringify({
          data: {
            user: {
              repositories: {
                pageInfo: { hasNextPage: false, endCursor: null },
                nodes: []
              }
            }
          }
        }), { status: 200 });
      },
      { preconnect: () => {} }
    );
    
    globalThis.fetch = mockFetch as any;

    try {
      await fetchGitHubRepositories('octocat', 'test-token');
      
      expect(capturedHeaders).toBeDefined();
      const headers = capturedHeaders as Record<string, string>;
      expect(headers['Authorization']).toBe('Bearer test-token');
    } finally {
      // Restore original fetch
      globalThis.fetch = originalFetch;
    }
  });

  it('should handle pagination correctly', async () => {
    // Override fetch to simulate paginated responses
    const originalFetch = globalThis.fetch;
    let callCount = 0;
    
    const mockFetch = Object.assign(
      async (url: string | URL | Request, options?: any) => {
        const body = JSON.parse(options?.body || '{}');
        const cursor = body.variables?.cursor;
        
        callCount++;
        
        if (cursor === null || cursor === undefined) {
          // First page
          return new Response(JSON.stringify({
            data: {
              user: {
                repositories: {
                  pageInfo: { hasNextPage: true, endCursor: 'cursor1' },
                  nodes: [
                    {
                      name: 'repo1',
                      description: 'First repo',
                      url: 'https://github.com/octocat/repo1',
                      isPrivate: false,
                      primaryLanguage: { name: 'JavaScript' },
                      stargazerCount: 10,
                      forkCount: 5,
                      object: null
                    }
                  ]
                }
              }
            }
          }), { status: 200 });
        } else {
          // Second page
          return new Response(JSON.stringify({
            data: {
              user: {
                repositories: {
                  pageInfo: { hasNextPage: false, endCursor: null },
                  nodes: [
                    {
                      name: 'repo2',
                      description: 'Second repo',
                      url: 'https://github.com/octocat/repo2',
                      isPrivate: false,
                      primaryLanguage: { name: 'Python' },
                      stargazerCount: 20,
                      forkCount: 10,
                      object: null
                    }
                  ]
                }
              }
            }
          }), { status: 200 });
        }
      },
      { preconnect: () => {} }
    );
    
    globalThis.fetch = mockFetch as any;

    try {
      const repositories = await fetchGitHubRepositories('octocat');
      
      expect(callCount).toBe(2); // Should make 2 API calls for pagination
      expect(repositories).toHaveLength(2);
      expect(repositories[0].name).toBe('repo1');
      expect(repositories[1].name).toBe('repo2');
    } finally {
      // Restore original fetch
      globalThis.fetch = originalFetch;
    }
  });
});
