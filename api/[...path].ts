/**
 * Vercel serverless entry point for the Express API.
 * Keep business routes and middleware in apps/api/src; this file only adapts
 * the existing Express application to Vercel's Functions runtime.
 */
export { app as default } from '../apps/api/src/app';
