import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { GitBranch, Star, GitFork, Calendar, ExternalLink, AlertCircle, LogOut, User } from 'lucide-react';
import type { GitHubScanInput, SignupInput, LoginInput, ScannedRepository, GitHubScanResult, User as UserType } from '../../server/src/schema';

// Enhanced tRPC client with auth support
class AuthTRPCClient {
  private baseUrl = '/api';
  private authToken: string | null = null;

  constructor() {
    this.authToken = localStorage.getItem('github_scanner_token');
  }

  setAuthToken(token: string | null) {
    this.authToken = token;
    if (token) {
      localStorage.setItem('github_scanner_token', token);
    } else {
      localStorage.removeItem('github_scanner_token');
    }
  }

  private async request(procedure: string, input?: unknown, method: 'GET' | 'POST' = 'POST') {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    if (this.authToken) {
      headers['Authorization'] = `Bearer ${this.authToken}`;
    }

    const url = method === 'GET' && input 
      ? `${this.baseUrl}/${procedure}?input=${encodeURIComponent(JSON.stringify(input))}`
      : `${this.baseUrl}/${procedure}`;

    const response = await fetch(url, {
      method,
      headers,
      body: method === 'POST' ? JSON.stringify({ input }) : undefined,
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ message: 'Network error' }));
      throw new Error(errorData.message || `HTTP ${response.status}`);
    }

    return response.json();
  }

  // Auth methods
  auth = {
    signup: (input: SignupInput) => this.request('auth.signup', input),
    login: (input: LoginInput) => this.request('auth.login', input),
    logout: () => this.request('auth.logout'),
    getCurrentUser: () => this.request('auth.getCurrentUser', undefined, 'GET'),
  };

  // App methods
  scanGitHubRepositories = (input: GitHubScanInput) => this.request('scanGitHubRepositories', input);
  getScanHistory = () => this.request('getScanHistory', undefined, 'GET');
}

const trpc = new AuthTRPCClient();

function App() {
  const [user, setUser] = useState<UserType | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'login' | 'signup'>('login');
  
  // Auth form states
  const [loginData, setLoginData] = useState<LoginInput>({
    email: '',
    password: ''
  });
  const [signupData, setSignupData] = useState<SignupInput>({
    email: '',
    password: ''
  });
  
  // Scan form state
  const [scanData, setScanData] = useState<GitHubScanInput>({
    username: '',
    personalAccessToken: ''
  });

  // App state
  const [scanResult, setScanResult] = useState<GitHubScanResult | null>(null);
  const [scanHistory, setScanHistory] = useState<GitHubScanResult[]>([]);
  const [isScanning, setIsScanning] = useState(false);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [authError, setAuthError] = useState<string | null>(null);
  const [isAuthLoading, setIsAuthLoading] = useState(false);

  // Load current user on mount
  useEffect(() => {
    const loadCurrentUser = async () => {
      try {
        const userData = await trpc.auth.getCurrentUser();
        setUser(userData);
      } catch {
        // User not authenticated
        trpc.setAuthToken(null);
      } finally {
        setIsLoading(false);
      }
    };

    const token = localStorage.getItem('github_scanner_token');
    if (token) {
      loadCurrentUser();
    } else {
      setIsLoading(false);
    }
  }, []);

  // Load scan history when user is authenticated
  const loadScanHistory = useCallback(async () => {
    if (!user) return;
    
    setIsLoadingHistory(true);
    try {
      const history = await trpc.getScanHistory();
      setScanHistory(history);
    } catch (error) {
      console.error('Failed to load scan history:', error);
    } finally {
      setIsLoadingHistory(false);
    }
  }, [user]);

  useEffect(() => {
    if (user) {
      loadScanHistory();
    }
  }, [user, loadScanHistory]);

  // Auth handlers
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsAuthLoading(true);
    setAuthError(null);
    
    try {
      const result = await trpc.auth.login(loginData);
      trpc.setAuthToken(result.token);
      setUser(result.user);
      setLoginData({ email: '', password: '' });
    } catch (error) {
      setAuthError(error instanceof Error ? error.message : 'Login failed');
    } finally {
      setIsAuthLoading(false);
    }
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsAuthLoading(true);
    setAuthError(null);
    
    try {
      const result = await trpc.auth.signup(signupData);
      trpc.setAuthToken(result.token);
      setUser(result.user);
      setSignupData({ email: '', password: '' });
    } catch (error) {
      setAuthError(error instanceof Error ? error.message : 'Signup failed');
    } finally {
      setIsAuthLoading(false);
    }
  };

  const handleLogout = async () => {
    try {
      await trpc.auth.logout();
    } catch (error) {
      console.error('Logout failed:', error);
    } finally {
      trpc.setAuthToken(null);
      setUser(null);
      setScanResult(null);
      setScanHistory([]);
    }
  };

  // Scan handler
  const handleScan = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!scanData.username.trim()) {
      setError('GitHub username is required');
      return;
    }

    setIsScanning(true);
    setError(null);
    
    try {
      const result = await trpc.scanGitHubRepositories({
        username: scanData.username.trim(),
        personalAccessToken: scanData.personalAccessToken || undefined
      });
      setScanResult(result);
      
      // Reload scan history
      await loadScanHistory();
    } catch (error) {
      console.error('Failed to scan repositories:', error);
      if (error instanceof Error && error.message === 'GITHUB_RATE_LIMIT_EXCEEDED') {
        setError('GitHub rate limit exceeded. Please wait a moment or provide a Personal Access Token for higher limits.');
      } else {
        setError('Failed to scan repositories. Please check your username and try again.');
      }
    } finally {
      setIsScanning(false);
    }
  };

  // Utility functions
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

  // Loading state
  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  // Auth forms
  if (!user) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
        <Card className="w-full max-w-md shadow-lg">
          <CardHeader className="text-center">
            <CardTitle className="text-2xl font-bold text-gray-900">
              🚀 GitHub Scanner
            </CardTitle>
            <p className="text-gray-600">
              Sign in to analyze your repositories
            </p>
          </CardHeader>
          <CardContent>
            <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as 'login' | 'signup')}>
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="login">Login</TabsTrigger>
                <TabsTrigger value="signup">Sign Up</TabsTrigger>
              </TabsList>
              
              <TabsContent value="login" className="space-y-4">
                <form onSubmit={handleLogin} className="space-y-4">
                  <div>
                    <label htmlFor="login-email" className="block text-sm font-medium text-gray-700 mb-1">
                      Email
                    </label>
                    <Input
                      id="login-email"
                      type="email"
                      value={loginData.email}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                        setLoginData((prev: LoginInput) => ({ ...prev, email: e.target.value }))
                      }
                      required
                      disabled={isAuthLoading}
                    />
                  </div>
                  <div>
                    <label htmlFor="login-password" className="block text-sm font-medium text-gray-700 mb-1">
                      Password
                    </label>
                    <Input
                      id="login-password"
                      type="password"
                      value={loginData.password}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                        setLoginData((prev: LoginInput) => ({ ...prev, password: e.target.value }))
                      }
                      required
                      disabled={isAuthLoading}
                    />
                  </div>
                  
                  {authError && (
                    <Alert className="border-red-200 bg-red-50">
                      <AlertCircle className="h-4 w-4 text-red-600" />
                      <AlertDescription className="text-red-700">
                        {authError}
                      </AlertDescription>
                    </Alert>
                  )}
                  
                  <Button type="submit" className="w-full" disabled={isAuthLoading}>
                    {isAuthLoading ? 'Signing In...' : 'Sign In'}
                  </Button>
                  
                  <Button 
                    type="button" 
                    variant="outline" 
                    className="w-full" 
                    disabled={isAuthLoading}
                    onClick={() => {
                      setLoginData({ email: 'demo@example.com', password: 'demopassword123' });
                    }}
                  >
                    Use Demo Account
                  </Button>
                </form>
              </TabsContent>
              
              <TabsContent value="signup" className="space-y-4">
                <form onSubmit={handleSignup} className="space-y-4">
                  <div>
                    <label htmlFor="signup-email" className="block text-sm font-medium text-gray-700 mb-1">
                      Email
                    </label>
                    <Input
                      id="signup-email"
                      type="email"
                      value={signupData.email}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                        setSignupData((prev: SignupInput) => ({ ...prev, email: e.target.value }))
                      }
                      required
                      disabled={isAuthLoading}
                    />
                  </div>
                  <div>
                    <label htmlFor="signup-password" className="block text-sm font-medium text-gray-700 mb-1">
                      Password (min 8 characters)
                    </label>
                    <Input
                      id="signup-password"
                      type="password"
                      value={signupData.password}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                        setSignupData((prev: SignupInput) => ({ ...prev, password: e.target.value }))
                      }
                      required
                      minLength={8}
                      disabled={isAuthLoading}
                    />
                  </div>
                  
                  {authError && (
                    <Alert className="border-red-200 bg-red-50">
                      <AlertCircle className="h-4 w-4 text-red-600" />
                      <AlertDescription className="text-red-700">
                        {authError}
                      </AlertDescription>
                    </Alert>
                  )}
                  
                  <Button type="submit" className="w-full" disabled={isAuthLoading}>
                    {isAuthLoading ? 'Creating Account...' : 'Create Account'}
                  </Button>
                  
                  <Button 
                    type="button" 
                    variant="outline" 
                    className="w-full" 
                    disabled={isAuthLoading}
                    onClick={() => {
                      setSignupData({ email: 'demo@example.com', password: 'demopassword123' });
                    }}
                  >
                    Create Demo Account
                  </Button>
                </form>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Main authenticated app
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
      <div className="container mx-auto max-w-6xl">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="flex justify-between items-center mb-4">
            <h1 className="text-4xl font-bold text-gray-900">
              🚀 GitHub Repository Quality Scanner
            </h1>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2 text-sm text-gray-600">
                <User className="w-4 h-4" />
                {user.email}
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={handleLogout}
              >
                <LogOut className="w-4 h-4 mr-1" />
                Sign Out
              </Button>
            </div>
          </div>
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
                    value={scanData.username}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                      setScanData((prev: GitHubScanInput) => ({ ...prev, username: e.target.value }))
                    }
                    required
                    disabled={isScanning}
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
                    value={scanData.personalAccessToken || ''}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                      setScanData((prev: GitHubScanInput) => ({
                        ...prev,
                        personalAccessToken: e.target.value || ''
                      }))
                    }
                    disabled={isScanning}
                  />
                </div>
              </div>
              
              {error && (
                <Alert className="border-red-200 bg-red-50">
                  <AlertCircle className="h-4 w-4 text-red-600" />
                  <AlertDescription className="text-red-700">{error}</AlertDescription>
                </Alert>
              )}

              <Button type="submit" disabled={isScanning} className="w-full">
                {isScanning ? '🔍 Scanning...' : '🔍 Scan Repositories'}
              </Button>
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
              {isLoadingHistory ? (
                <div className="text-center py-4">Loading scan history...</div>
              ) : (
                <div className="space-y-4">
                  {scanHistory.map((result, index: number) => (
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
              )}
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