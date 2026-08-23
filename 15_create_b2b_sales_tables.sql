-- ==============================================================================
-- 農業経営・採算性可視化SaaS (Agri-Profit Engine) 
-- B2B販売管理システム（受注・納品・請求）用 テーブル追加スクリプト
-- ==============================================================================

-- 1. 顧客マスタ (b2b_customers)
CREATE TABLE IF NOT EXISTS b2b_customers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    farm_id UUID REFERENCES farms(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,                 -- 取引先名（例: レストランA, スーパーB, JA）
    type VARCHAR(100),                          -- 取引タイプ（卸売, 直販, 市場など）
    contact_info TEXT,                          -- 連絡先（電話番号、メールアドレス、担当者など）
    closing_day INTEGER DEFAULT 31,             -- 締め日 (1〜28, 31=月末)
    payment_month INTEGER DEFAULT 1,            -- 支払月 (0=当月, 1=翌月, 2=翌々月)
    payment_day INTEGER DEFAULT 31,             -- 支払日 (1〜28, 31=月末)
    order_token VARCHAR(100) UNIQUE,            -- 先方専用のパスワードレス発注URL用トークン
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 2. 受注・納品データ (b2b_orders)
CREATE TABLE IF NOT EXISTS b2b_orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    farm_id UUID REFERENCES farms(id) ON DELETE CASCADE,
    customer_id UUID REFERENCES b2b_customers(id) ON DELETE CASCADE,
    order_date DATE NOT NULL DEFAULT CURRENT_DATE,    -- 受注日（注文が入った日）
    delivery_date DATE NOT NULL,                      -- 納品予定日・配達日
    status VARCHAR(50) DEFAULT 'pending',             -- ステータス (pending=未納品, delivered=納品済, invoiced=請求済, cancelled=キャンセル)
    total_amount NUMERIC(12, 2) DEFAULT 0,            -- 注文の合計金額 (税込または税抜のルールに依存)
    memo TEXT,                                        -- 備考
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 3. 注文明細 (b2b_order_items)
CREATE TABLE IF NOT EXISTS b2b_order_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID REFERENCES b2b_orders(id) ON DELETE CASCADE,
    crop_id UUID REFERENCES crops(id) ON DELETE SET NULL,
    quantity NUMERIC(10, 2) NOT NULL,
    unit VARCHAR(50) DEFAULT 'kg',
    unit_price NUMERIC(10, 2) DEFAULT 0,
    total_price NUMERIC(12, 2) DEFAULT 0,             -- quantity * unit_price
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 4. 請求書データ (b2b_invoices)
CREATE TABLE IF NOT EXISTS b2b_invoices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    farm_id UUID REFERENCES farms(id) ON DELETE CASCADE,
    customer_id UUID REFERENCES b2b_customers(id) ON DELETE CASCADE,
    target_month VARCHAR(7) NOT NULL,                 -- 請求対象月 (例: '2026-08')
    total_amount NUMERIC(12, 2) NOT NULL,             -- 請求合計金額
    issue_date DATE NOT NULL,                         -- 発行日
    due_date DATE NOT NULL,                           -- 支払期限日
    status VARCHAR(50) DEFAULT 'unpaid',              -- ステータス (unpaid=未入金, paid=入金済)
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- (オプション) 既存の sales_channels から B2B顧客へ移行するための簡易スクリプト
-- ※運用開始前のプロトタイプであれば、以下のINSERTで移行可能です。
INSERT INTO b2b_customers (farm_id, name, type)
SELECT farm_id, name, type FROM sales_channels
ON CONFLICT DO NOTHING;
