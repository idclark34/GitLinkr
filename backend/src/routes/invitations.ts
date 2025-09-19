import express, { Request, Response } from 'express';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import crypto from 'crypto';

dotenv.config();

const router = express.Router();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn('⚠️  Supabase credentials missing. Invitations API will not work until SUPABASE_URL and SUPABASE_ANON_KEY are set.');
}

const supabase = supabaseUrl && supabaseAnonKey ? createClient(supabaseUrl, supabaseAnonKey) : null;

const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173';

// GET /api/invitations/mine?inviter=<github_login>
router.get('/invitations/mine', async (req: Request, res: Response) => {
  const inviter = (req.query.inviter as string) || '';
  if (!supabase) return res.status(500).json({ error: 'Supabase not configured' });
  if (!inviter) return res.status(400).json({ error: 'inviter query required' });

  try {
    const { data, error } = await supabase
      .from('invitations')
      .select('*')
      .eq('inviter_github_login', inviter)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return res.json(data || []);
  } catch (err) {
    console.error('Error listing invitations:', err);
    return res.status(500).json({ error: 'Failed to list invitations' });
  }
});

// POST /api/invitations/create
// body: { inviter: string; emails?: string[]; githubUsernames?: string[] }
router.post('/invitations/create', async (req: Request, res: Response) => {
  if (!supabase) return res.status(500).json({ error: 'Supabase not configured' });
  const { inviter, emails = [], githubUsernames = [] } = req.body as {
    inviter: string;
    emails?: string[];
    githubUsernames?: string[];
  };
  if (!inviter) return res.status(400).json({ error: 'inviter is required' });

  try {
    const rows = [...emails.map((e: string) => ({ invitee_email: e.trim() })), ...githubUsernames.map((g: string) => ({ invitee_github_login: g.trim() }))]
      .filter((r) => (r.invitee_email && r.invitee_email.length) || (r.invitee_github_login && r.invitee_github_login.length))
      .map((r) => ({
        id: crypto.randomUUID(),
        code: crypto.randomUUID(),
        inviter_github_login: inviter,
        invitee_email: (r as any).invitee_email || null,
        invitee_github_login: (r as any).invitee_github_login || null,
        status: 'sent',
      }));

    if (rows.length === 0) return res.json([]);

    const { data, error } = await supabase.from('invitations').insert(rows).select('*');
    if (error) throw error;

    const withLinks = (data || []).map((d: any) => ({
      ...d,
      link: `${FRONTEND_URL}/login?invite=${encodeURIComponent(d.code)}`,
    }));

    return res.status(201).json(withLinks);
  } catch (err) {
    console.error('Error creating invitations:', err);
    return res.status(500).json({ error: 'Failed to create invitations' });
  }
});

export default router;
// Accept invitation
// POST /api/invitations/accept { code: string, acceptor: string }
router.post('/invitations/accept', async (req: Request, res: Response) => {
  if (!supabase) return res.status(500).json({ error: 'Supabase not configured' });
  const { code, acceptor } = req.body as { code: string; acceptor?: string };
  if (!code) return res.status(400).json({ error: 'code is required' });

  try {
    const { data, error } = await supabase
      .from('invitations')
      .update({ status: 'accepted', accepted_at: new Date().toISOString() })
      .eq('code', code)
      .select('*')
      .single();
    if (error) throw error;
    return res.json({ ok: true, invitation: data, acceptor });
  } catch (err) {
    console.error('Error accepting invitation:', err);
    return res.status(500).json({ error: 'Failed to accept invitation' });
  }
});
