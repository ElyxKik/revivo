ALTER TABLE purchases ADD COLUMN IF NOT EXISTS provider_event_id TEXT;
ALTER TABLE purchases ADD COLUMN IF NOT EXISTS chariow_sale_id TEXT;
ALTER TABLE purchases ADD COLUMN IF NOT EXISTS chariow_product_id TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_purchases_chariow_sale_id
  ON purchases(chariow_sale_id)
  WHERE chariow_sale_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_purchases_provider_event_id
  ON purchases(provider, provider_event_id)
  WHERE provider_event_id IS NOT NULL;
