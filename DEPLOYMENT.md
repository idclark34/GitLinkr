## GitLinkr Deployment Guide

### Services
- Frontend: Vercel (recommended) or Netlify
- Backend: Render (recommended), Railway, Fly.io, or Heroku
- Database/Auth: Supabase

### Required environment variables

Backend (`backend` service):
- `PORT` (provided by host)
- `FRONTEND_URL` → e.g. https://your-frontend-domain
- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `GITHUB_CLIENT_ID`
- `GITHUB_CLIENT_SECRET`
- `GITHUB_REDIRECT_URI` → https://your-backend-domain/auth/github/callback
- `GITHUB_FALLBACK_TOKEN` (optional, low-priv token to smooth rate limits)
- `OPENAI_API_KEY` (optional features)
- `USE_DUMMY_DATA=false`

Frontend (`frontend` project):
- `VITE_BACKEND_URL` → https://your-backend-domain
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

### Deploy steps

1. Create Supabase project and capture URL + anon key.
2. Deploy backend (Render example):
   - Root: `backend/`
   - Build: `npm ci && npm run build`
   - Start: `npm start`
   - Node: 18+
   - Add env vars above. After deploy, note the backend URL.
3. Configure GitHub OAuth App:
   - Homepage: your FE URL
   - Callback: `https://your-backend-domain/auth/github/callback`
   - Put client ID/secret into backend env. Set `FRONTEND_URL`.
4. Deploy frontend (Vercel example):
   - Root: `frontend/`
   - Framework: Vite
   - Build: `npm ci && npm run build`
   - Output: `dist`
   - Env: `VITE_BACKEND_URL`, `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`
5. Test end-to-end login and browsing.

### Production hardening
- CORS allow-list configured in `backend/src/index.ts` via `FRONTEND_URL`.
- Prefer setting `FRONTEND_URL` to your final domain (and not `*`).
- Add simple rate limiting and request logging (e.g., `express-rate-limit`, `morgan`).
- Consider a cache for GitHub responses (e.g., Upstash Redis) to avoid rate limits.

### Troubleshooting
- GitHub OAuth 403/redirect loops: verify OAuth callback URL and `FRONTEND_URL`.
- CORS errors: ensure frontend origin matches exactly the allowed origins list.
- 401s to GitHub: verify token pattern check in `frontend/src/api.ts` and that the Authorization header is present for real tokens.




