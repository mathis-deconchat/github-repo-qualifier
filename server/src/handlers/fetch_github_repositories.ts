
import { type GitHubRepositoryData } from '../schema';

const GITHUB_GRAPHQL_URL = 'https://api.github.com/graphql';

// GraphQL query to fetch user repositories with metadata and file contents
const REPOSITORIES_QUERY = `
  query GetUserRepositories($username: String!, $cursor: String) {
    user(login: $username) {
      repositories(first: 100, after: $cursor, ownerAffiliations: OWNER, orderBy: {field: UPDATED_AT, direction: DESC}) {
        pageInfo {
          hasNextPage
          endCursor
        }
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

interface GraphQLResponse {
  data?: {
    user?: {
      repositories: {
        pageInfo: {
          hasNextPage: boolean;
          endCursor: string | null;
        };
        nodes: any[];
      };
    };
  };
  errors?: Array<{ message: string }>;
}

export async function fetchGitHubRepositories(username: string, personalAccessToken?: string): Promise<GitHubRepositoryData[]> {
  try {
    const repositories: GitHubRepositoryData[] = [];
    let hasNextPage = true;
    let cursor: string | null = null;

    // Set up headers with optional authentication
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'User-Agent': 'GitHub-Repository-Scanner',
    };

    if (personalAccessToken) {
      headers['Authorization'] = `Bearer ${personalAccessToken}`;
    }

    // Paginate through all repositories
    while (hasNextPage) {
      const response = await fetch(GITHUB_GRAPHQL_URL, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          query: REPOSITORIES_QUERY,
          variables: {
            username,
            cursor,
          },
        }),
      });

      if (!response.ok) {
        if (response.status === 401) {
          throw new Error('GitHub authentication failed. Invalid or expired token.');
        }
        if (response.status === 403) {
          throw new Error('GitHub API rate limit exceeded. Please try again later or provide a Personal Access Token.');
        }
        throw new Error(`GitHub API request failed: ${response.status} ${response.statusText}`);
      }

      const result = await response.json() as GraphQLResponse;

      if (result.errors) {
        throw new Error(`GitHub GraphQL API errors: ${result.errors.map(e => e.message).join(', ')}`);
      }

      if (!result.data?.user) {
        throw new Error(`GitHub user '${username}' not found`);
      }

      const repositoryData = result.data.user.repositories;
      
      // Process each repository
      for (const repo of repositoryData.nodes) {
        repositories.push({
          name: repo.name,
          description: repo.description,
          url: repo.url,
          isPrivate: repo.isPrivate,
          primaryLanguage: repo.primaryLanguage,
          stargazerCount: repo.stargazerCount,
          forkCount: repo.forkCount,
          object: repo.object,
        });
      }

      // Update pagination state
      hasNextPage = repositoryData.pageInfo.hasNextPage;
      cursor = repositoryData.pageInfo.endCursor;

      // Rate limiting protection - small delay between requests
      if (hasNextPage) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }

    return repositories;
  } catch (error) {
    console.error('Failed to fetch GitHub repositories:', error);
    throw error;
  }
}
