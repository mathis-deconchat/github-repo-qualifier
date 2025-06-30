import { db } from '../db';
import { usersTable } from '../db/schema';
import { type User } from '../schema';
import { eq } from 'drizzle-orm';

export const getCurrentUser = async (userId: number): Promise<User> => {
  try {
    const users = await db.select()
      .from(usersTable)
      .where(eq(usersTable.id, userId))
      .execute();

    if (users.length === 0) {
      throw new Error('User not found');
    }

    const user = users[0];

    return {
      id: user.id,
      email: user.email,
      createdAt: user.createdAt,
    };
  } catch (error) {
    console.error('Get current user failed:', error);
    throw error;
  }
};