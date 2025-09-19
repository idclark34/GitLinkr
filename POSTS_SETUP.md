# Supabase: Posts table setup

Run this SQL in Supabase to enable developer posts tied to artifacts.

```sql
-- 1) Table for posts (updates, stories)
CREATE TABLE IF NOT EXISTS public.posts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  author_github_login text NOT NULL,
  title text NOT NULL,
  body text,
  artifacts jsonb DEFAULT '[]'::jsonb, -- e.g., [{ type: 'pr', url: '...'}, {type:'issue', url:'...'}]
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS posts_author_idx ON public.posts (author_github_login, created_at DESC);

-- 2) Follows to power feeds
CREATE TABLE IF NOT EXISTS public.follows (
  follower_github_login text NOT NULL,
  target_github_login text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (follower_github_login, target_github_login)
);

-- 3) RLS (dev-friendly)
ALTER TABLE public.posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.follows ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "public read posts" ON public.posts FOR SELECT USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY "public insert posts" ON public.posts FOR INSERT WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "public read follows" ON public.follows FOR SELECT USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY "public insert follows" ON public.follows FOR INSERT WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
```
