/**
 * api/index.ts — Vercel serverless entry point.
 *
 * Phase 1 NOTE: this now imports the app from server.ts exactly as
 * before (no behavior change in this commit). Phase 2 will rewire the
 * legacy in-memory routes to the Supabase-backed modules under
 * server/lib and server/routes without changing the public API paths.
 */
import app from '../server';

export default app;
