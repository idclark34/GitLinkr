/**
 * Main entry for the LinkHub backend server.
 * ------------------------------------------------
 * Uses Express + TypeScript to expose:
 *   - /auth routes for GitHub OAuth 2.0
 *   - /api routes for profile + search
 *
 * NOTE: Most handlers are intentionally lightweight for the MVP.
 * Feel free to extend them or move to feature-based modules later.
 */
import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';

dotenv.config(); // Load env variables BEFORE importing any routes that rely on them

// Route modules
import authRoutes from './routes/auth';
import profileRoutes from './routes/profile';
import recommendationsRoutes from './routes/recommendations';
import linkedinRoutes from './routes/linkedin';
import linkedinDataRoutes from './routes/linkedinData';
import connectionsRoutes from './routes/connections';
import invitationsRoutes from './routes/invitations';
import postsRoutes from './routes/posts';
import productsRoutes from './routes/products';
import followsRoutes from './routes/follows';
import storiesRoutes from './routes/stories';
import searchRoutes from './routes/search';
import reactionsRoutes from './routes/reactions';
import repoFollowsRoutes from './routes/repoFollows';
import apifyRoutes from './routes/apify';
import peopleRoutes from './routes/people';

// dotenv already called above

const app = express();

// Allow local frontend dev & deployed FE domain(s)
const allowedOrigins = [
  'http://localhost:5173',
  process.env.FRONTEND_URL || '',
  ...(process.env.ALLOWED_ORIGINS || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean),
];
const allowedOriginSuffixes = (process.env.ALLOWED_ORIGIN_SUFFIXES || '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow same-origin and tools that do not send Origin header
      if (!origin) return callback(null, true);
      if (allowedOrigins.includes(origin)) return callback(null, true);
      if (allowedOriginSuffixes.some((suffix) => origin.endsWith(suffix))) {
        return callback(null, true);
      }
      return callback(new Error('Not allowed by CORS'));
    },
    credentials: true,
  }),
);

app.use(express.json());

// Mount feature routes
app.use('/auth', authRoutes);
app.use('/api', profileRoutes);
app.use('/api', recommendationsRoutes);
app.use('/api', connectionsRoutes);
app.use('/api', invitationsRoutes);
app.use('/api', postsRoutes);
app.use('/api', productsRoutes);
app.use('/api', followsRoutes);
app.use('/api', storiesRoutes);
app.use('/api/search', searchRoutes);
app.use('/api', reactionsRoutes);
app.use('/api', repoFollowsRoutes);
app.use('/auth', linkedinRoutes);
app.use('/api', linkedinDataRoutes);
app.use('/api', apifyRoutes);
app.use('/api', peopleRoutes);

// Health + root info
app.get('/health', (_req, res) => {
  return res.status(200).json({ ok: true });
});

app.get('/', (_req, res) => {
  return res.json({
    ok: true,
    service: 'GitLinkr backend',
    version: '0.1.0',
    uptime_sec: Math.round(process.uptime()),
    docs: {
      categories: '/api/search/categories',
      people_search: 'POST /api/people/search',
    },
  });
});

const port = process.env.PORT || 4000;
app.listen(port, () => {
  /* eslint-disable no-console */
  console.log(`🚀 GitLinkr backend ready on http://localhost:${port}`);
});
