-- ==============================================================================
-- 30_add_trim_ranges_to_video_manuals.sql
-- 動画マニュアルの複数区間（マルチセグメント）ジャンプカット・トリミング対応
-- ==============================================================================

DO $$ 
BEGIN
    -- trim_ranges カラム（複数区間トリミングJSONB: [{"start": 2, "end": 4}, {"start": 6, "end": 8}]）
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'video_manuals' AND column_name = 'trim_ranges') THEN
        ALTER TABLE public.video_manuals ADD COLUMN trim_ranges JSONB DEFAULT '[]'::jsonb;
    END IF;
END $$;
