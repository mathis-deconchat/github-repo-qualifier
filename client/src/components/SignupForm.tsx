import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';
import { Eye, EyeOff, Lock, Mail, AlertCircle, CheckCircle } from 'lucide-react';
import { useAuth } from './AuthContext';
import { trpc } from '../utils/trpc';
import type { SignupInput } from '../../../server/src/schema';

interface SignupFormProps {
  onSwitchToSignin: () => void;
}

export function SignupForm({ onSwitchToSignin }: SignupFormProps) {
  const { signup, isLoading } = useAuth();
  const [formData, setFormData] = useState<SignupInput>({
    email: '',
    password: '',
  });
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const passwordRequirements = [
    { test: (pwd: string) => pwd.length >= 8, label: 'At least 8 characters' },
    { test: (pwd: string) => /[A-Z]/.test(pwd), label: 'At least one uppercase letter' },
    { test: (pwd: string) => /[a-z]/.test(pwd), label: 'At least one lowercase letter' },
    { test: (pwd: string) => /\d/.test(pwd), label: 'At least one number' },
  ];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (formData.password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    if (!passwordRequirements.every(req => req.test(formData.password))) {
      setError('Password does not meet all requirements');
      return;
    }

    try {
      // If creating demo account, ensure demo data exists
      if (formData.email === 'demo@example.com') {
        try {
          await trpc.createDemoData.mutate();
        } catch (error) {
          // Demo data might already exist, continue with signup
          console.log('Demo data already exists or creation failed:', error);
        }
      }
      
      await signup(formData);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to create account. Please try again.';
      setError(errorMessage);
    }
  };

  return (
    <Card className="w-full max-w-md mx-auto shadow-lg">
      <CardHeader className="text-center">
        <CardTitle className="text-2xl font-bold text-gray-900">
          🌟 Create Account
        </CardTitle>
        <p className="text-gray-600">Join us to start analyzing your repositories</p>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="mb-4 p-3 bg-green-50 rounded-md border border-green-200">
            <p className="text-xs text-green-700 font-medium mb-2">Quick Demo Setup:</p>
            <button
              type="button"
              onClick={() => {
                setFormData({ email: 'demo@example.com', password: 'password123' });
                setConfirmPassword('password123');
              }}
              className="text-xs text-green-600 hover:text-green-800 underline"
            >
              Create Demo Account (demo@example.com)
            </button>
          </div>
          
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
              Email Address
            </label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <Input
                id="email"
                type="email"
                placeholder="Enter your email"
                value={formData.email}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                  setFormData((prev: SignupInput) => ({ ...prev, email: e.target.value }))
                }
                className="pl-10"
                required
              />
            </div>
          </div>

          <div>
            <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">
              Password
            </label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <Input
                id="password"
                type={showPassword ? 'text' : 'password'}
                placeholder="Create a password"
                value={formData.password}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                  setFormData((prev: SignupInput) => ({ ...prev, password: e.target.value }))
                }
                className="pl-10 pr-10"
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <div>
            <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700 mb-1">
              Confirm Password
            </label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <Input
                id="confirmPassword"
                type={showConfirmPassword ? 'text' : 'password'}
                placeholder="Confirm your password"
                value={confirmPassword}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                  setConfirmPassword(e.target.value)
                }
                className="pl-10 pr-10"
                required
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* Password Requirements */}
          {formData.password && (
            <div className="bg-gray-50 p-3 rounded-md">
              <p className="text-xs font-medium text-gray-700 mb-2">Password Requirements:</p>
              <div className="space-y-1">
                {passwordRequirements.map((req, index) => (
                  <div key={index} className="flex items-center text-xs">
                    {req.test(formData.password) ? (
                      <CheckCircle className="w-3 h-3 text-green-500 mr-2" />
                    ) : (
                      <div className="w-3 h-3 border border-gray-300 rounded-full mr-2" />
                    )}
                    <span className={req.test(formData.password) ? 'text-green-700' : 'text-gray-600'}>
                      {req.label}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {error && (
            <Alert className="border-red-200 bg-red-50">
              <AlertCircle className="h-4 w-4 text-red-600" />
              <AlertDescription className="text-red-700">{error}</AlertDescription>
            </Alert>
          )}

          <Button type="submit" disabled={isLoading} className="w-full">
            {isLoading ? '🔄 Creating account...' : '🌟 Create Account'}
          </Button>

          <Separator />

          <div className="text-center">
            <p className="text-sm text-gray-600">
              Already have an account?{' '}
              <button
                type="button"
                onClick={onSwitchToSignin}
                className="font-medium text-blue-600 hover:text-blue-800 underline"
              >
                Sign in here
              </button>
            </p>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}