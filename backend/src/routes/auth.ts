import express from 'express';
import dotenv from 'dotenv';
import * as github from '../utils/github';
import dummyData from '../utils/dummyData';

dotenv.config();

const router = express.Router();

/**
 * Step 1 – Redirect the user to GitHub's OAuth consent screen.
 * We request basic profile + repo scopes. Adjust as needed.
 */
router.get('/github', (_req, res) => {
  const clientId = process.env.GITHUB_CLIENT_ID;
  const redirectUri = process.env.GITHUB_REDIRECT_URI;
  const scope = 'read:user user:email repo';

  if (!clientId || !redirectUri) {
    return res.status(500).json({ error: 'GitHub OAuth env vars not configured' });
  }

  const redirect = `https://github.com/login/oauth/authorize?client_id=${clientId}&redirect_uri=${encodeURIComponent(
    redirectUri,
  )}&scope=${encodeURIComponent(scope)}`;
  res.redirect(redirect);
});

/**
 * Step 2 – GitHub redirects back with a temporary code. Exchange it for an access token,
 * then fetch the authenticated user's basic profile.
 */
router.get('/github/callback', async (req, res) => {
  const { code } = req.query;

  // Allow local dev w/ dummy data when GitHub App is not approved yet.
  if (process.env.USE_DUMMY_DATA === 'true') {
    return res.json(dummyData.authResponse);
  }

  if (!code || Array.isArray(code)) {
    return res.status(400).json({ error: 'Missing ?code parameter' });
  }

  try {
    const token = await github.exchangeCodeForToken(code);
    const user = await github.fetchGitHubUser(token);
    const repos = await github.fetchUserRepos(token, user.login);

    return res.json({ token, user, repos });
  } catch (err) {
    /* eslint-disable no-console */
    console.error('OAuth callback error', err);
    return res.status(500).json({ error: 'OAuth flow failed' });
  }
});

export default router;
