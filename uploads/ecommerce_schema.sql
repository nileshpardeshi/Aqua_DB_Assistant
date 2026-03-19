-- ============================================================
-- E-Commerce Platform Schema (PostgreSQL)
-- Tables: customers, categories, products, orders, order_items
-- ============================================================

BEGIN;

-- ── Extensions ──
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ── Customers ──
CREATE TABLE customers (
    customer_id   UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    first_name    VARCHAR(60) NOT NULL,
    last_name     VARCHAR(60) NOT NULL,
    email         VARCHAR(255) NOT NULL UNIQUE,
    phone         VARCHAR(20),
    password_hash TEXT NOT NULL,
    is_active     BOOLEAN DEFAULT TRUE,
    loyalty_tier  VARCHAR(20) DEFAULT 'bronze' CHECK (loyalty_tier IN ('bronze', 'silver', 'gold', 'platinum')),
    created_at    TIMESTAMPTZ DEFAULT NOW(),
    updated_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_customers_email ON customers (email);
CREATE INDEX idx_customers_loyalty ON customers (loyalty_tier);

-- ── Categories ──
CREATE TABLE categories (
    category_id   SERIAL PRIMARY KEY,
    name          VARCHAR(100) NOT NULL,
    slug          VARCHAR(120) NOT NULL UNIQUE,
    description   TEXT,
    parent_id     INTEGER REFERENCES categories(category_id) ON DELETE SET NULL,
    sort_order    SMALLINT DEFAULT 0,
    is_visible    BOOLEAN DEFAULT TRUE,
    created_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_categories_parent ON categories (parent_id);
CREATE INDEX idx_categories_slug ON categories (slug);

-- ── Products ──
CREATE TABLE products (
    product_id    SERIAL PRIMARY KEY,
    sku           VARCHAR(50) NOT NULL UNIQUE,
    name          VARCHAR(200) NOT NULL,
    description   TEXT,
    category_id   INTEGER NOT NULL REFERENCES categories(category_id) ON DELETE RESTRICT,
    price         NUMERIC(12,2) NOT NULL CHECK (price >= 0),
    cost_price    NUMERIC(12,2) CHECK (cost_price >= 0),
    stock_qty     INTEGER NOT NULL DEFAULT 0 CHECK (stock_qty >= 0),
    weight_kg     NUMERIC(8,3),
    is_active     BOOLEAN DEFAULT TRUE,
    tags          TEXT[],
    metadata      JSONB DEFAULT '{}',
    created_at    TIMESTAMPTZ DEFAULT NOW(),
    updated_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_products_category ON products (category_id);
CREATE INDEX idx_products_sku ON products (sku);
CREATE INDEX idx_products_tags ON products USING GIN (tags);
CREATE INDEX idx_products_metadata ON products USING GIN (metadata jsonb_path_ops);

-- ── Orders ──
CREATE TABLE orders (
    order_id        UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    customer_id     UUID NOT NULL REFERENCES customers(customer_id) ON DELETE CASCADE,
    order_number    VARCHAR(30) NOT NULL UNIQUE,
    status          VARCHAR(20) NOT NULL DEFAULT 'pending'
                      CHECK (status IN ('pending','confirmed','shipped','delivered','cancelled','refunded')),
    subtotal        NUMERIC(14,2) NOT NULL DEFAULT 0,
    tax_amount      NUMERIC(14,2) NOT NULL DEFAULT 0,
    shipping_cost   NUMERIC(10,2) NOT NULL DEFAULT 0,
    total_amount    NUMERIC(14,2) GENERATED ALWAYS AS (subtotal + tax_amount + shipping_cost) STORED,
    currency        CHAR(3) DEFAULT 'USD',
    shipping_address JSONB,
    notes           TEXT,
    ordered_at      TIMESTAMPTZ DEFAULT NOW(),
    shipped_at      TIMESTAMPTZ,
    delivered_at    TIMESTAMPTZ
);

CREATE INDEX idx_orders_customer ON orders (customer_id);
CREATE INDEX idx_orders_status ON orders (status);
CREATE INDEX idx_orders_date ON orders (ordered_at DESC);

-- ── Order Items ──
CREATE TABLE order_items (
    item_id       BIGSERIAL PRIMARY KEY,
    order_id      UUID NOT NULL REFERENCES orders(order_id) ON DELETE CASCADE,
    product_id    INTEGER NOT NULL REFERENCES products(product_id) ON DELETE RESTRICT,
    quantity      INTEGER NOT NULL CHECK (quantity > 0),
    unit_price    NUMERIC(12,2) NOT NULL,
    discount_pct  NUMERIC(5,2) DEFAULT 0 CHECK (discount_pct BETWEEN 0 AND 100),
    line_total    NUMERIC(14,2) GENERATED ALWAYS AS (quantity * unit_price * (1 - discount_pct / 100)) STORED
);

CREATE INDEX idx_order_items_order ON order_items (order_id);
CREATE INDEX idx_order_items_product ON order_items (product_id);

-- ── Views ──
CREATE OR REPLACE VIEW v_order_summary AS
SELECT
    o.order_id,
    o.order_number,
    c.first_name || ' ' || c.last_name AS customer_name,
    c.email,
    o.status,
    o.total_amount,
    o.currency,
    COUNT(oi.item_id) AS item_count,
    o.ordered_at
FROM orders o
JOIN customers c ON c.customer_id = o.customer_id
LEFT JOIN order_items oi ON oi.order_id = o.order_id
GROUP BY o.order_id, o.order_number, c.first_name, c.last_name, c.email,
         o.status, o.total_amount, o.currency, o.ordered_at;

-- ── Functions ──
CREATE OR REPLACE FUNCTION update_modified_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_customers_updated
    BEFORE UPDATE ON customers
    FOR EACH ROW EXECUTE FUNCTION update_modified_column();

CREATE TRIGGER trg_products_updated
    BEFORE UPDATE ON products
    FOR EACH ROW EXECUTE FUNCTION update_modified_column();

COMMIT;
