
import { initTRPC, TRPCError } from '@trpc/server';
import { createHTTPServer } from '@trpc/server/adapters/standalone';
import 'dotenv/config';
import cors from 'cors';
import superjson from 'superjson';
import { 
  githubScanInputSchema, 
  signupInputSchema, 
  signinInputSchema
} from './schema';
import { scanGitHubRepositories } from './handlers/scan_github_repositories';
import { getScanHistory } from './handlers/get_scan_history';
import { signup } from './handlers/auth_signup';
import { signin } from './handlers/auth_signin';
import { getCurrentUser } from './handlers/auth_get_current_user';
import { createDemoData } from './handlers/create_demo_data';

// Context interface
interface Context {
  user?: {
    userId: number;
    email: string;
  };
}

const t = initTRPC.context<Context>().create({
  transformer: superjson,
});

const publicProcedure = t.procedure;
const router = t.router;

// Authentication middleware
const authMiddleware = t.middleware(({ ctx, next }) => {
  if (!ctx.user) {
    throw new TRPCError({
      code: 'UNAUTHORIZED',
      message: 'You must be logged in to access this resource',
    });
  }
  return next({
    ctx: {
      ...ctx,
      user: ctx.user,
    },
  });
});

const protectedProcedure = publicProcedure.use(authMiddleware);

const appRouter = router({
  healthcheck: publicProcedure.query(() => {
    return { status: 'ok', timestamp: new Date().toISOString() };
  }),
  
  // Demo data setup
  createDemoData: publicProcedure
    .mutation(() => createDemoData()),
  
  // Authentication routes
  signup: publicProcedure
    .input(signupInputSchema)
    .mutation(({ input }) => signup(input)),
  
  signin: publicProcedure
    .input(signinInputSchema)
    .mutation(({ input }) => signin(input)),
  
  getCurrentUser: protectedProcedure
    .query(({ ctx }) => getCurrentUser(ctx.user.userId)),
  
  // Protected GitHub scanning routes
  scanGitHubRepositories: protectedProcedure
    .input(githubScanInputSchema)
    .mutation(({ ctx, input }) => scanGitHubRepositories(ctx.user.userId, input)),
  
  getScanHistory: protectedProcedure
    .query(({ ctx }) => getScanHistory(ctx.user.userId)),
});

export type AppRouter = typeof appRouter;

async function start() {
  const port = parseInt(process.env['SERVER_PORT'] || '2022', 10);
  const server = createHTTPServer({
    middleware: (req, res, next) => {
      cors()(req, res, next);
    },
    router: appRouter,
    createContext({ req }): Context {
      const authHeader = req.headers.authorization;
      
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return {};
      }
      
      const token = authHeader.slice(7);
      
      try {
        // Simple token decoding (in production, use proper JWT verification)
        const decoded = JSON.parse(Buffer.from(token, 'base64').toString());
        
        // Check if token is expired
        if (decoded.exp && decoded.exp < Date.now()) {
          return {};
        }
        
        return {
          user: {
            userId: decoded.userId,
            email: decoded.email,
          },
        };
      } catch (error) {
        return {};
      }
    },
  });
  server.listen(port);
  console.log(`TRPC server listening at port: ${port}`);
}

start();
