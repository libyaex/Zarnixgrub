-- ==============================================================================
-- NIZAR DIGITAL — PostgreSQL / Supabase Complete Schema
-- منصة بيع المنتجات الرقمية والبرمجيات مع الدفع المصرفي بالدينار الليبي
-- ==============================================================================

-- 1. EXTENSIONS
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. ENUMS
DO $$ BEGIN
  CREATE TYPE user_role AS ENUM ('owner', 'admin', 'product_manager', 'payment_manager', 'support_manager', 'customer');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE payment_status AS ENUM ('unsubmitted', 'submitted', 'under_review', 'paid', 'rejected', 'refunded');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE order_status AS ENUM ('pending', 'processing', 'completed', 'cancelled');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE service_status AS ENUM ('not_started', 'in_progress', 'waiting_customer_info', 'completed', 'cancelled');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE discount_type AS ENUM ('fixed', 'percentage');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- 3. PROFILES
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  phone TEXT,
  role user_role NOT NULL DEFAULT 'customer',
  status TEXT NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 4. CATEGORIES
CREATE TABLE IF NOT EXISTS categories (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  description TEXT,
  image_path TEXT,
  sort_order INT NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 5. PRODUCTS
CREATE TABLE IF NOT EXISTS products (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  short_description TEXT NOT NULL,
  full_description TEXT NOT NULL,
  category_id UUID REFERENCES categories(id) ON DELETE SET NULL,
  base_price NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
  main_image TEXT NOT NULL,
  product_type TEXT NOT NULL DEFAULT 'software',
  technical_requirements JSONB NOT NULL DEFAULT '[]'::jsonb,
  installation_guide TEXT,
  features JSONB NOT NULL DEFAULT '[]'::jsonb,
  economic_study JSONB NOT NULL DEFAULT '{}'::jsonb,
  faq JSONB NOT NULL DEFAULT '[]'::jsonb,
  license_type TEXT NOT NULL DEFAULT 'commercial',
  status TEXT NOT NULL DEFAULT 'published', -- 'published', 'draft', 'archived'
  is_featured BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 6. PRODUCT IMAGES
CREATE TABLE IF NOT EXISTS product_images (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  storage_path TEXT NOT NULL,
  alt_text TEXT,
  sort_order INT NOT NULL DEFAULT 0
);

-- 7. PRODUCT PRICING OPTIONS
CREATE TABLE IF NOT EXISTS product_options (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  price NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
  option_type TEXT NOT NULL DEFAULT 'checkbox', -- 'checkbox', 'radio', 'addon', 'package'
  is_required BOOLEAN NOT NULL DEFAULT FALSE,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  sort_order INT NOT NULL DEFAULT 0
);

-- 8. OPTION RULES
CREATE TABLE IF NOT EXISTS option_rules (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  option_id UUID NOT NULL REFERENCES product_options(id) ON DELETE CASCADE,
  rule_type TEXT NOT NULL, -- 'requires', 'conflicts_with'
  related_option_id UUID NOT NULL REFERENCES product_options(id) ON DELETE CASCADE
);

-- 9. PRODUCT FILES (DIGITAL ASSETS)
CREATE TABLE IF NOT EXISTS product_files (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  storage_path TEXT NOT NULL,
  file_size BIGINT NOT NULL DEFAULT 0,
  mime_type TEXT NOT NULL DEFAULT 'application/zip',
  version TEXT NOT NULL DEFAULT '1.0.0',
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  is_downloadable BOOLEAN NOT NULL DEFAULT TRUE,
  download_count INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 10. PRODUCT VERSIONS
CREATE TABLE IF NOT EXISTS product_versions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  version_name TEXT NOT NULL,
  release_notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  is_active BOOLEAN NOT NULL DEFAULT TRUE
);

-- 11. CARTS & CART ITEMS
CREATE TABLE IF NOT EXISTS carts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS cart_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  cart_id UUID NOT NULL REFERENCES carts(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  quantity INT NOT NULL DEFAULT 1,
  selected_options JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 12. ORDERS
CREATE TABLE IF NOT EXISTS orders (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_number TEXT NOT NULL UNIQUE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  subtotal NUMERIC(12, 2) NOT NULL,
  discount_amount NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
  total_amount NUMERIC(12, 2) NOT NULL,
  currency TEXT NOT NULL DEFAULT 'LYD',
  payment_status payment_status NOT NULL DEFAULT 'unsubmitted',
  order_status order_status NOT NULL DEFAULT 'pending',
  coupon_code TEXT,
  customer_notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 13. ORDER ITEMS (WITH IMMUTABLE SNAPSHOTS)
CREATE TABLE IF NOT EXISTS order_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
  product_name_snapshot TEXT NOT NULL,
  base_price_snapshot NUMERIC(12, 2) NOT NULL,
  selected_options_snapshot JSONB NOT NULL DEFAULT '[]'::jsonb,
  total_price NUMERIC(12, 2) NOT NULL,
  quantity INT NOT NULL DEFAULT 1
);

-- 14. PAYMENT ACCOUNTS (BANK ACCOUNTS)
CREATE TABLE IF NOT EXISTS payment_accounts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  bank_name TEXT NOT NULL,
  account_holder TEXT NOT NULL,
  account_number TEXT NOT NULL,
  iban TEXT,
  instructions TEXT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  is_default BOOLEAN NOT NULL DEFAULT FALSE
);

-- 15. PAYMENT SUBMISSIONS (TRANSFER RECEIPTS & PROOF)
CREATE TABLE IF NOT EXISTS payment_submissions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  sender_name TEXT NOT NULL,
  sender_bank TEXT,
  transaction_reference TEXT NOT NULL,
  transferred_amount NUMERIC(12, 2) NOT NULL,
  transfer_date DATE NOT NULL,
  receipt_storage_path TEXT NOT NULL,
  notes TEXT,
  status payment_status NOT NULL DEFAULT 'submitted',
  reviewed_by UUID REFERENCES auth.users(id),
  reviewed_at TIMESTAMPTZ,
  rejection_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 16. DOWNLOAD ENTITLEMENTS
CREATE TABLE IF NOT EXISTS download_entitlements (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  product_file_id UUID NOT NULL REFERENCES product_files(id) ON DELETE CASCADE,
  allowed_downloads INT NOT NULL DEFAULT 3,
  used_downloads INT NOT NULL DEFAULT 0,
  expires_at TIMESTAMPTZ,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 17. DOWNLOAD LOGS
CREATE TABLE IF NOT EXISTS download_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  entitlement_id UUID NOT NULL REFERENCES download_entitlements(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  file_id UUID NOT NULL REFERENCES product_files(id) ON DELETE CASCADE,
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ip_address TEXT,
  user_agent TEXT,
  status TEXT NOT NULL DEFAULT 'success'
);

-- 18. SERVICE TASKS (INSTALLATION, CUSTOMIZATION, TECH SUPPORT)
CREATE TABLE IF NOT EXISTS service_tasks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  service_name TEXT NOT NULL,
  status service_status NOT NULL DEFAULT 'not_started',
  details TEXT,
  admin_notes TEXT,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 19. NOTIFICATIONS
CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'info', -- 'order', 'payment', 'download', 'service', 'info'
  is_read BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 20. COUPONS
CREATE TABLE IF NOT EXISTS coupons (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  code TEXT NOT NULL UNIQUE,
  discount_type discount_type NOT NULL DEFAULT 'percentage',
  discount_value NUMERIC(12, 2) NOT NULL,
  minimum_order NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
  max_uses INT NOT NULL DEFAULT 100,
  used_count INT NOT NULL DEFAULT 0,
  starts_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ,
  is_active BOOLEAN NOT NULL DEFAULT TRUE
);

-- 21. AUDIT LOGS
CREATE TABLE IF NOT EXISTS audit_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  admin_id UUID NOT NULL REFERENCES auth.users(id),
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  details JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 22. SITE SETTINGS
CREATE TABLE IF NOT EXISTS site_settings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  setting_key TEXT NOT NULL UNIQUE,
  setting_value JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ==============================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ==============================================================================

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_images ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_options ENABLE ROW LEVEL SECURITY;
ALTER TABLE option_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_files ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE carts ENABLE ROW LEVEL SECURITY;
ALTER TABLE cart_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE download_entitlements ENABLE ROW LEVEL SECURITY;
ALTER TABLE download_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE service_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE coupons ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE site_settings ENABLE ROW LEVEL SECURITY;

-- Helper function: is_admin
CREATE OR REPLACE FUNCTION is_admin(user_uid UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM profiles
    WHERE id = user_uid
    AND role IN ('owner', 'admin', 'product_manager', 'payment_manager', 'support_manager')
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Helper function: has_role
CREATE OR REPLACE FUNCTION has_role(user_uid UUID, required_roles user_role[])
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM profiles
    WHERE id = user_uid
    AND role = ANY(required_roles)
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 1. Profiles RLS
CREATE POLICY "Users can read own profile or admin can read all"
  ON profiles FOR SELECT
  USING (auth.uid() = id OR is_admin(auth.uid()));

CREATE POLICY "Users can update own name/phone"
  ON profiles FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id AND role = (SELECT role FROM profiles WHERE id = auth.uid()));

CREATE POLICY "Admins can update all profiles"
  ON profiles FOR UPDATE
  USING (is_admin(auth.uid()));

-- 2. Public Catalog RLS (Categories, Products, Options)
CREATE POLICY "Anyone can view active categories"
  ON categories FOR SELECT
  USING (is_active = TRUE OR is_admin(auth.uid()));

CREATE POLICY "Admins can manage categories"
  ON categories FOR ALL
  USING (has_role(auth.uid(), ARRAY['owner', 'admin', 'product_manager']::user_role[]));

CREATE POLICY "Anyone can view published products"
  ON products FOR SELECT
  USING (status = 'published' OR is_admin(auth.uid()));

CREATE POLICY "Product managers can manage products"
  ON products FOR ALL
  USING (has_role(auth.uid(), ARRAY['owner', 'admin', 'product_manager']::user_role[]));

CREATE POLICY "Anyone can view active product options"
  ON product_options FOR SELECT
  USING (is_active = TRUE OR is_admin(auth.uid()));

CREATE POLICY "Product managers can manage product options"
  ON product_options FOR ALL
  USING (has_role(auth.uid(), ARRAY['owner', 'admin', 'product_manager']::user_role[]));

CREATE POLICY "Anyone can view option rules"
  ON option_rules FOR SELECT USING (TRUE);

-- 3. Product Files (NEVER PUBLIC!)
CREATE POLICY "Admins can manage product files"
  ON product_files FOR ALL
  USING (has_role(auth.uid(), ARRAY['owner', 'admin', 'product_manager']::user_role[]));

CREATE POLICY "Users cannot directly select private files"
  ON product_files FOR SELECT
  USING (is_admin(auth.uid()));

-- 4. Orders & Items RLS
CREATE POLICY "Users can view own orders, admins can view all"
  ON orders FOR SELECT
  USING (auth.uid() = user_id OR is_admin(auth.uid()));

CREATE POLICY "Users can insert own orders"
  ON orders FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Only authorized payment admins or owner can update order status"
  ON orders FOR UPDATE
  USING (has_role(auth.uid(), ARRAY['owner', 'admin', 'payment_manager']::user_role[]));

CREATE POLICY "Users can view own order items"
  ON order_items FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM orders
      WHERE orders.id = order_items.order_id
      AND (orders.user_id = auth.uid() OR is_admin(auth.uid()))
    )
  );

-- 5. Payment Accounts
CREATE POLICY "Anyone can view active bank accounts"
  ON payment_accounts FOR SELECT
  USING (is_active = TRUE OR is_admin(auth.uid()));

CREATE POLICY "Owner and Admin can manage bank accounts"
  ON payment_accounts FOR ALL
  USING (has_role(auth.uid(), ARRAY['owner', 'admin']::user_role[]));

-- 6. Payment Submissions
CREATE POLICY "Users can view own payment submissions, admins can view all"
  ON payment_submissions FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM orders
      WHERE orders.id = payment_submissions.order_id
      AND (orders.user_id = auth.uid() OR is_admin(auth.uid()))
    )
  );

CREATE POLICY "Users can submit payment proof for own order"
  ON payment_submissions FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM orders
      WHERE orders.id = payment_submissions.order_id
      AND orders.user_id = auth.uid()
    )
  );

CREATE POLICY "Payment managers can review submissions"
  ON payment_submissions FOR UPDATE
  USING (has_role(auth.uid(), ARRAY['owner', 'admin', 'payment_manager']::user_role[]));

-- 7. Download Entitlements
CREATE POLICY "Users can view own entitlements"
  ON download_entitlements FOR SELECT
  USING (auth.uid() = user_id OR is_admin(auth.uid()));

CREATE POLICY "Admins can manage entitlements"
  ON download_entitlements FOR ALL
  USING (has_role(auth.uid(), ARRAY['owner', 'admin']::user_role[]));

-- 8. Service Tasks
CREATE POLICY "Users can view own services"
  ON service_tasks FOR SELECT
  USING (auth.uid() = user_id OR is_admin(auth.uid()));

CREATE POLICY "Support managers can update services"
  ON service_tasks FOR ALL
  USING (has_role(auth.uid(), ARRAY['owner', 'admin', 'support_manager']::user_role[]));

-- 9. Notifications
CREATE POLICY "Users can manage own notifications"
  ON notifications FOR ALL
  USING (auth.uid() = user_id);

-- 10. Audit Logs & Settings
CREATE POLICY "Admins can view audit logs"
  ON audit_logs FOR SELECT
  USING (has_role(auth.uid(), ARRAY['owner', 'admin']::user_role[]));

CREATE POLICY "Site settings public read for general keys"
  ON site_settings FOR SELECT USING (TRUE);

CREATE POLICY "Only Owner and Admin can modify site settings"
  ON site_settings FOR ALL
  USING (has_role(auth.uid(), ARRAY['owner', 'admin']::user_role[]));

-- ==============================================================================
-- STORAGE BUCKETS (Private by default for digital assets & receipts)
-- ==============================================================================
INSERT INTO storage.buckets (id, name, public)
VALUES 
  ('project_files', 'project_files', FALSE),
  ('payment_receipts', 'payment_receipts', FALSE),
  ('system_assets', 'system_assets', TRUE)
ON CONFLICT (id) DO NOTHING;
