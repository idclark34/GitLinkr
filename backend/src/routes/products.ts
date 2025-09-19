import express, { Request, Response } from 'express';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const router = express.Router();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;
const supabase = supabaseUrl && supabaseAnonKey ? createClient(supabaseUrl, supabaseAnonKey) : null;

// POST /api/products
router.post('/products', async (req: Request, res: Response) => {
  if (!supabase) return res.status(500).json({ error: 'Supabase not configured' });
  const { owner, name, tagline, repo_url, website, mrr_usd } = req.body as any;
  if (!owner || !name) return res.status(400).json({ error: 'owner and name are required' });
  try {
    const { data, error } = await supabase
      .from('products')
      .insert({ owner_github_login: owner, name, tagline, repo_url, website, mrr_usd })
      .select('*')
      .single();
    if (error) throw error;
    return res.status(201).json(data);
  } catch (err) {
    console.error('create product error', err);
    return res.status(500).json({ error: 'Failed to create product' });
  }
});

// GET /api/products?owner=login
router.get('/products', async (req: Request, res: Response) => {
  if (!supabase) return res.status(500).json({ error: 'Supabase not configured' });
  const owner = req.query.owner as string | undefined;
  try {
    const query = supabase.from('products').select('*').order('created_at', { ascending: false });
    const { data, error } = owner ? await query.eq('owner_github_login', owner) : await query;
    if (error) throw error;
    return res.json(data || []);
  } catch (err: any) {
    console.error('list products error', err);
    if (err?.code === 'PGRST205') {
      return res.json([]);
    }
    return res.status(500).json({ error: 'Failed to list products' });
  }
});

// GET /api/products/:id
router.get('/products/:id', async (req: Request, res: Response) => {
  if (!supabase) return res.status(500).json({ error: 'Supabase not configured' });
  try {
    const { data, error } = await supabase.from('products').select('*').eq('id', req.params.id).single();
    if (error) throw error;
    return res.json(data);
  } catch (err) {
    console.error('get product error', err);
    return res.status(500).json({ error: 'Failed to fetch product' });
  }
});

// PUT /api/products/:id
router.put('/products/:id', async (req: Request, res: Response) => {
  if (!supabase) return res.status(500).json({ error: 'Supabase not configured' });
  const productId = req.params.id;

  // Only allow updating these fields
  const allowedFields: Array<'name' | 'tagline' | 'repo_url' | 'website' | 'mrr_usd'> = [
    'name',
    'tagline',
    'repo_url',
    'website',
    'mrr_usd',
  ];
  const updateFields: Record<string, unknown> = {};
  for (const key of allowedFields) {
    if (Object.prototype.hasOwnProperty.call(req.body, key)) {
      updateFields[key] = (req.body as any)[key];
    }
  }

  if (Object.keys(updateFields).length === 0) {
    return res.status(400).json({ error: 'No updatable fields provided' });
  }

  try {
    const { data, error } = await supabase
      .from('products')
      .update(updateFields)
      .eq('id', productId)
      .select('*')
      .single();
    if (error) throw error;
    return res.json(data);
  } catch (err) {
    console.error('update product error', err);
    return res.status(500).json({ error: 'Failed to update product' });
  }
});

// DELETE /api/products/:id
router.delete('/products/:id', async (req: Request, res: Response) => {
  if (!supabase) return res.status(500).json({ error: 'Supabase not configured' });
  const productId = req.params.id;
  try {
    const { error } = await supabase.from('products').delete().eq('id', productId);
    if (error) throw error;
    return res.status(204).send();
  } catch (err) {
    console.error('delete product error', err);
    return res.status(500).json({ error: 'Failed to delete product' });
  }
});

// POST /api/products/:id/revenue/manual { mrr_usd }
router.post('/products/:id/revenue/manual', async (req: Request, res: Response) => {
  if (!supabase) return res.status(500).json({ error: 'Supabase not configured' });
  const { mrr_usd } = req.body as { mrr_usd?: number };
  try {
    const { data, error } = await supabase
      .from('products')
      .update({ mrr_usd })
      .eq('id', req.params.id)
      .select('*')
      .single();
    if (error) throw error;
    return res.json(data);
  } catch (err) {
    console.error('update mrr error', err);
    return res.status(500).json({ error: 'Failed to update MRR' });
  }
});

export default router;
