CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  name VARCHAR(120) NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  password VARCHAR(255) NOT NULL,
  role VARCHAR(20) NOT NULL CHECK (role IN ('customer', 'kitchen', 'admin'))
);

CREATE TABLE IF NOT EXISTS app_settings (
  key VARCHAR(120) PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS categories (
  id SERIAL PRIMARY KEY,
  name VARCHAR(120) UNIQUE NOT NULL,
  group_name VARCHAR(120) NOT NULL DEFAULT 'General',
  theme VARCHAR(40) NOT NULL DEFAULT 'default',
  display_order INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS menu_items (
  id SERIAL PRIMARY KEY,
  name VARCHAR(150) NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  price NUMERIC(10, 2) NOT NULL,
  image TEXT,
  allow_customization BOOLEAN NOT NULL DEFAULT FALSE,
  category_id INTEGER REFERENCES categories(id) ON DELETE SET NULL,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS extras (
  id SERIAL PRIMARY KEY,
  name VARCHAR(120) UNIQUE NOT NULL,
  price NUMERIC(10, 2) NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS menu_item_extras (
  id SERIAL PRIMARY KEY,
  menu_item_id INTEGER NOT NULL REFERENCES menu_items(id) ON DELETE CASCADE,
  extra_id INTEGER NOT NULL REFERENCES extras(id) ON DELETE CASCADE,
  UNIQUE(menu_item_id, extra_id)
);

CREATE TABLE IF NOT EXISTS menu_item_cafes (
  menu_item_id INTEGER NOT NULL REFERENCES menu_items(id) ON DELETE CASCADE,
  cafe_slug VARCHAR(50) NOT NULL CHECK (cafe_slug IN ('raysdiner', 'lovesgrove', 'cosmiccafe')),
  PRIMARY KEY (menu_item_id, cafe_slug)
);

CREATE TABLE IF NOT EXISTS orders (
  id SERIAL PRIMARY KEY,
  order_number VARCHAR(32),
  cafe_slug VARCHAR(50) NOT NULL DEFAULT 'raysdiner',
  customer_name VARCHAR(120) NOT NULL,
  customer_email VARCHAR(255),
  table_number VARCHAR(30),
  order_date DATE NOT NULL DEFAULT CURRENT_DATE,
  order_sequence INTEGER,
  status VARCHAR(20) NOT NULL DEFAULT 'Pending' CHECK (status IN ('Pending', 'Preparing', 'Ready', 'Completed')),
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS cafe_daily_counters (
  cafe_slug VARCHAR(50) NOT NULL,
  counter_date DATE NOT NULL,
  last_number INTEGER NOT NULL,
  PRIMARY KEY (cafe_slug, counter_date)
);

ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS cafe_slug VARCHAR(50) NOT NULL DEFAULT 'raysdiner';

ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS customer_email VARCHAR(255);

ALTER TABLE categories
  ADD COLUMN IF NOT EXISTS group_name VARCHAR(120) NOT NULL DEFAULT 'General';

ALTER TABLE categories
  ADD COLUMN IF NOT EXISTS theme VARCHAR(40) NOT NULL DEFAULT 'default';

ALTER TABLE categories
  ADD COLUMN IF NOT EXISTS display_order INTEGER NOT NULL DEFAULT 0;

ALTER TABLE menu_items
  ADD COLUMN IF NOT EXISTS allow_customization BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE orders
  DROP CONSTRAINT IF EXISTS orders_order_number_key;

ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS order_date DATE NOT NULL DEFAULT CURRENT_DATE;

ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS order_sequence INTEGER;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'orders_order_sequence_range'
      AND conrelid = 'orders'::regclass
  ) THEN
    ALTER TABLE orders
      ADD CONSTRAINT orders_order_sequence_range
      CHECK (order_sequence IS NULL OR (order_sequence >= 1 AND order_sequence <= 900));
  END IF;
END $$;

ALTER TABLE cafe_daily_counters
  DROP CONSTRAINT IF EXISTS cafe_daily_counters_last_number_check;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'cafe_daily_counters_last_number_range'
      AND conrelid = 'cafe_daily_counters'::regclass
  ) THEN
    ALTER TABLE cafe_daily_counters
      ADD CONSTRAINT cafe_daily_counters_last_number_range
      CHECK (last_number >= 0 AND last_number <= 900);
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS order_items (
  id SERIAL PRIMARY KEY,
  order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  menu_item_id INTEGER REFERENCES menu_items(id) ON DELETE SET NULL,
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  item_name VARCHAR(150) NOT NULL,
  item_price NUMERIC(10, 2) NOT NULL
);

CREATE TABLE IF NOT EXISTS order_item_extras (
  id SERIAL PRIMARY KEY,
  order_item_id INTEGER NOT NULL REFERENCES order_items(id) ON DELETE CASCADE,
  extra_id INTEGER REFERENCES extras(id) ON DELETE SET NULL,
  extra_name VARCHAR(120) NOT NULL,
  extra_price NUMERIC(10, 2) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_menu_items_category_id ON menu_items(category_id);
CREATE INDEX IF NOT EXISTS idx_order_items_order_id ON order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_cafe_slug ON orders(cafe_slug);
CREATE INDEX IF NOT EXISTS idx_orders_order_date ON orders(order_date);
CREATE UNIQUE INDEX IF NOT EXISTS idx_orders_unique_daily_sequence
  ON orders(cafe_slug, order_date, order_sequence)
  WHERE order_sequence IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_menu_item_extras_item_id ON menu_item_extras(menu_item_id);
CREATE INDEX IF NOT EXISTS idx_menu_item_extras_extra_id ON menu_item_extras(extra_id);
CREATE INDEX IF NOT EXISTS idx_menu_item_cafes_cafe_slug ON menu_item_cafes(cafe_slug);
CREATE INDEX IF NOT EXISTS idx_order_item_extras_order_item_id ON order_item_extras(order_item_id);
