# Supabase: Invitations table setup

Run this SQL in your Supabase project (SQL Editor) to create the invitations table used by GitLinkr.

```sql
-- 1) Optional enum for status
DO $$ BEGIN
  CREATE TYPE public.invitation_status AS ENUM ('sent', 'accepted', 'declined', 'expired');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 2) Table
CREATE TABLE IF NOT EXISTS public.invitations (
  id uuid PRIMARY KEY,
  code text NOT NULL UNIQUE,
  inviter_github_login text NOT NULL,
  invitee_email text NULL,
  invitee_github_login text NULL,
  status public.invitation_status NOT NULL DEFAULT 'sent',
  created_at timestamptz NOT NULL DEFAULT now(),
  accepted_at timestamptz NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT invitations_invitee_presence_chk CHECK (
    invitee_email IS NOT NULL OR invitee_github_login IS NOT NULL
  )
);

-- 3) Helpful indexes
CREATE INDEX IF NOT EXISTS invitations_inviter_idx ON public.invitations (inviter_github_login);
CREATE INDEX IF NOT EXISTS invitations_status_idx ON public.invitations (status);

-- 4) Updated-at trigger
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_invitations_updated_at ON public.invitations;
CREATE TRIGGER trg_invitations_updated_at
BEFORE UPDATE ON public.invitations
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 5) Row Level Security (dev-friendly policy)
ALTER TABLE public.invitations ENABLE ROW LEVEL SECURITY;

-- Allow public read/write in development. Remove or tighten for prod.
DO $$ BEGIN
  CREATE POLICY "public read" ON public.invitations
  FOR SELECT USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "public insert" ON public.invitations
  FOR INSERT WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "public update" ON public.invitations
  FOR UPDATE USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
```

Notes
- Dev policy above allows the anon key to read/insert/update. For production, replace with stricter policies.
- Backend invitation links default to `http://localhost:5173`. To customize, set `FRONTEND_URL` in `backend/.env`.
