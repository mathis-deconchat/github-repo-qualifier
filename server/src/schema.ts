
import { z } from 'zod';

// GitHub scan input schema
export const githubScanInputSchema = z.object({
  username: z.string().min(1, 'Username is required'),
  personalAccessToken: z.string().optional(), // Optional PAT for higher rate limits
});

export type GitHubScanInput = z.infer<typeof githubScanInputSchema>;

// Repository quality score breakdown schema
export const repositoryQualityScoreSchema = z.object({
  repositoryName: z.number().min(0).max(20), // 20 points max
  readmeExists: z.number().min(0).max(10), // 10 points max
  readmeContent: z.object({
    quickPresentation: z.number().min(0).max(10), // 10 points max
    badges: z.number().min(0).max(10), // 10 points max
    installationSection: z.number().min(0).max(8), // 8 points max
    usageSection: z.number().min(0).max(8), // 8 points max
    goalSection: z.number().min(0).max(7), // 7 points max
    roadmapSection: z.number().min(0).max(7), // 7 points max
    licenceSection: z.number().min(0).max(10), // 10 points max
    total: z.number().min(0).max(50), // 50 points max total
  }),
  licenseFile: z.number().min(0).max(20), // 20 points max
  totalScore: z.number().min(0).max(100), // 100 points max total
});

export type RepositoryQualityScore = z.infer<typeof repositoryQualityScoreSchema>;

// Scanned repository schema
export const scannedRepositorySchema = z.object({
  id: z.number(),
  name: z.string(),
  description: z.string().nullable(),
  url: z.string().url(),
  isPrivate: z.boolean(),
  language: z.string().nullable(),
  stars: z.number().int().nonnegative(),
  forks: z.number().int().nonnegative(),
  qualityScore: repositoryQualityScoreSchema,
  scannedAt: z.coerce.date(),
});

export type ScannedRepository = z.infer<typeof scannedRepositorySchema>;

// GitHub scan result schema
export const githubScanResultSchema = z.object({
  username: z.string(),
  totalRepositories: z.number().int().nonnegative(),
  repositories: z.array(scannedRepositorySchema),
  scannedAt: z.coerce.date(),
});

export type GitHubScanResult = z.infer<typeof githubScanResultSchema>;

// GitHub API repository data schema (for internal use)
export const githubRepositoryDataSchema = z.object({
  name: z.string(),
  description: z.string().nullable(),
  url: z.string(),
  isPrivate: z.boolean(),
  primaryLanguage: z.object({
    name: z.string(),
  }).nullable(),
  stargazerCount: z.number(),
  forkCount: z.number(),
  object: z.object({
    entries: z.array(z.object({
      name: z.string(),
      type: z.string(),
      object: z.object({
        text: z.string().optional(),
      }).optional(),
    })),
  }).nullable(),
});

export type GitHubRepositoryData = z.infer<typeof githubRepositoryDataSchema>;
