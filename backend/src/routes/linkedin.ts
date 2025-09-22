import express from 'express';
import dotenv from 'dotenv';
import * as li from '../utils/linkedin';
import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';     

dotenv.config();

const router = express.Router();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;
const supabase = supabaseUrl && supabaseAnonKey ? createClient(supabaseUrl, supabaseAnonKey) : null;

router.get('/linkedin', (_req, res) => {
  const clientId = process.env.LINKEDIN_CLIENT_ID;
  const redirectUri = process.env.LINKEDIN_REDIRECT_URI;
  const scope = encodeURIComponent('openid profile email r_liteprofile');
  const state = crypto.randomUUID(); 
  
  res.redirect(
    `https://www.linkedin.com/oauth/v2/authorization?response_type=code&client_id=${clientId}&redirect_uri=${encodeURIComponent(
      redirectUri as string,
    )}&scope=${scope}`,
  );
});

// Simple diagnostics to verify which env values are active in this deployment
router.get('/linkedin/debug', (_req, res) => {
  return res.json({
    client_id: process.env.LINKEDIN_CLIENT_ID || null,
    redirect_uri: process.env.LINKEDIN_REDIRECT_URI || null,
    frontend_url: process.env.FRONTEND_URL || null,
  });
});

router.get('/linkedin/callback', async (req, res) => {
  const { code } = req.query;
  if (!code || Array.isArray(code)) return res.status(400).json({ error: 'Missing code' });
  try {
    const token = await li.exchangeCodeForToken(String(code));
    const profile = await li.fetchLinkedInProfile(token);

    // Persist to Supabase if client indicates GitHub login (server-trusted from session in future)
    const ghLogin = typeof req.query.gh_login === 'string' ? req.query.gh_login : undefined;
    if (ghLogin && supabase) {
      try {
        const name = (profile as any)?.name || [profile?.given_name, profile?.family_name].filter(Boolean).join(' ');
        await supabase.from('linkedin_profiles').upsert({
          github_login: ghLogin,
          name: name || null,
          headline: (profile as any)?.headline || null,
          email: (profile as any)?.email || null,
          vanity: (profile as any)?.vanityName || null,
          linkedin_id: (profile as any)?.id || null,
          raw: profile as any,
        });
      } catch (e) {
        console.error('Failed to upsert linkedin_profiles', e);
      }
    }

    return res.json({ token, profile });
  } catch (e) {
    /* eslint-disable no-console */
    console.error(e);
    return res.status(500).json({ error: 'LinkedIn OAuth failed' });
  }
});

export default router;
