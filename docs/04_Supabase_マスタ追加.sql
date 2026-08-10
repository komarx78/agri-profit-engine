-- 1. 資材マスタ (materials)
CREATE TABLE materials (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    unit VARCHAR(50),      -- kg, L, 袋 など
    default_price NUMERIC, -- 単価（円）
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- 2. 販売価格マスタ (sales_prices)
-- どの作目を、どの販路に、いくらで売るかの設定
CREATE TABLE sales_prices (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    crop_name VARCHAR(255) NOT NULL,    -- 簡易化のためIDではなく名前で直接紐付け
    channel_name VARCHAR(255) NOT NULL, -- 同上
    price_per_unit NUMERIC NOT NULL,    -- 単価（円）
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- 既存のテーブル構造に合わせて RLS (Row Level Security) を設定（公開アクセス）
ALTER TABLE materials ENABLE ROW LEVEL SECURITY;
ALTER TABLE sales_prices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow anonymous read access on materials" ON materials FOR SELECT USING (true);
CREATE POLICY "Allow anonymous insert access on materials" ON materials FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow anonymous update access on materials" ON materials FOR UPDATE USING (true);
CREATE POLICY "Allow anonymous delete access on materials" ON materials FOR DELETE USING (true);

CREATE POLICY "Allow anonymous read access on sales_prices" ON sales_prices FOR SELECT USING (true);
CREATE POLICY "Allow anonymous insert access on sales_prices" ON sales_prices FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow anonymous update access on sales_prices" ON sales_prices FOR UPDATE USING (true);
CREATE POLICY "Allow anonymous delete access on sales_prices" ON sales_prices FOR DELETE USING (true);
