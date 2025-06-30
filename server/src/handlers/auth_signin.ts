import { db } from '../db';
import { usersTable } from '../db/schema';
import { type SigninInput, type AuthResponse } from '../schema';
import { eq } from 'drizzle-orm';

// Simple hash function for demonstration (in production, use proper bcrypt)
function simpleHash(password: string): string {
  return Buffer.from(password + 'salt').toString('base64');
}

// Simple JWT-like token generation (in production, use proper JWT)
function generateToken(userId: number, email: string): string {
  const payload = { userId, email, exp: Date.now() + 7 * 24 * 60 * 60 * 1000 }; // 7 days
  return Buffer.from(JSON.stringify(payload)).toString('base64');
}

export const signin = async (input: SigninInput): Promise<AuthResponse> => {
  try {
    // Find user by email
    const users = await db.select()
      .from(usersTable)
      .where(eq(usersTable.email, input.email))
      .execute();

    if (users.length === 0) {
      throw new Error('Invalid email or password');
    }

    const user = users[0];

    // Verify password
    const expectedHash = simpleHash(input.password);
    if (user.passwordHash !== expectedHash) {
      throw new Error('Invalid email or password');
    }

    // Generate token
    const token = generateToken(user.id, user.email);

    return {
      user: {
        id: user.id,
        email: user.email,
        createdAt: user.createdAt,
      },
      token,
    };
  } catch (error) {
    console.error('Signin failed:', error);
    throw error;
  }
};