import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { usersTable, sessionsTable } from '../db/schema';
import { signup, login, logout, getCurrentUser, parseAuthToken } from '../handlers/auth';
import { eq } from 'drizzle-orm';
import type { SignupInput, LoginInput } from '../schema';

describe('Authentication', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  const testSignupInput: SignupInput = {
    email: 'test@example.com',
    password: 'testpassword123',
  };

  const testLoginInput: LoginInput = {
    email: 'test@example.com',
    password: 'testpassword123',
  };

  describe('signup', () => {
    it('should create a new user and session', async () => {
      const result = await signup(testSignupInput);

      expect(result.user.email).toBe(testSignupInput.email);
      expect(result.user.id).toBeDefined();
      expect(result.user.createdAt).toBeInstanceOf(Date);
      expect(result.token).toBeDefined();
      expect(typeof result.token).toBe('string');

      // Verify user was created in database
      const users = await db.select()
        .from(usersTable)
        .where(eq(usersTable.email, testSignupInput.email))
        .execute();

      expect(users).toHaveLength(1);
      expect(users[0].email).toBe(testSignupInput.email);
      expect(users[0].hashedPassword).toBeDefined();
      expect(users[0].hashedPassword).not.toBe(testSignupInput.password); // Should be hashed

      // Verify session was created
      const sessions = await db.select()
        .from(sessionsTable)
        .where(eq(sessionsTable.userId, users[0].id))
        .execute();

      expect(sessions).toHaveLength(1);
      expect(sessions[0].expiresAt).toBeInstanceOf(Date);
      expect(sessions[0].expiresAt > new Date()).toBe(true); // Should be in the future
    });

    it('should reject duplicate email', async () => {
      await signup(testSignupInput);

      await expect(signup(testSignupInput)).rejects.toThrow(/already exists/i);
    });
  });

  describe('login', () => {
    beforeEach(async () => {
      await signup(testSignupInput);
    });

    it('should login with valid credentials', async () => {
      const result = await login(testLoginInput);

      expect(result.user.email).toBe(testLoginInput.email);
      expect(result.user.id).toBeDefined();
      expect(result.user.createdAt).toBeInstanceOf(Date);
      expect(result.token).toBeDefined();
      expect(typeof result.token).toBe('string');
    });

    it('should reject invalid email', async () => {
      const invalidInput: LoginInput = {
        ...testLoginInput,
        email: 'wrong@example.com',
      };

      await expect(login(invalidInput)).rejects.toThrow(/invalid email or password/i);
    });

    it('should reject invalid password', async () => {
      const invalidInput: LoginInput = {
        ...testLoginInput,
        password: 'wrongpassword',
      };

      await expect(login(invalidInput)).rejects.toThrow(/invalid email or password/i);
    });

    it('should create new session on login', async () => {
      const result = await login(testLoginInput);

      const sessions = await db.select()
        .from(sessionsTable)
        .where(eq(sessionsTable.userId, result.user.id))
        .execute();

      expect(sessions.length).toBeGreaterThan(0);
      const latestSession = sessions[sessions.length - 1];
      expect(latestSession.expiresAt > new Date()).toBe(true);
    });
  });

  describe('logout', () => {
    let sessionId: number;

    beforeEach(async () => {
      const signupResult = await signup(testSignupInput);
      const loginResult = await login(testLoginInput);
      
      // Extract session ID from token
      const parsed = parseAuthToken(loginResult.token);
      sessionId = parsed!.sessionId;
    });

    it('should delete session on logout', async () => {
      const result = await logout(sessionId);

      expect(result.success).toBe(true);

      // Verify session was deleted
      const sessions = await db.select()
        .from(sessionsTable)
        .where(eq(sessionsTable.id, sessionId))
        .execute();

      expect(sessions).toHaveLength(0);
    });
  });

  describe('getCurrentUser', () => {
    let userId: number;

    beforeEach(async () => {
      const result = await signup(testSignupInput);
      userId = result.user.id;
    });

    it('should return user data', async () => {
      const user = await getCurrentUser(userId);

      expect(user.id).toBe(userId);
      expect(user.email).toBe(testSignupInput.email);
      expect(user.createdAt).toBeInstanceOf(Date);
    });

    it('should reject invalid user ID', async () => {
      await expect(getCurrentUser(999999)).rejects.toThrow(/not found/i);
    });
  });

  describe('parseAuthToken', () => {
    it('should parse valid token', async () => {
      const result = await signup(testSignupInput);
      const parsed = parseAuthToken(result.token);

      expect(parsed).toBeDefined();
      expect(parsed!.sessionId).toBeGreaterThan(0);
      expect(parsed!.userId).toBe(result.user.id);
    });

    it('should return null for invalid token', () => {
      expect(parseAuthToken('invalid')).toBeNull();
      expect(parseAuthToken('1.2')).toBeNull();
      expect(parseAuthToken('abc.def.ghi')).toBeNull();
    });
  });
});