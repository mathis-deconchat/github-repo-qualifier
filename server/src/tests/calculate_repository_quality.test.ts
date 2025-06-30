
import { describe, expect, it } from 'bun:test';
import { calculateRepositoryQuality } from '../handlers/calculate_repository_quality';
import { type GitHubRepositoryData } from '../schema';

// Base test repository data
const baseRepoData: GitHubRepositoryData = {
  name: 'awesome-project',
  description: 'A great project',
  url: 'https://github.com/user/awesome-project',
  isPrivate: false,
  primaryLanguage: { name: 'TypeScript' },
  stargazerCount: 100,
  forkCount: 20,
  object: {
    entries: []
  }
};

describe('calculateRepositoryQuality', () => {
  it('should return zero scores for empty repository', async () => {
    const result = await calculateRepositoryQuality(baseRepoData);

    expect(result.repositoryName).toBe(20); // Good name, no test words
    expect(result.readmeExists).toBe(0);
    expect(result.readmeContent.total).toBe(0);
    expect(result.licenseFile).toBe(0);
    expect(result.totalScore).toBe(20);
  });

  it('should score repository name correctly', async () => {
    // Test good repository name
    let result = await calculateRepositoryQuality({
      ...baseRepoData,
      name: 'awesome-project'
    });
    expect(result.repositoryName).toBe(20);

    // Test repository name with "test"
    result = await calculateRepositoryQuality({
      ...baseRepoData,
      name: 'test-project'
    });
    expect(result.repositoryName).toBe(0);

    // Test repository name with "boilerplate"
    result = await calculateRepositoryQuality({
      ...baseRepoData,
      name: 'react-boilerplate'
    });
    expect(result.repositoryName).toBe(0);

    // Test repository name with "starter"
    result = await calculateRepositoryQuality({
      ...baseRepoData,
      name: 'express-starter'
    });
    expect(result.repositoryName).toBe(0);
  });

  it('should detect README.md file existence', async () => {
    const repoWithReadme: GitHubRepositoryData = {
      ...baseRepoData,
      object: {
        entries: [
          {
            name: 'README.md',
            type: 'blob',
            object: { text: 'Short readme' }
          }
        ]
      }
    };

    const result = await calculateRepositoryQuality(repoWithReadme);
    expect(result.readmeExists).toBe(10);
  });

  it('should analyze README content correctly', async () => {
    const readmeContent = `# Awesome Project

![Build Status](https://img.shields.io/badge/build-passing-green)

This is a comprehensive project that does amazing things. It provides excellent functionality for developers.

## Installation

Run npm install to get started.

## Usage  

Use this project by importing the main module.

## Goal

The goal is to create an awesome tool.

## Roadmap

- Feature 1
- Feature 2

## License

MIT License applies to this project.
`;

    const repoWithFullReadme: GitHubRepositoryData = {
      ...baseRepoData,
      object: {
        entries: [
          {
            name: 'README.md',
            type: 'blob',
            object: { text: readmeContent }
          }
        ]
      }
    };

    const result = await calculateRepositoryQuality(repoWithFullReadme);
    
    expect(result.readmeContent.quickPresentation).toBe(10); // Content > 50 chars
    expect(result.readmeContent.badges).toBe(10); // Has badge syntax
    expect(result.readmeContent.installationSection).toBe(8); // Has installation section
    expect(result.readmeContent.usageSection).toBe(8); // Has usage section
    expect(result.readmeContent.goalSection).toBe(7); // Has goal section
    expect(result.readmeContent.roadmapSection).toBe(7); // Has roadmap section
    expect(result.readmeContent.licenceSection).toBe(10); // Has license section
    expect(result.readmeContent.total).toBe(60); // Sum of all content scores
  });

  it('should detect LICENSE file existence', async () => {
    // Test LICENSE file
    let repoWithLicense: GitHubRepositoryData = {
      ...baseRepoData,
      object: {
        entries: [
          {
            name: 'LICENSE',
            type: 'blob'
          }
        ]
      }
    };

    let result = await calculateRepositoryQuality(repoWithLicense);
    expect(result.licenseFile).toBe(20);

    // Test LICENSE.md file
    repoWithLicense = {
      ...baseRepoData,
      object: {
        entries: [
          {
            name: 'LICENSE.md',
            type: 'blob'
          }
        ]
      }
    };

    result = await calculateRepositoryQuality(repoWithLicense);
    expect(result.licenseFile).toBe(20);
  });

  it('should calculate total score correctly', async () => {
    const perfectRepo: GitHubRepositoryData = {
      ...baseRepoData,
      name: 'perfect-project', // 20 points
      object: {
        entries: [
          {
            name: 'README.md',
            type: 'blob',
            object: { 
              text: `# Perfect Project

![Badge](https://img.shields.io/badge/test-badge)

This is a long enough description that exceeds fifty characters easily.

## Installation
Instructions here

## Usage
Usage examples

## Goal
Project goals

## Roadmap
Future plans

## License
MIT License
` 
            }
          },
          {
            name: 'LICENSE',
            type: 'blob'
          }
        ]
      }
    };

    const result = await calculateRepositoryQuality(perfectRepo);
    
    expect(result.repositoryName).toBe(20);
    expect(result.readmeExists).toBe(10);
    expect(result.readmeContent.total).toBe(60);
    expect(result.licenseFile).toBe(20);
    expect(result.totalScore).toBe(110); // 20 + 10 + 60 + 20
  });

  it('should handle missing object or entries gracefully', async () => {
    const repoWithoutObject: GitHubRepositoryData = {
      ...baseRepoData,
      object: null
    };

    const result = await calculateRepositoryQuality(repoWithoutObject);
    expect(result.readmeExists).toBe(0);
    expect(result.licenseFile).toBe(0);
    expect(result.totalScore).toBe(20); // Only repository name score
  });

  it('should handle empty README content', async () => {
    const repoWithEmptyReadme: GitHubRepositoryData = {
      ...baseRepoData,
      object: {
        entries: [
          {
            name: 'README.md',
            type: 'blob',
            object: { text: '' }
          }
        ]
      }
    };

    const result = await calculateRepositoryQuality(repoWithEmptyReadme);
    expect(result.readmeExists).toBe(10);
    expect(result.readmeContent.quickPresentation).toBe(0); // Empty content
    expect(result.readmeContent.total).toBe(0);
  });
});
