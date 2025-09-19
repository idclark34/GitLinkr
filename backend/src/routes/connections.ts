import express, { Request, Response } from 'express';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const router = express.Router();

// Initialize Supabase client with fallback for missing env vars
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn('⚠️  Supabase credentials missing. Connections API will not work until SUPABASE_URL and SUPABASE_ANON_KEY are added to .env');
}

const supabase = supabaseUrl && supabaseAnonKey 
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null;

// GET /api/connections/:username - Get all connections for a user
router.get('/connections/:username', async (req: Request, res: Response) => {
  const { username } = req.params;
  
  if (!supabase) {
    return res.status(500).json({ error: 'Supabase not configured. Please add SUPABASE_URL and SUPABASE_ANON_KEY to .env' });
  }
  
  try {
    // Get connections where user is either requester or recipient
    const { data, error } = await supabase
      .from('connections')
      .select('*')
      .or(`requester_github_login.eq.${username},recipient_github_login.eq.${username}`)
      .order('created_at', { ascending: false });

    if (error) throw error;
    
    return res.json(data || []);
  } catch (error) {
    console.error('Error fetching connections:', error);
    return res.status(500).json({ error: 'Failed to fetch connections' });
  }
});

// POST /api/connections - Send a connection request
router.post('/connections', async (req: Request, res: Response) => {
  const { requester, recipient, message } = req.body;
  
  if (!supabase) {
    return res.status(500).json({ error: 'Supabase not configured. Please add SUPABASE_URL and SUPABASE_ANON_KEY to .env' });
  }
  
  if (!requester || !recipient) {
    return res.status(400).json({ error: 'Requester and recipient are required' });
  }
  
  if (requester === recipient) {
    return res.status(400).json({ error: 'Cannot send connection request to yourself' });
  }
  
  try {
    // Check if connection already exists
    const { data: existing } = await supabase
      .from('connections')
      .select('*')
      .or(`and(requester_github_login.eq.${requester},recipient_github_login.eq.${recipient}),and(requester_github_login.eq.${recipient},recipient_github_login.eq.${requester})`)
      .single();
    
    if (existing) {
      return res.status(400).json({ error: 'Connection request already exists' });
    }
    
    // Create new connection request
    const { data, error } = await supabase
      .from('connections')
      .insert({
        requester_github_login: requester,
        recipient_github_login: recipient,
        message: message || null,
        status: 'pending'
      })
      .select()
      .single();
    
    if (error) throw error;
    
    return res.status(201).json(data);
  } catch (error) {
    console.error('Error creating connection:', error);
    return res.status(500).json({ error: 'Failed to send connection request' });
  }
});

// PUT /api/connections/:id - Accept or decline a connection request
router.put('/connections/:id', async (req: Request, res: Response) => {
  const { id } = req.params;
  const { status, username } = req.body;
  
  if (!supabase) {
    return res.status(500).json({ error: 'Supabase not configured. Please add SUPABASE_URL and SUPABASE_ANON_KEY to .env' });
  }
  
  if (!['accepted', 'declined'].includes(status)) {
    return res.status(400).json({ error: 'Status must be "accepted" or "declined"' });
  }
  
  try {
    // First, verify the user is the recipient of this connection
    const { data: connection, error: fetchError } = await supabase
      .from('connections')
      .select('*')
      .eq('id', id)
      .eq('recipient_github_login', username)
      .single();
    
    if (fetchError || !connection) {
      return res.status(404).json({ error: 'Connection request not found or not authorized' });
    }
    
    // Update the connection status
    const { data, error } = await supabase
      .from('connections')
      .update({ status })
      .eq('id', id)
      .select()
      .single();
    
    if (error) throw error;
    
    return res.json(data);
  } catch (error) {
    console.error('Error updating connection:', error);
    return res.status(500).json({ error: 'Failed to update connection' });
  }
});

// GET /api/connections/:username/pending - Get pending connection requests for a user
router.get('/connections/:username/pending', async (req: Request, res: Response) => {
  const { username } = req.params;
  
  if (!supabase) {
    return res.status(500).json({ error: 'Supabase not configured. Please add SUPABASE_URL and SUPABASE_ANON_KEY to .env' });
  }
  
  try {
    const { data, error } = await supabase
      .from('connections')
      .select('*')
      .eq('recipient_github_login', username)
      .eq('status', 'pending')
      .order('created_at', { ascending: false });

    if (error) throw error;
    
    return res.json(data || []);
  } catch (error) {
    console.error('Error fetching pending connections:', error);
    return res.status(500).json({ error: 'Failed to fetch pending connections' });
  }
});

export default router;
