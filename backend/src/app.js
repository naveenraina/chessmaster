/**
 * Express app (without .listen) so tests can import it.
 */
import express from 'express';
import cors from 'cors';
import { router, errorHandler } from './routes.js';

export const app = express();
app.use(cors({ origin: process.env.CORS_ORIGIN ? process.env.CORS_ORIGIN.split(',') : true }));
app.use(express.json());

app.get('/api/health', (_req, res) => res.json({ ok: true }));
app.use('/api', router);
app.use(errorHandler);
