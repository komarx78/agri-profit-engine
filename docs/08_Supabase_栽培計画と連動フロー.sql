-- 1. 既存の fields (圃場マスタ) に面積カラムを追加
-- （すでに存在する場合はスキップされるようにしていますが、エラーが出ても問題ありません）
ALTER TABLE fields ADD COLUMN area_size NUMERIC;

-- 2. 栽培計画テーブル (cultivation_plans) の作成
CREATE TABLE cultivation_plans (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    field_id UUID REFERENCES fields(id) ON DELETE CASCADE,
    year INT NOT NULL, -- 対象年度 (例: 2026)
    
    -- 月別の栽培データをJSONBで管理
    -- 例: {"8": "玉ねぎ苗", "9": "カリフラワー スノークラウン"}
    plan_data JSONB DEFAULT '{}'::jsonb, 
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- RLS (Row Level Security) の設定
ALTER TABLE cultivation_plans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow anonymous read access on cultivation_plans" ON cultivation_plans FOR SELECT USING (true);
CREATE POLICY "Allow anonymous insert access on cultivation_plans" ON cultivation_plans FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow anonymous update access on cultivation_plans" ON cultivation_plans FOR UPDATE USING (true);
CREATE POLICY "Allow anonymous delete access on cultivation_plans" ON cultivation_plans FOR DELETE USING (true);
