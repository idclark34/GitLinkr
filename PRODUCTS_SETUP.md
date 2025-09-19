# Supabase: Products schema setup

Run this SQL in Supabase to enable Products, metrics, and basic revenue tracking.

```sql
-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- 1) Products owned by GitHub users
CREATE TABLE IF NOT EXISTS public.products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_github_login text NOT NULL,
  name text NOT NULL,
  tagline text,
  repo_url text,
  website text,
  mrr_usd numeric(12,2), -- nullable (manual entry to start)
  visibility text NOT NULL DEFAULT 'public', -- 'public' | 'private'
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS products_owner_idx ON public.products(owner_github_login);

-- 2) Daily metrics snapshot per product
CREATE TABLE IF NOT EXISTS public.product_metrics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  date date NOT NULL,
  views int DEFAULT 0,
  stars int DEFAULT 0,
  releases int DEFAULT 0,
  npm_downloads int DEFAULT 0,
  active_users int DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(product_id, date)
);

-- 3) Subscriptions & revenue events (for future Stripe/Paddle integration)
CREATE TABLE IF NOT EXISTS public.subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  customer_id text,
  plan_interval text NOT NULL DEFAULT 'month', -- month | quarter | year
  unit_amount_cents int NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'active', -- trialing | active | canceled
  current_period_end timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.revenue_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  event_type text NOT NULL, -- new | expansion | contraction | churn
  mrr_delta_cents int NOT NULL,
  occurred_at timestamptz NOT NULL DEFAULT now()
);

-- 4) Updated-at trigger
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_products_updated_at ON public.products;
CREATE TRIGGER trg_products_updated_at
BEFORE UPDATE ON public.products
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 5) RLS (dev-friendly). Tighten for prod.
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.revenue_events ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "public read products" ON public.products FOR SELECT USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY "public insert products" ON public.products FOR INSERT WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY "public update products" ON public.products FOR UPDATE USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "public read metrics" ON public.product_metrics FOR SELECT USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY "public upsert metrics" ON public.product_metrics FOR INSERT WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "public read subs" ON public.subscriptions FOR SELECT USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY "public read rev" ON public.revenue_events FOR SELECT USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
```
