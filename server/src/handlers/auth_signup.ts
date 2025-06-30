import { db } from '../db';
import { usersTable } from '../db/schema';
import { type SignupInput, type AuthResponse } from '../schema';
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

export const signup = async (input: SignupInput): Promise<AuthResponse> => {
  try {
    // Check if user already exists
    const existingUser = await db.select()
      .from(usersTable)
      .where(eq(usersTable.email, input.email))
      .execute();

    if (existingUser.length > 0) {
      throw new Error('User with this email already exists');
    }

    // Hash password
    const passwordHash = simpleHash(input.password);

    // Create user
    const result = await db.insert(usersTable)
      .values({
        email: input.email,
        passwordHash,
      })
      .returning()
      .execute();

    const user = result[0];

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
    console.error('Signup failed:', error);
    throw error;
  }
};