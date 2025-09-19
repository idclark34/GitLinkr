import express, { Request, Response } from 'express';
import { createClient } from '@supabase/supabase-js';

const router = express.Router();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;
const supabase = supabaseUrl && supabaseAnonKey ? createClient(supabaseUrl, supabaseAnonKey) : null;

// In-memory fallback: Map<user, Set<repo_full_name>>
const mem = new Map<string, Set<string>>();

// GET /api/repo-follows/:username
router.get('/repo-follows/:username', async (req: Request, res: Response) => {
  const { username } = req.params;
  if (supabase) {
    try {
      const { data, error } = await supabase
        .from('repo_follows')
        .select('repo_full_name')
        .eq('follower_github_login', username);
      if (error) throw error;
      return res.json((data || []).map((r: any) => r.repo_full_name));
    } catch {
      // fall back
    }
  }
  return res.json(Array.from(mem.get(username) || []));
});

// POST /api/repo-follows { user, repo }
router.post('/repo-follows', async (req: Request, res: Response) => {
  const { user, repo } = req.body as { user?: string; repo?: string };
  if (!user || !repo) return res.status(400).json({ error: 'user and repo required' });
  if (supabase) {
    try {
      const { error } = await supabase.from('repo_follows').upsert({ follower_github_login: user, repo_full_name: repo }, { onConflict: 'follower_github_login,repo_full_name' as any });
      if (error) throw error;
      return res.status(204).end();
    } catch {
      // fall back
    }
  }
  const set = mem.get(user) || new Set<string>();
  set.add(repo);
  mem.set(user, set);
  return res.status(204).end();
});

// DELETE /api/repo-follows { user, repo }
router.delete('/repo-follows', async (req: Request, res: Response) => {
  const { user, repo } = req.body as { user?: string; repo?: string };
  if (!user || !repo) return res.status(400).json({ error: 'user and repo required' });
  if (supabase) {
    try {
      const { error } = await supabase.from('repo_follows').delete().match({ follower_github_login: user, repo_full_name: repo });
      if (error) throw error;
      return res.status(204).end();
    } catch {
      // fall back
    }
  }
  const set = mem.get(user);
  if (set) set.delete(repo);
  return res.status(204).end();
});

export default router;


