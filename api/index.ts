/**
 * api/index.ts — Vercel serverless entry point.
 *
 * CRITICAL: import with the explicit `../server.ts` path. The repo now
 * contains a `server/` directory (server/lib, server/routes); Node ESM
 * cannot resolve directory imports, so `from '../server'` was resolving
 * to /var/task/server (the directory) and crashing every serverless
 * invocation with ERR_UNSUPPORTED_DIR_IMPORT.
 */
import app from '../server.ts';

export default app;
