import { TRPCError } from '@trpc/server';
import { db } from '../db';
import { usersTable, sessionsTable } from '../db/schema';
import type { SignupInput, LoginInput, User } from '../schema';
import { eq } from 'drizzle-orm';

const SESSION_DURATION = 7 * 24 * 60 * 60 * 1000; // 7 days in milliseconds

// Simple hash function (NOT for production use)
function simpleHash(password: string): string {
  let hash = 0;
  for (let i = 0; i < password.length; i++) {
    const char = password.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return hash.toString(36);
}

// Simple token generation (NOT for production use)
function generateToken(): string {
  return Math.random().toString(36).substring(2) + Date.now().toString(36);
}

export const signup = async (input: SignupInput): Promise<{ user: User; token: string }> => {
  try {
    // Check if user already exists
    const existingUser = await db.select()
      .from(usersTable)
      .where(eq(usersTable.email, input.email))
      .limit(1)
      .execute();

    if (existingUser.length > 0) {
      throw new TRPCError({
        code: 'CONFLICT',
        message: 'User with this email already exists',
      });
    }

    // Hash password (simple hash for demo)
    const hashedPassword = simpleHash(input.password);

    // Create user
    const result = await db.insert(usersTable)
      .values({
        email: input.email,
        hashedPassword,
      })
      .returning()
      .execute();

    const user = result[0];

    // Create session
    const expiresAt = new Date(Date.now() + SESSION_DURATION);
    const sessionResult = await db.insert(sessionsTable)
      .values({
        userId: user.id,
        expiresAt,
      })
      .returning()
      .execute();

    const session = sessionResult[0];

    // Generate simple token
    const token = `${session.id}.${user.id}.${generateToken()}`;

    return {
      user: {
        id: user.id,
        email: user.email,
        createdAt: user.createdAt,
      },
      token,
    };
  } catch (error) {
    if (error instanceof TRPCError) {
      throw error;
    }
    console.error('Signup failed:', error);
    throw new TRPCError({
      code: 'INTERNAL_SERVER_ERROR',
      message: 'Failed to create account',
    });
  }
};

export const login = async (input: LoginInput): Promise<{ user: User; token: string }> => {
  try {
    // Find user
    const users = await db.select()
      .from(usersTable)
      .where(eq(usersTable.email, input.email))
      .limit(1)
      .execute();

    if (users.length === 0) {
      throw new TRPCError({
        code: 'UNAUTHORIZED',
        message: 'Invalid email or password',
      });
    }

    const user = users[0];

    // Verify password (simple hash comparison)
    const hashedPassword = simpleHash(input.password);
    if (hashedPassword !== user.hashedPassword) {
      throw new TRPCError({
        code: 'UNAUTHORIZED',
        message: 'Invalid email or password',
      });
    }

    // Create session
    const expiresAt = new Date(Date.now() + SESSION_DURATION);
    const sessionResult = await db.insert(sessionsTable)
      .values({
        userId: user.id,
        expiresAt,
      })
      .returning()
      .execute();

    const session = sessionResult[0];

    // Generate simple token
    const token = `${session.id}.${user.id}.${generateToken()}`;

    return {
      user: {
        id: user.id,
        email: user.email,
        createdAt: user.createdAt,
      },
      token,
    };
  } catch (error) {
    if (error instanceof TRPCError) {
      throw error;
    }
    console.error('Login failed:', error);
    throw new TRPCError({
      code: 'INTERNAL_SERVER_ERROR',
      message: 'Login failed',
    });
  }
};

export const logout = async (sessionId: number): Promise<{ success: boolean }> => {
  try {
    await db.delete(sessionsTable)
      .where(eq(sessionsTable.id, sessionId))
      .execute();

    return { success: true };
  } catch (error) {
    console.error('Logout failed:', error);
    throw new TRPCError({
      code: 'INTERNAL_SERVER_ERROR',
      message: 'Logout failed',
    });
  }
};

export const getCurrentUser = async (userId: number): Promise<User> => {
  try {
    const users = await db.select()
      .from(usersTable)
      .where(eq(usersTable.id, userId))
      .limit(1)
      .execute();

    if (users.length === 0) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: 'User not found',
      });
    }

    const user = users[0];
    return {
      id: user.id,
      email: user.email,
      createdAt: user.createdAt,
    };
  } catch (error) {
    if (error instanceof TRPCError) {
      throw error;
    }
    console.error('Get current user failed:', error);
    throw new TRPCError({
      code: 'INTERNAL_SERVER_ERROR',
      message: 'Failed to get user',
    });
  }
};

// Helper function to parse auth token
export const parseAuthToken = (token: string): { sessionId: number; userId: number } | null => {
  try {
    const parts = token.split('.');
    if (parts.length < 3) return null;
    
    const sessionId = parseInt(parts[0]);
    const userId = parseInt(parts[1]);
    
    if (isNaN(sessionId) || isNaN(userId)) return null;
    
    return { sessionId, userId };
  } catch {
    return null;
  }
};

