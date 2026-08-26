-- ==============================================================================
-- materials テーブルに カルシウム(Ca)・マグネシウム(Mg)成分比率カラムを追加するSQL
-- ==============================================================================

DO $$
BEGIN
    -- 1. カルシウム / 石灰 (Ca %)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'materials' AND column_name = 'ca_percent') THEN
        ALTER TABLE materials ADD COLUMN ca_percent NUMERIC(5, 2) DEFAULT 0;
    END IF;

    -- 2. マグネシウム / 苦土 (Mg %)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'materials' AND column_name = 'mg_percent') THEN
        ALTER TABLE materials ADD COLUMN mg_percent NUMERIC(5, 2) DEFAULT 0;
    END IF;
END $$;
