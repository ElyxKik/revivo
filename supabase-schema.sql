-- Zecleaner Supabase Schema
-- Run this in Supabase SQL Editor

-- Profiles table (extends auth.users)
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  display_name TEXT,
  photo_url TEXT,
  is_admin BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Purchases table
CREATE TABLE IF NOT EXISTS purchases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider TEXT NOT NULL DEFAULT 'stripe',
  mode TEXT NOT NULL DEFAULT 'test',
  status TEXT NOT NULL DEFAULT 'paid',
  email TEXT NOT NULL,
  uid UUID,
  seats INTEGER NOT NULL DEFAULT 1,
  product_type TEXT NOT NULL DEFAULT 'annual',
  amount INTEGER NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'eur',
  stripe_event_id TEXT,
  stripe_customer_id TEXT,
  stripe_session_id TEXT,
  stripe_subscription_id TEXT,
  stripe_payment_intent_id TEXT,
  current_period_end TIMESTAMPTZ,
  customer_details JSONB,
  payment_method JSONB,
  provider_event_id TEXT,
  chariow_sale_id TEXT,
  chariow_product_id TEXT,
  product_name TEXT,
  invoice_url TEXT,
  email_status TEXT NOT NULL DEFAULT 'pending',
  email_provider_id TEXT,
  email_sent_at TIMESTAMPTZ,
  email_error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Licenses table
CREATE TABLE IF NOT EXISTS licenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  uid UUID,
  email TEXT NOT NULL,
  purchase_id UUID REFERENCES purchases(id) ON DELETE SET NULL,
  type TEXT NOT NULL DEFAULT 'annual',
  seat_index INTEGER NOT NULL DEFAULT 1,
  subscription_id TEXT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  valid_until TIMESTAMPTZ,
  key_encrypted TEXT NOT NULL,
  key_hash TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by_type TEXT NOT NULL DEFAULT 'stripe',
  created_by_uid UUID
);

-- Indexes
-- Safe upgrade for databases created with an earlier schema version
ALTER TABLE purchases ADD COLUMN IF NOT EXISTS provider_event_id TEXT;
ALTER TABLE purchases ADD COLUMN IF NOT EXISTS chariow_sale_id TEXT;
ALTER TABLE purchases ADD COLUMN IF NOT EXISTS chariow_product_id TEXT;
ALTER TABLE purchases ADD COLUMN IF NOT EXISTS product_name TEXT;
ALTER TABLE purchases ADD COLUMN IF NOT EXISTS invoice_url TEXT;
ALTER TABLE purchases ADD COLUMN IF NOT EXISTS email_status TEXT NOT NULL DEFAULT 'pending';
ALTER TABLE purchases ADD COLUMN IF NOT EXISTS email_provider_id TEXT;
ALTER TABLE purchases ADD COLUMN IF NOT EXISTS email_sent_at TIMESTAMPTZ;
ALTER TABLE purchases ADD COLUMN IF NOT EXISTS email_error TEXT;

CREATE INDEX IF NOT EXISTS idx_purchases_created_at ON purchases(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_purchases_email ON purchases(email);
-- A non-partial unique index is required by PostgREST upserts using
-- ON CONFLICT (chariow_sale_id). PostgreSQL still permits multiple NULL values.
DROP INDEX IF EXISTS idx_purchases_chariow_sale_id;
CREATE UNIQUE INDEX idx_purchases_chariow_sale_id ON purchases(chariow_sale_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_purchases_provider_event_id ON purchases(provider, provider_event_id) WHERE provider_event_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_licenses_created_at ON licenses(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_licenses_email ON licenses(email);
CREATE INDEX IF NOT EXISTS idx_licenses_key_hash ON licenses(key_hash);
CREATE INDEX IF NOT EXISTS idx_profiles_email ON profiles(email);

-- RLS Policies
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE purchases ENABLE ROW LEVEL SECURITY;
ALTER TABLE licenses ENABLE ROW LEVEL SECURITY;

-- Helper function to check if current user is admin (avoids RLS recursion)
CREATE OR REPLACE FUNCTION is_current_user_admin()
RETURNS BOOLEAN AS $$
  DECLARE
    admin_status BOOLEAN;
  BEGIN
    SELECT is_admin INTO admin_status FROM profiles WHERE id = auth.uid();
    RETURN COALESCE(admin_status, FALSE);
  END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Profiles: users can read their own profile, admins can read all
CREATE POLICY "Users read own profile" ON profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Admins read all profiles" ON profiles FOR SELECT USING (is_current_user_admin());

-- Purchases and Licenses: only service_role (server-side) can access
-- No client-side policies needed - all access goes through API routes

-- Trigger to auto-create profile on signup
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, display_name, photo_url)
  VALUES (
    NEW.id,
    NEW.email,
    NEW.raw_user_meta_data->>'display_name',
    NEW.raw_user_meta_data->>'avatar_url'
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();
