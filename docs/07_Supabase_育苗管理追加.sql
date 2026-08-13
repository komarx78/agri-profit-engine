-- 育苗スケジュール管理用テーブル (nursery_batches)
CREATE TABLE nursery_batches (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    crop_name VARCHAR(255) NOT NULL,    -- 品目 (なす、トマト等)
    variety VARCHAR(255) NOT NULL,      -- 品種 (千両二号、京みどり等)
    maker VARCHAR(255),                 -- メーカー
    pot_color VARCHAR(50),              -- ポット色 (黒、黄、赤、青など)
    spec VARCHAR(50),                   -- 規格 (9cm, 128穴など)
    target_quantity NUMERIC,            -- 必要本数 (100など)
    sown_quantity NUMERIC,              -- 播種量 (128など)
    
    -- スケジュールデータ（JSONBで動的に持たせることでExcelの列に対応しやすくする）
    -- 例: {"2026-02-07": {"type": "sown", "quantity": 128}, "2026-03-27": {"type": "care", "quantity": 128}}
    schedule_data JSONB DEFAULT '{}'::jsonb,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- RLS (Row Level Security) の設定
ALTER TABLE nursery_batches ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow anonymous read access on nursery_batches" ON nursery_batches FOR SELECT USING (true);
CREATE POLICY "Allow anonymous insert access on nursery_batches" ON nursery_batches FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow anonymous update access on nursery_batches" ON nursery_batches FOR UPDATE USING (true);
CREATE POLICY "Allow anonymous delete access on nursery_batches" ON nursery_batches FOR DELETE USING (true);
