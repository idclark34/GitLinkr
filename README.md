# GitLinkr

A minimal developer profile & discovery platform powered by GitHub data.

## Tech Stack

- **Frontend**: React + Vite + TailwindCSS
- **Backend**: Node.js (Express) + TypeScript
- **Database**: Supabase (placeholder – not used in MVP yet)
- **OAuth**: GitHub OAuth 2.0

## Prerequisites

1. **Node.js** 18+
2. **pnpm** (recommended) or npm / yarn
3. GitHub OAuth App credentials (Client ID + Client Secret)

> Haven't had your OAuth app approved yet? No problem – run with dummy data by setting `USE_DUMMY_DATA=true`.

## Setup

```bash
# clone repo
pnpm install # installs root dependencies (none) – then CD into packages

cd backend
pnpm install
cp .env.example .env # add GitHub creds if you have them

cd ../frontend
pnpm install
cp .env.example .env
```

## Running Locally

### 1. Backend

```bash
cd backend
pnpm dev # starts on http://localhost:4000
```

Environment variables:

```
GITHUB_CLIENT_ID=your_id
GITHUB_CLIENT_SECRET=your_secret
GITHUB_REDIRECT_URI=http://localhost:4000/auth/github/callback
USE_DUMMY_DATA=true   # enables mock GitHub data
FRONTEND_URL=http://localhost:5173
```

### 2. Frontend

```bash
cd frontend
pnpm dev # starts on http://localhost:5173
```

Now open http://localhost:5173 in your browser. If dummy mode is on, click **Sign in with GitHub** and you'll immediately see the profile for `octocat`.

## Deployment

- **Frontend**: Deploy `frontend` folder to Vercel. `vite build` produces `/dist`.
- **Backend**: Deploy `backend` to Railway. Remember to add the same env vars.

## Next Steps

- Implement Supabase to store additional user-generated content (custom bio sections, social links, etc.)
- Add search & discovery endpoints and UI filters.
- Create feed of commit / star activity.

## Scripts

| Package   | Command | Description                 |
|-----------|---------|-----------------------------|
| backend   | `pnpm dev`   | Run Express + ts-node-dev |
| frontend  | `pnpm dev`   | Run Vite dev server       |

Happy hacking! 🚀
