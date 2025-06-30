import { useState } from 'react';
import { AuthProvider, useAuth } from './components/AuthContext';
import { SigninForm } from './components/SigninForm';
import { SignupForm } from './components/SignupForm';
import { Dashboard } from './components/Dashboard';
import { trpc } from './utils/trpc';

type AuthMode = 'signin' | 'signup' | 'forgot-password';

function AuthenticatedApp() {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-4 border-blue-500 border-t-transparent mx-auto mb-4"></div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  if (user) {
    return <Dashboard />;
  }

  return <AuthPages />;
}

function AuthPages() {
  const [authMode, setAuthMode] = useState<AuthMode>('signin');
  const { signin } = useAuth();
  const [isAutoSigningIn, setIsAutoSigningIn] = useState(false);

  const handleDemoSignin = async () => {
    setIsAutoSigningIn(true);
    try {
      // Try to create demo data first
      await trpc.createDemoData.mutate();
      
      // Then sign in with demo account
      await signin({ email: 'demo@example.com', password: 'password123' });
    } catch (error) {
      console.error('Demo signin failed:', error);
      // If demo signin fails, continue to show auth forms
    } finally {
      setIsAutoSigningIn(false);
    }
  };

  if (isAutoSigningIn) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-4 border-blue-500 border-t-transparent mx-auto mb-4"></div>
          <p className="text-gray-600">Setting up demo account...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">
            🚀 GitHub Repository Scanner
          </h1>
          <p className="text-lg text-gray-600">
            Analyze your repositories and get quality scores
          </p>
        </div>

        {/* Quick Demo Button */}
        <div className="mb-6">
          <button
            onClick={handleDemoSignin}
            className="w-full bg-gradient-to-r from-green-500 to-blue-600 text-white font-semibold py-3 px-4 rounded-lg hover:from-green-600 hover:to-blue-700 transition-all duration-200 shadow-lg"
          >
            🎯 Try Demo - Skip Authentication
          </button>
          <p className="text-center text-xs text-gray-500 mt-2">
            Quick access with sample data
          </p>
        </div>

        <div className="text-center mb-4">
          <span className="bg-gray-100 px-3 py-1 rounded-full text-sm text-gray-600">
            OR
          </span>
        </div>

        {/* Auth Forms */}
        {authMode === 'signin' && (
          <SigninForm
            onSwitchToSignup={() => setAuthMode('signup')}
            onForgotPassword={() => setAuthMode('forgot-password')}
          />
        )}

        {authMode === 'signup' && (
          <SignupForm
            onSwitchToSignin={() => setAuthMode('signin')}
          />
        )}

        {authMode === 'forgot-password' && (
          <div className="text-center">
            <p className="text-gray-600 mb-4">
              Password recovery will be implemented in a future update.
            </p>
            <button
              onClick={() => setAuthMode('signin')}
              className="text-blue-600 hover:text-blue-800 underline"
            >
              Back to Sign In
            </button>
          </div>
        )}

        {/* Footer */}
        <div className="text-center mt-8">
          <p className="text-gray-500 text-sm">
            🌟 Built with React, TypeScript, tRPC, and Radix UI
          </p>
        </div>
      </div>
    </div>
  );
}

function App() {
  return (
    <AuthProvider>
      <AuthenticatedApp />
    </AuthProvider>
  );
}

export default App;