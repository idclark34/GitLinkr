import express from 'express';
import dotenv from 'dotenv';
import * as li from '../utils/linkedin';
import crypto from 'crypto';     

dotenv.config();

const router = express.Router();

router.get('/linkedin', (_req, res) => {
  const clientId = process.env.LINKEDIN_CLIENT_ID;
  const redirectUri = process.env.LINKEDIN_REDIRECT_URI;
  const scope = encodeURIComponent('openid profile email');
  const state = crypto.randomUUID(); 
  
  res.redirect(
    `https://www.linkedin.com/oauth/v2/authorization?response_type=code&client_id=${clientId}&redirect_uri=${encodeURIComponent(
      redirectUri as string,
    )}&scope=${scope}`,
  );
});

router.get('/linkedin/callback', async (req, res) => {
  const { code } = req.query;
  if (!code || Array.isArray(code)) return res.status(400).json({ error: 'Missing code' });
  try {
    const token = await li.exchangeCodeForToken(code);
    const profile = await li.fetchLinkedInProfile(token);
    return res.json({ token, profile });
  } catch (e) {
    /* eslint-disable no-console */
    console.error(e);
    return res.status(500).json({ error: 'LinkedIn OAuth failed' });
  }
});

export default router;
