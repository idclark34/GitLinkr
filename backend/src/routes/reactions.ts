import express, { Request, Response } from 'express';
import { createClient } from '@supabase/supabase-js';

const router = express.Router();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;
const supabase = supabaseUrl && supabaseAnonKey ? createClient(supabaseUrl, supabaseAnonKey) : null;

// In-memory fallback so reactions work even if the table isn't present
// Map<itemId, Map<type, Set<user>>>
const mem = new Map<string, Map<string, Set<string>>>();

type ReactionType = 'like' | 'fire' | 'sparkle';

// GET /api/reactions?ids=a,b,c -> { a: { like: 2, fire: 1 }, b: { ... } }
router.get('/reactions', async (req: Request, res: Response) => {
  const idsParam = String(req.query.ids || '').trim();
  const ids = idsParam ? idsParam.split(',') : [];
  if (ids.length === 0) return res.json({});
  // Try Supabase
  if (supabase) {
    try {
      const { data, error } = await supabase
        .from('reactions')
        .select('item_id, type, user')
        .in('item_id', ids);
      if (error) throw error;
      const out: Record<string, Record<string, number>> = {} as any;
      (data || []).forEach((r: any) => {
        out[r.item_id] = out[r.item_id] || {};
        out[r.item_id][r.type] = (out[r.item_id][r.type] || 0) + 1;
      });
      return res.json(out);
    } catch {
      // fall through to memory
    }
  }
  const out: Record<string, Record<string, number>> = {};
  ids.forEach((id) => {
    const m = mem.get(id);
    if (!m) return;
    out[id] = {} as any;
    for (const [type, users] of m.entries()) {
      out[id][type] = users.size;
    }
  });
  return res.json(out);
});

// POST /api/reactions { item_id, type, user }
router.post('/reactions', async (req: Request, res: Response) => {
  const { item_id, type, user } = req.body as { item_id?: string; type?: ReactionType; user?: string };
  if (!item_id || !type || !user) return res.status(400).json({ error: 'item_id, type, user required' });
  if (supabase) {
    try {
      const { error } = await supabase.from('reactions').upsert({ item_id, type, user }, { onConflict: 'item_id,type,user' as any });
      if (error) throw error;
      return res.status(204).end();
    } catch {
      // fall back to memory
    }
  }
  const m = mem.get(item_id) || new Map<string, Set<string>>();
  const set = m.get(type) || new Set<string>();
  set.add(user);
  m.set(type, set);
  mem.set(item_id, m);
  return res.status(204).end();
});

// DELETE /api/reactions { item_id, type, user }
router.delete('/reactions', async (req: Request, res: Response) => {
  const { item_id, type, user } = req.body as { item_id?: string; type?: ReactionType; user?: string };
  if (!item_id || !type || !user) return res.status(400).json({ error: 'item_id, type, user required' });
  if (supabase) {
    try {
      const { error } = await supabase.from('reactions').delete().match({ item_id, type, user });
      if (error) throw error;
      return res.status(204).end();
    } catch {
      // fall back to memory
    }
  }
  const m = mem.get(item_id);
  if (m) {
    const set = m.get(type);
    if (set) set.delete(user);
  }
  return res.status(204).end();
});

export default router;


