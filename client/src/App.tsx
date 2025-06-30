
import { useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';
import { GitBranch, Star, GitFork, Calendar, ExternalLink, AlertCircle } from 'lucide-react';
import { trpc } from '@/utils/trpc';
import type { GitHubScanInput, GitHubScanResult, ScannedRepository } from '../../server/src/schema';

function App() {
  const [formData, setFormData] = useState<GitHubScanInput>({
    username: '',
    personalAccessToken: ''
  });
  const [scanResult, setScanResult] = useState<GitHubScanResult | null>(null);
  const [scanHistory, setScanHistory] = useState<GitHubScanResult[]>([]);
  const [isScanning, setIsScanning] = useState(false);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleScan = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.username.trim()) {
      setError('GitHub username is required');
      return;
    }

    setIsScanning(true);
    setError(null);
    
    try {
      const result = await trpc.scanGitHubRepositories.mutate({
        username: formData.username.trim(),
        personalAccessToken: formData.personalAccessToken || undefined
      });
      setScanResult(result);
      
      // Load updated history after successful scan
      await loadScanHistory(formData.username.trim());
    } catch (error) {
      console.error('Failed to scan repositories:', error);
      setError('Failed to scan repositories. Please check your username and try again.');
    } finally {
      setIsScanning(false);
    }
  };

  const loadScanHistory = useCallback(async (username: string) => {
    if (!username.trim()) return;
    
    setIsLoadingHistory(true);
    try {
      const history = await trpc.getScanHistory.query({ username: username.trim() });
      setScanHistory(history);
    } catch (error) {
      console.error('Failed to load scan history:', error);
    } finally {
      setIsLoadingHistory(false);
    }
  }, []);

  const getScoreColor = (score: number): string => {
    if (score >= 80) return 'text-green-600';
    if (score >= 60) return 'text-yellow-600';
    if (score >= 40) return 'text-orange-600';
    return 'text-red-600';
  };

  const getScoreBadgeVariant = (score: number): "default" | "secondary" | "destructive" => {
    if (score >= 80) return 'default';
    if (score >= 60) return 'secondary';
    return 'destructive';
  };

  const formatScoreBreakdown = (repo: ScannedRepository) => {
    const { qualityScore } = repo;
    return [
      { label: 'Repository Name', score: qualityScore.repositoryName, max: 20 },
      { label: 'README Exists', score: qualityScore.readmeExists, max: 10 },
      { label: 'README Content', score: qualityScore.readmeContent.total, max: 50 },
      { label: 'License File', score: qualityScore.licenseFile, max: 20 }
    ];
  };

  const formatReadmeBreakdown = (repo: ScannedRepository) => {
    const { readmeContent } = repo.qualityScore;
    return [
      { label: 'Quick Presentation', score: readmeContent.quickPresentation, max: 10 },
      { label: 'Badges', score: readmeContent.badges, max: 10 },
      { label: 'Installation Section', score: readmeContent.installationSection, max: 8 },
      { label: 'Usage Section', score: readmeContent.usageSection, max: 8 },
      { label: 'Goal Section', score: readmeContent.goalSection, max: 7 },
      { label: 'Roadmap Section', score: readmeContent.roadmapSection, max: 7 },
      { label: 'License Section', score: readmeContent.licenceSection, max: 10 }
    ];
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
      <div className="container mx-auto max-w-6xl">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">
            🚀 GitHub Repository Quality Scanner
          </h1>
          <p className="text-lg text-gray-600">
            Analyze your GitHub repositories and get quality scores based on best practices
          </p>
        </div>

        {/* Scan Form */}
        <Card className="mb-8 shadow-lg">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <GitBranch className="w-5 h-5" />
              Scan GitHub Repositories
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleScan} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="username" className="block text-sm font-medium text-gray-700 mb-1">
                    GitHub Username *
                  </label>
                  <Input
                    id="username"
                    placeholder="Enter your GitHub username"
                    value={formData.username}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                      setFormData((prev: GitHubScanInput) => ({ ...prev, username: e.target.value }))
                    }
                    required
                  />
                </div>
                <div>
                  <label htmlFor="pat" className="block text-sm font-medium text-gray-700 mb-1">
                    Personal Access Token (Optional)
                  </label>
                  <Input
                    id="pat"
                    type="password"
                    placeholder="GitHub PAT for higher rate limits"
                    value={formData.personalAccessToken || ''}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                      setFormData((prev: GitHubScanInput) => ({
                        ...prev,
                        personalAccessToken: e.target.value || ''
                      }))
                    }
                  />
                </div>
              </div>
              
              {error && (
                <Alert className="border-red-200 bg-red-50">
                  <AlertCircle className="h-4 w-4 text-red-600" />
                  <AlertDescription className="text-red-700">{error}</AlertDescription>
                </Alert>
              )}

              <div className="flex gap-4">
                <Button type="submit" disabled={isScanning} className="flex-1">
                  {isScanning ? '🔍 Scanning...' : '🔍 Scan Repositories'}
                </Button>
                {formData.username.trim() && (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => loadScanHistory(formData.username.trim())}
                    disabled={isLoadingHistory}
                  >
                    {isLoadingHistory ? 'Loading...' : '📜 Load History'}
                  </Button>
                )}
              </div>
            </form>
          </CardContent>
        </Card>

        {/* Scan Results */}
        {scanResult && (
          <Card className="mb-8 shadow-lg">
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span>📊 Scan Results for {scanResult.username}</span>
                <Badge variant="outline">
                  {scanResult.totalRepositories} repositories
                </Badge>
              </CardTitle>
              <p className="text-sm text-gray-600">
                Scanned on {scanResult.scannedAt.toLocaleDateString()} at{' '}
                {scanResult.scannedAt.toLocaleTimeString()}
              </p>
            </CardHeader>
            <CardContent>
              {scanResult.repositories.length === 0 ? (
                <div className="text-center py-8">
                  <AlertCircle className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                  <p className="text-gray-600 text-lg">
                    {/* STUB NOTICE: Backend implementation is placeholder */}
                    No repositories found. This is expected as the backend scanning is not yet implemented.
                  </p>
                  <p className="text-sm text-gray-500 mt-2">
                    The scanning functionality will analyze repository quality once the backend is fully implemented.
                  </p>
                </div>
              ) : (
                <div className="grid gap-6">
                  {scanResult.repositories.map((repo: ScannedRepository) => (
                    <Card key={repo.id} className="border-l-4 border-l-blue-500">
                      <CardHeader>
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-2">
                              <h3 className="text-xl font-semibold">{repo.name}</h3>
                              <Badge variant={getScoreBadgeVariant(repo.qualityScore.totalScore)}>
                                {repo.qualityScore.totalScore}/100
                              </Badge>
                              {repo.isPrivate && (
                                <Badge variant="secondary">Private</Badge>
                              )}
                            </div>
                            {repo.description && (
                              <p className="text-gray-600 mb-3">{repo.description}</p>
                            )}
                            <div className="flex items-center gap-4 text-sm text-gray-500">
                              {repo.language && (
                                <span className="flex items-center gap-1">
                                  <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
                                  {repo.language}
                                </span>
                              )}
                              <span className="flex items-center gap-1">
                                <Star className="w-4 h-4" />
                                {repo.stars}
                              </span>
                              <span className="flex items-center gap-1">
                                <GitFork className="w-4 h-4" />
                                {repo.forks}
                              </span>
                              <span className="flex items-center gap-1">
                                <Calendar className="w-4 h-4" />
                                {repo.scannedAt.toLocaleDateString()}
                              </span>
                            </div>
                          </div>
                          <Button variant="outline" size="sm" asChild>
                            <a href={repo.url} target="_blank" rel="noopener noreferrer">
                              <ExternalLink className="w-4 h-4 mr-1" />
                              View
                            </a>
                          </Button>
                        </div>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-4">
                          {/* Overall Progress */}
                          <div>
                            <div className="flex justify-between items-center mb-2">
                              <span className="text-sm font-medium">Overall Quality Score</span>
                              <span className={`text-sm font-bold ${getScoreColor(repo.qualityScore.totalScore)}`}>
                                {repo.qualityScore.totalScore}/100
                              </span>
                            </div>
                            <Progress value={repo.qualityScore.totalScore} className="h-2" />
                          </div>

                          <Separator />

                          {/* Score Breakdown */}
                          <div>
                            <h4 className="font-medium mb-3">📋 Score Breakdown</h4>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              {formatScoreBreakdown(repo).map((item, index) => (
                                <div key={index} className="flex justify-between items-center">
                                  <span className="text-sm">{item.label}</span>
                                  <div className="flex items-center gap-2">
                                    <span className={`text-sm font-medium ${getScoreColor((item.score / item.max) * 100)}`}>
                                      {item.score}/{item.max}
                                    </span>
                                    <div className="w-16">
                                      <Progress value={(item.score / item.max) * 100} className="h-1" />
                                    </div>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>

                          {/* README Content Breakdown */}
                          {repo.qualityScore.readmeExists > 0 && (
                            <>
                              <Separator />
                              <div>
                                <h4 className="font-medium mb-3">📄 README Content Analysis</h4>
                                <div className="grid grid-cols-1 gap-2">
                                  {formatReadmeBreakdown(repo).map((item, index) => (
                                    <div key={index} className="flex justify-between items-center">
                                      <span className="text-sm text-gray-600">{item.label}</span>
                                      <div className="flex items-center gap-2">
                                        <span className={`text-xs font-medium ${getScoreColor((item.score / item.max) * 100)}`}>
                                          {item.score}/{item.max}
                                        </span>
                                        <div className="w-12">
                                          <Progress value={(item.score / item.max) * 100} className="h-1" />
                                        </div>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            </>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Scan History */}
        {scanHistory.length > 0 && (
          <Card className="shadow-lg">
            <CardHeader>
              <CardTitle>📜 Previous Scans</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {scanHistory.map((result: GitHubScanResult, index: number) => (
                  <Card key={index} className="border-l-4 border-l-gray-300">
                    <CardContent className="pt-4">
                      <div className="flex justify-between items-center">
                        <div>
                          <p className="font-medium">{result.username}</p>
                          <p className="text-sm text-gray-600">
                            {result.totalRepositories} repositories scanned
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-sm text-gray-500">
                            {result.scannedAt.toLocaleDateString()}
                          </p>
                          <p className="text-xs text-gray-400">
                            {result.scannedAt.toLocaleTimeString()}
                          </p>
                        </div>
                      </div>
                      {result.repositories.length > 0 && (
                        <div className="mt-3 pt-3 border-t">
                          <div className="flex flex-wrap gap-2">
                            {result.repositories.slice(0, 5).map((repo: ScannedRepository) => (
                              <Badge key={repo.id} variant="outline" className="text-xs">
                                {repo.name}: {repo.qualityScore.totalScore}/100
                              </Badge>
                            ))}
                            {result.repositories.length > 5 && (
                              <Badge variant="secondary" className="text-xs">
                                +{result.repositories.length - 5} more
                              </Badge>
                            )}
                          </div>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Footer */}
        <div className="text-center mt-12 pb-8">
          <p className="text-gray-500 text-sm">
            🌟 Built with React, TypeScript, tRPC, and Radix UI
          </p>
          <p className="text-gray-400 text-xs mt-1">
            Quality scoring based on README content, license files, and repository best practices
          </p>
        </div>
      </div>
    </div>
  );
}

export default App;
