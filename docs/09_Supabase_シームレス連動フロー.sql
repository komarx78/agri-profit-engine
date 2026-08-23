-- 1. 作目の10aあたり基準マスタ (crop_standards)
-- ※crops テーブルを拡張しても良いですが、将来的に複数パターンの基準を持たせる可能性を考慮し別テーブルとします。
CREATE TABLE crop_standards (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    crop_id UUID REFERENCES crops(id) ON DELETE CASCADE,
    variety VARCHAR(255), -- 品種（任意。品種ごとに基準が違う場合）
    seedlings_per_10a NUMERIC, -- 10aあたりの必要苗数（本/株）
    -- 資材の基準は別テーブルまたはJSONB。今回はJSONBで簡略化して持たせます
    -- 例: [{"material_id": "uuid", "amount_per_10a": 20}]
    materials_per_10a JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
    UNIQUE(crop_id, variety)
);

-- 2. 栽培計画テーブルの再設計 (cultivation_plans_v2)
-- 以前のJSONBカレンダーから、リレーショナルな形へ変更します。
-- 「F号棟で、カリフラワーを、8月から11月まで栽培する」という1つのレコード。
CREATE TABLE cultivation_plans_v2 (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    field_id UUID REFERENCES fields(id) ON DELETE CASCADE,
    crop_id UUID REFERENCES crops(id),
    variety VARCHAR(255),
    year INT NOT NULL, -- 計画年度 (例: 2026)
    start_month INT NOT NULL, -- 開始月 (1〜12)
    end_month INT NOT NULL,   -- 終了月 (1〜12)
    
    -- 自動計算された結果を保存しておく（スナップショット）
    calculated_area NUMERIC, -- 計算時点での圃場面積(a)
    calculated_seedlings NUMERIC, -- 必要苗数 (area_size / 10 * seedlings_per_10a)
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- 3. 育苗スケジュール (nursery_schedules_v2)
-- 栽培計画 (cultivation_plans_v2) に紐づく育苗スケジュール
CREATE TABLE nursery_schedules_v2 (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    plan_id UUID REFERENCES cultivation_plans_v2(id) ON DELETE CASCADE,
    -- 計画から自動計算された必要苗数に対して、実際の播種量やスケジュールを管理
    sown_quantity NUMERIC,
    schedule_data JSONB DEFAULT '{}'::jsonb, -- 日付ごとの予定（播種日、定植日など）
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);


-- RLS設定
ALTER TABLE crop_standards ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow anonymous read access on crop_standards" ON crop_standards FOR SELECT USING (true);
CREATE POLICY "Allow anonymous insert access on crop_standards" ON crop_standards FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow anonymous update access on crop_standards" ON crop_standards FOR UPDATE USING (true);
CREATE POLICY "Allow anonymous delete access on crop_standards" ON crop_standards FOR DELETE USING (true);

ALTER TABLE cultivation_plans_v2 ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow anonymous read access on cultivation_plans_v2" ON cultivation_plans_v2 FOR SELECT USING (true);
CREATE POLICY "Allow anonymous insert access on cultivation_plans_v2" ON cultivation_plans_v2 FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow anonymous update access on cultivation_plans_v2" ON cultivation_plans_v2 FOR UPDATE USING (true);
CREATE POLICY "Allow anonymous delete access on cultivation_plans_v2" ON cultivation_plans_v2 FOR DELETE USING (true);

ALTER TABLE nursery_schedules_v2 ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow anonymous read access on nursery_schedules_v2" ON nursery_schedules_v2 FOR SELECT USING (true);
CREATE POLICY "Allow anonymous insert access on nursery_schedules_v2" ON nursery_schedules_v2 FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow anonymous update access on nursery_schedules_v2" ON nursery_schedules_v2 FOR UPDATE USING (true);
CREATE POLICY "Allow anonymous delete access on nursery_schedules_v2" ON nursery_schedules_v2 FOR DELETE USING (true);
