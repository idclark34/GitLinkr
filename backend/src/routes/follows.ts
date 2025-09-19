import express, { Request, Response } from 'express';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const router = express.Router();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;
const supabase = supabaseUrl && supabaseAnonKey ? createClient(supabaseUrl, supabaseAnonKey) : null;

// POST /api/follow { follower, target }
router.post('/follow', async (req: Request, res: Response) => {
  if (!supabase) return res.status(500).json({ error: 'Supabase not configured' });
  const { follower, target } = req.body as { follower?: string; target?: string };
  if (!follower || !target) return res.status(400).json({ error: 'follower and target are required' });
  if (follower === target) return res.status(400).json({ error: 'cannot follow self' });
  try {
    const { error } = await supabase
      .from('follows')
      .upsert({ follower_github_login: follower, target_github_login: target }, { onConflict: 'follower_github_login,target_github_login' });
    if (error) throw error;
    return res.status(201).json({ ok: true });
  } catch (err) {
    console.error('follow error', err);
    return res.status(500).json({ error: 'Failed to follow' });
  }
});

// DELETE /api/follow { follower, target }
router.delete('/follow', async (req: Request, res: Response) => {
  if (!supabase) return res.status(500).json({ error: 'Supabase not configured' });
  const { follower, target } = req.body as { follower?: string; target?: string };
  if (!follower || !target) return res.status(400).json({ error: 'follower and target are required' });
  try {
    const { error } = await supabase
      .from('follows')
      .delete()
      .eq('follower_github_login', follower)
      .eq('target_github_login', target);
    if (error) throw error;
    return res.status(204).send();
  } catch (err) {
    console.error('unfollow error', err);
    return res.status(500).json({ error: 'Failed to unfollow' });
  }
});

// GET /api/followers/:username -> list of follower logins
router.get('/followers/:username', async (req: Request, res: Response) => {
  if (!supabase) return res.json([]);
  try {
    const { data } = await supabase
      .from('follows')
      .select('follower_github_login')
      .eq('target_github_login', req.params.username);
    const list = (data || []).map((r: any) => r.follower_github_login);
    return res.json(list);
  } catch (err) {
    // If table missing (PGRST205), return empty
    return res.json([]);
  }
});

// GET /api/following/:username -> list of targets this user follows
router.get('/following/:username', async (req: Request, res: Response) => {
  if (!supabase) return res.json([]);
  try {
    const { data } = await supabase
      .from('follows')
      .select('target_github_login')
      .eq('follower_github_login', req.params.username);
    const list = (data || []).map((r: any) => r.target_github_login);
    return res.json(list);
  } catch (err) {
    return res.json([]);
  }
});

export default router;


