# GitLinkr Connections Setup Guide

## 📋 Step 1: Create Database Table in Supabase

Copy and paste this SQL in your **Supabase SQL Editor**:

```sql
-- Connection system tables for GitLinkr
CREATE TABLE IF NOT EXISTS connections (
  id SERIAL PRIMARY KEY,
  requester_github_login VARCHAR(255) NOT NULL,
  recipient_github_login VARCHAR(255) NOT NULL,
  status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'declined')),
  message TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  
  -- Prevent duplicate connection requests
  UNIQUE(requester_github_login, recipient_github_login)
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_connections_requester ON connections(requester_github_login);
CREATE INDEX IF NOT EXISTS idx_connections_recipient ON connections(recipient_github_login);
CREATE INDEX IF NOT EXISTS idx_connections_status ON connections(status);

-- For MVP: Disable RLS to keep it simple
ALTER TABLE connections DISABLE ROW LEVEL SECURITY;

-- Grant permissions
GRANT ALL ON connections TO anon, authenticated;
GRANT USAGE ON SEQUENCE connections_id_seq TO anon, authenticated;
```

## 🔧 Step 2: Add Environment Variables

Add these to your `backend/.env` file:

```
SUPABASE_URL=your_supabase_project_url
SUPABASE_ANON_KEY=your_supabase_anon_key
```

You can find these in your Supabase project settings under "API" section.

## 🚀 Step 3: Backend API Endpoints

The connections system provides these endpoints:

- `GET /api/connections/:username` - Get all connections for a user
- `POST /api/connections` - Send a connection request
- `PUT /api/connections/:id` - Accept/decline a connection request  
- `GET /api/connections/:username/pending` - Get pending requests for a user

## ✅ Status

- ✅ Backend routes created
- ✅ Supabase package installed
- ✅ TypeScript types fixed
- ✅ Backend starts without errors
- ⏳ Database table needs to be created
- ⏳ Environment variables need to be added

## 🎯 Next Steps

1. Run the SQL in Supabase
2. Add environment variables
3. Build frontend connection components
4. Test the full connection flow
