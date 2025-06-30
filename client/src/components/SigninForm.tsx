import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';
import { Eye, EyeOff, Lock, Mail, AlertCircle } from 'lucide-react';
import { useAuth } from './AuthContext';
import { trpc } from '../utils/trpc';
import type { SigninInput } from '../../../server/src/schema';

interface SigninFormProps {
  onSwitchToSignup: () => void;
  onForgotPassword: () => void;
}

export function SigninForm({ onSwitchToSignup, onForgotPassword }: SigninFormProps) {
  const { signin, isLoading } = useAuth();
  const [formData, setFormData] = useState<SigninInput>({
    email: '',
    password: '',
  });
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    try {
      // If signing in with demo account, ensure demo data exists
      if (formData.email === 'demo@example.com') {
        try {
          await trpc.createDemoData.mutate();
        } catch (error) {
          // Demo data might already exist, continue with signin
          console.log('Demo data already exists or creation failed:', error);
        }
      }
      
      await signin(formData);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to sign in. Please try again.';
      setError(errorMessage);
    }
  };

  return (
    <Card className="w-full max-w-md mx-auto shadow-lg">
      <CardHeader className="text-center">
        <CardTitle className="text-2xl font-bold text-gray-900">
          🔐 Welcome Back
        </CardTitle>
        <p className="text-gray-600">Sign in to your account</p>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="mb-4 p-3 bg-blue-50 rounded-md border border-blue-200">
            <p className="text-xs text-blue-700 font-medium mb-2">Demo Account:</p>
            <p className="text-xs text-blue-600">Email: demo@example.com</p>
            <p className="text-xs text-blue-600">Password: password123</p>
            <button
              type="button"
              onClick={() => setFormData({ email: 'demo@example.com', password: 'password123' })}
              className="text-xs text-blue-600 hover:text-blue-800 underline mt-1"
            >
              Use Demo Account
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
                  setFormData((prev: SigninInput) => ({ ...prev, email: e.target.value }))
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
                placeholder="Enter your password"
                value={formData.password}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                  setFormData((prev: SigninInput) => ({ ...prev, password: e.target.value }))
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

          {error && (
            <Alert className="border-red-200 bg-red-50">
              <AlertCircle className="h-4 w-4 text-red-600" />
              <AlertDescription className="text-red-700">{error}</AlertDescription>
            </Alert>
          )}

          <Button type="submit" disabled={isLoading} className="w-full">
            {isLoading ? '🔄 Signing in...' : '🚀 Sign In'}
          </Button>

          <div className="text-center">
            <button
              type="button"
              onClick={onForgotPassword}
              className="text-sm text-blue-600 hover:text-blue-800 underline"
            >
              Forgot your password?
            </button>
          </div>

          <Separator />

          <div className="text-center">
            <p className="text-sm text-gray-600">
              Don't have an account?{' '}
              <button
                type="button"
                onClick={onSwitchToSignup}
                className="font-medium text-blue-600 hover:text-blue-800 underline"
              >
                Sign up here
              </button>
            </p>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}