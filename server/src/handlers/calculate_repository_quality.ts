
import { type GitHubRepositoryData, type RepositoryQualityScore } from '../schema';

export async function calculateRepositoryQuality(repoData: GitHubRepositoryData): Promise<RepositoryQualityScore> {
  // 1. Repository Name Analysis (20 points)
  const repositoryNameScore = analyzeRepositoryName(repoData.name);

  // Find README file from repository entries
  const readmeFile = findReadmeFile(repoData.object?.entries || []);
  
  // 2. README.md File Existence (10 points)
  const readmeExists = readmeFile ? 10 : 0;

  // 3. README.md Content Analysis (50 points total)
  const readmeContent = analyzeReadmeContent(readmeFile?.object?.text || '');

  // 4. LICENSE File Existence (20 points)
  const licenseFile = findLicenseFile(repoData.object?.entries || []) ? 20 : 0;

  // Calculate total score
  const totalScore = repositoryNameScore + readmeExists + readmeContent.total + licenseFile;

  return {
    repositoryName: repositoryNameScore,
    readmeExists,
    readmeContent,
    licenseFile,
    totalScore,
  };
}

function analyzeRepositoryName(name: string): number {
  const lowerName = name.toLowerCase();
  const testWords = ['test', 'boilerplate', 'starter'];
  
  // If repository name contains test words, score 0, otherwise 20
  return testWords.some(word => lowerName.includes(word)) ? 0 : 20;
}

function findReadmeFile(entries: any[]): any | null {
  return entries.find(entry => 
    entry.name.toLowerCase() === 'readme.md' && 
    entry.type === 'blob'
  ) || null;
}

function findLicenseFile(entries: any[]): any | null {
  return entries.find(entry => {
    const name = entry.name.toLowerCase();
    return (name === 'license' || name === 'license.md') && entry.type === 'blob';
  }) || null;
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

  // Quick Project Presentation (10 points): Check content length > 50 chars
  const quickPresentation = content.length > 50 ? 10 : 0;

  // Badges (10 points): Look for ![alt text](url) syntax
  const badgeRegex = /!\[.*?\]\(.*?\)/;
  const badges = badgeRegex.test(content) ? 10 : 0;

  // Section analysis - case-insensitive search
  const installationSection = hasSectionHeading(lowerContent, 'installation') ? 8 : 0;
  const usageSection = hasSectionHeading(lowerContent, 'usage') ? 8 : 0;
  const goalSection = hasSectionHeading(lowerContent, 'goal') ? 7 : 0;
  const roadmapSection = hasSectionHeading(lowerContent, 'roadmap') ? 7 : 0;
  const licenceSection = hasSectionHeading(lowerContent, 'licen') ? 10 : 0; // Matches both "license" and "licence"

  const total = quickPresentation + badges + installationSection + usageSection + 
                goalSection + roadmapSection + licenceSection;

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

function hasSectionHeading(content: string, sectionName: string): boolean {
  // Look for markdown headings (# ## ###) followed by the section name
  const headingRegex = new RegExp(`#+\\s*.*${sectionName}`, 'i');
  return headingRegex.test(content);
}
