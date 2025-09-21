import express, { Request, Response } from 'express';
import * as github from '../utils/github';
import { createClient } from '@supabase/supabase-js';
import dummyData from '../utils/dummyData';

const router = express.Router();

// GET /api/github/repos/:username - list public repos (uses user token if provided)
router.get('/github/repos/:username', async (req: Request, res: Response) => {
  const { username } = req.params;
  const token = (req.headers.authorization || '').replace('Bearer ', '') || process.env.GITHUB_FALLBACK_TOKEN || undefined;
  try {
    const repos = await github.fetchUserRepos(token, username);
    const simplified = repos.map((r: any) => ({
      id: r.id,
      name: r.name,
      full_name: r.full_name,
      html_url: r.html_url,
      description: r.description,
      language: r.language,
      stargazers_count: r.stargazers_count,
      forks_count: r.forks_count,
    }));
    return res.json(simplified);
  } catch (e) {
    return res.status(500).json({ error: 'Failed to list repos' });
  }
});

/**
 * GET /api/profile/:username
 * Fetches a user's public profile and repositories from GitHub (or dummy data).
 */
router.get('/profile/:username', async (req, res) => {
  const { username } = req.params;

  if (!username) return res.status(400).json({ error: 'Username required' });

  // In dummy-data mode, return pre-canned profile so FE can render without API.
  if (process.env.USE_DUMMY_DATA === 'true') {
    return res.json(dummyData.profileResponse);
  }

  try {
    const token = (req.headers.authorization || '').replace('Bearer ', '') || process.env.GITHUB_FALLBACK_TOKEN || undefined;
    const user = await github.fetchPublicProfile(username, token);
    const repos = await github.fetchUserRepos(token, username);
    // Attach LinkedIn profile stub from Supabase if available
    let li: any = null;
    try {
      const supabaseUrl = process.env.SUPABASE_URL;
      const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;
      if (supabaseUrl && supabaseAnonKey) {
        const supabase = createClient(supabaseUrl, supabaseAnonKey);
        const { data } = await supabase
          .from('linkedin_profiles')
          .select('name, headline, email')
          .eq('github_login', username)
          .maybeSingle();
        li = data || null;
      }
    } catch {}

    return res.json({ user, repos, linkedin: li });
  } catch (err) {
    /* eslint-disable no-console */
    console.error(err);
    return res.status(500).json({ error: 'Failed to fetch GitHub data' });
  }
});

// GET /api/github/contacts - followers and following of authenticated user
router.get('/github/contacts', async (req, res) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) return res.status(401).json({ error: 'Missing token' });

    const headers = { Authorization: `Bearer ${token}`, 'User-Agent': 'GitLinkr' } as Record<string, string>;
    const [followersRes, followingRes] = await Promise.all([
      fetch('https://api.github.com/user/followers?per_page=100', { headers } as any),
      fetch('https://api.github.com/user/following?per_page=100', { headers } as any),
    ]);
    if (!followersRes.ok || !followingRes.ok) {
      return res.status(500).json({ error: 'GitHub contacts fetch failed' });
    }
    const followers = await followersRes.json();
    const following = await followingRes.json();
    return res.json({ followers, following });
  } catch (err) {
    console.error('contacts error', err);
    return res.status(500).json({ error: 'Failed to fetch contacts' });
  }
});

export default router;
