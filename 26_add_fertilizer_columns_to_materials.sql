-- ==============================================================================
-- materials テーブルに肥料専用カラム（N-P-K成分・袋容量・肥料区分等）を追加するSQL
-- ==============================================================================

DO $$
BEGIN
    -- 1. 窒素 (N %)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'materials' AND column_name = 'n_percent') THEN
        ALTER TABLE materials ADD COLUMN n_percent NUMERIC(5, 2) DEFAULT 0;
    END IF;

    -- 2. リン酸 (P %)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'materials' AND column_name = 'p_percent') THEN
        ALTER TABLE materials ADD COLUMN p_percent NUMERIC(5, 2) DEFAULT 0;
    END IF;

    -- 3. カリ (K %)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'materials' AND column_name = 'k_percent') THEN
        ALTER TABLE materials ADD COLUMN k_percent NUMERIC(5, 2) DEFAULT 0;
    END IF;

    -- 4. 1袋の重量 (kg)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'materials' AND column_name = 'bag_weight_kg') THEN
        ALTER TABLE materials ADD COLUMN bag_weight_kg NUMERIC(6, 2) DEFAULT 20;
    END IF;

    -- 5. 肥料種類 (化成肥料, 有機質肥料 等)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'materials' AND column_name = 'fertilizer_type') THEN
        ALTER TABLE materials ADD COLUMN fertilizer_type TEXT;
    END IF;

    -- 6. 用途区分 (元肥, 追肥, 共通 等)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'materials' AND column_name = 'fertilizer_usage') THEN
        ALTER TABLE materials ADD COLUMN fertilizer_usage TEXT DEFAULT '共通';
    END IF;
END $$;
