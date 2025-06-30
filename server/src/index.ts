
import { initTRPC } from '@trpc/server';
import { createHTTPServer } from '@trpc/server/adapters/standalone';
import 'dotenv/config';
import cors from 'cors';
import superjson from 'superjson';
import { githubScanInputSchema } from './schema';
import { scanGitHubRepositories } from './handlers/scan_github_repositories';
import { getScanHistory } from './handlers/get_scan_history';
import { z } from 'zod';

const t = initTRPC.create({
  transformer: superjson,
});

const publicProcedure = t.procedure;
const router = t.router;

const appRouter = router({
  healthcheck: publicProcedure.query(() => {
    return { status: 'ok', timestamp: new Date().toISOString() };
  }),
  
  // Scan GitHub repositories for a user
  scanGitHubRepositories: publicProcedure
    .input(githubScanInputSchema)
    .mutation(({ input }) => scanGitHubRepositories(input)),
  
  // Get scan history for a user
  getScanHistory: publicProcedure
    .input(z.object({ username: z.string().min(1) }))
    .query(({ input }) => getScanHistory(input.username)),
});

export type AppRouter = typeof appRouter;

async function start() {
  const port = process.env['SERVER_PORT'] || 2022;
  const server = createHTTPServer({
    middleware: (req, res, next) => {
      cors()(req, res, next);
    },
    router: appRouter,
    createContext() {
      return {};
    },
  });
  server.listen(port);
  console.log(`TRPC server listening at port: ${port}`);
}

start();
