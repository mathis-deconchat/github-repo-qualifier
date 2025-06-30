import { initTRPC, TRPCError } from '@trpc/server';
import { createHTTPServer } from '@trpc/server/adapters/standalone';
import 'dotenv/config';
import cors from 'cors';
import superjson from 'superjson';
import { githubScanInputSchema, signupInputSchema, loginInputSchema } from './schema';
import { scanGitHubRepositories } from './handlers/scan_github_repositories';
import { getScanHistory } from './handlers/get_scan_history';
import { signup, login, logout, getCurrentUser, parseAuthToken } from './handlers/auth';
import { db } from './db';
import { sessionsTable } from './db/schema';
import { eq, and, gt } from 'drizzle-orm';

// Create context with authentication
const createContext = async ({ req }: { req: any }) => {
  let user = null;
  let sessionId = null;

  try {
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      const parsed = parseAuthToken(token);
      
      if (parsed) {
        // Verify session exists and is not expired
        const sessions = await db.select()
          .from(sessionsTable)
          .where(
            and(
              eq(sessionsTable.id, parsed.sessionId),
              eq(sessionsTable.userId, parsed.userId),
              gt(sessionsTable.expiresAt, new Date())
            )
          )
          .limit(1)
          .execute();
        
        if (sessions.length > 0) {
          user = { id: parsed.userId };
          sessionId = parsed.sessionId;
        }
      }
    }
  } catch (error) {
    // Invalid token, user remains null
  }

  return { user, sessionId };
};

type Context = Awaited<ReturnType<typeof createContext>>;

const t = initTRPC.context<Context>().create({
  transformer: superjson,
});

const publicProcedure = t.procedure;
const router = t.router;

// Protected procedure middleware
const protectedProcedure = t.procedure.use(({ ctx, next }) => {
  if (!ctx.user) {
    throw new TRPCError({
      code: 'UNAUTHORIZED',
      message: 'Authentication required',
    });
  }
  return next({
    ctx: {
      ...ctx,
      user: ctx.user, // user is guaranteed to exist here
    },
  });
});

const appRouter = router({
  healthcheck: publicProcedure.query(() => {
    return { status: 'ok', timestamp: new Date().toISOString() };
  }),
  
  
  
  // Auth procedures
  auth: router({
    signup: publicProcedure
      .input(signupInputSchema)
      .mutation(({ input }) => signup(input)),
    
    login: publicProcedure
      .input(loginInputSchema)
      .mutation(({ input }) => login(input)),
    
    logout: protectedProcedure
      .mutation(({ ctx }) => logout(ctx.sessionId!)),
    
    getCurrentUser: protectedProcedure
      .query(({ ctx }) => getCurrentUser(ctx.user.id)),
  }),
  
  // Protected GitHub scan procedures
  scanGitHubRepositories: protectedProcedure
    .input(githubScanInputSchema)
    .mutation(({ input, ctx }) => scanGitHubRepositories(input, ctx.user.id)),
  
  getScanHistory: protectedProcedure
    .query(({ ctx }) => getScanHistory(ctx.user.id)),
});

export type AppRouter = typeof appRouter;

async function start() {
  const port = process.env['SERVER_PORT'] || 2022;
  const server = createHTTPServer({
    middleware: (req, res, next) => {
      cors({
        origin: true,
        credentials: true,
      })(req, res, next);
    },
    router: appRouter,
    createContext,
  });
  server.listen(port);
  console.log(`TRPC server listening at port: ${port}`);
}

start();