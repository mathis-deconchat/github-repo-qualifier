import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { trpc } from '../utils/trpc';
import type { User, AuthResponse, SignupInput, SigninInput } from '../../../server/src/schema';

interface AuthContextType {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  signin: (input: SigninInput) => Promise<void>;
  signup: (input: SignupInput) => Promise<void>;
  signout: () => void;
  isAuthenticated: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

interface AuthProviderProps {
  children: ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Load token from localStorage on mount
  useEffect(() => {
    const initializeAuth = async () => {
      const savedToken = localStorage.getItem('auth_token');
      if (savedToken) {
        setToken(savedToken);
        await loadUser();
      } else {
        setIsLoading(false);
      }
    };
    
    initializeAuth();
  }, []);

  const loadUser = async () => {
    try {
      const currentUser = await trpc.getCurrentUser.query();
      setUser(currentUser);
    } catch (error) {
      console.error('Failed to load user:', error);
      // Token might be invalid, clear it
      localStorage.removeItem('auth_token');
      setToken(null);
    } finally {
      setIsLoading(false);
    }
  };

  const signin = async (input: SigninInput) => {
    try {
      setIsLoading(true);
      const response: AuthResponse = await trpc.signin.mutate(input);
      
      setUser(response.user);
      setToken(response.token);
      localStorage.setItem('auth_token', response.token);
    } catch (error) {
      console.error('Signin failed:', error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  const signup = async (input: SignupInput) => {
    try {
      setIsLoading(true);
      const response: AuthResponse = await trpc.signup.mutate(input);
      
      setUser(response.user);
      setToken(response.token);
      localStorage.setItem('auth_token', response.token);
    } catch (error) {
      console.error('Signup failed:', error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  const signout = () => {
    setUser(null);
    setToken(null);
    localStorage.removeItem('auth_token');
  };

  const value: AuthContextType = {
    user,
    token,
    isLoading,
    signin,
    signup,
    signout,
    isAuthenticated: !!user,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}