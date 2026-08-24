-- ==============================================================================
-- 24_extend_video_manuals_and_narrations.sql
-- 動画マニュアルのカット（トリミング）および多言語テロップ（字幕・AI翻訳）拡張
-- ==============================================================================

-- 1. video_manuals テーブルの拡張（カット・トリミング用秒数、所有者ID）
DO $$ 
BEGIN
    -- user_id カラム追加
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'video_manuals' AND column_name = 'user_id') THEN
        ALTER TABLE public.video_manuals ADD COLUMN user_id UUID;
    END IF;

    -- trim_start カラム（開始秒数）追加
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'video_manuals' AND column_name = 'trim_start') THEN
        ALTER TABLE public.video_manuals ADD COLUMN trim_start NUMERIC DEFAULT 0;
    END IF;

    -- trim_end カラム（終了秒数）追加
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'video_manuals' AND column_name = 'trim_end') THEN
        ALTER TABLE public.video_manuals ADD COLUMN trim_end NUMERIC;
    END IF;
END $$;

-- 2. video_narrations テーブルの存在確認＆作成
CREATE TABLE IF NOT EXISTS public.video_narrations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    video_id UUID NOT NULL REFERENCES public.video_manuals(id) ON DELETE CASCADE,
    start_time NUMERIC NOT NULL,
    end_time NUMERIC NOT NULL,
    script_ja TEXT NOT NULL,
    script_en TEXT,
    script_vi TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 3. video_narrations テーブルの多言語拡張カラム追加
DO $$ 
BEGIN
    -- translations (JSONB: 全言語一括保存用)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'video_narrations' AND column_name = 'translations') THEN
        ALTER TABLE public.video_narrations ADD COLUMN translations JSONB DEFAULT '{}'::jsonb;
    END IF;

    -- script_id (インドネシア語)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'video_narrations' AND column_name = 'script_id') THEN
        ALTER TABLE public.video_narrations ADD COLUMN script_id TEXT;
    END IF;

    -- script_zh (中国語)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'video_narrations' AND column_name = 'script_zh') THEN
        ALTER TABLE public.video_narrations ADD COLUMN script_zh TEXT;
    END IF;

    -- script_si (シンハラ語)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'video_narrations' AND column_name = 'script_si') THEN
        ALTER TABLE public.video_narrations ADD COLUMN script_si TEXT;
    END IF;

    -- script_km (クメール語)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'video_narrations' AND column_name = 'script_km') THEN
        ALTER TABLE public.video_narrations ADD COLUMN script_km TEXT;
    END IF;
END $$;

-- 4. RLS (Row Level Security) の設定
ALTER TABLE public.video_manuals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.video_narrations ENABLE ROW LEVEL SECURITY;

-- 既存ポリシーをリフレッシュ
DROP POLICY IF EXISTS "Allow all for video_manuals" ON public.video_manuals;
CREATE POLICY "Allow all for video_manuals" ON public.video_manuals FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow all for video_narrations" ON public.video_narrations;
CREATE POLICY "Allow all for video_narrations" ON public.video_narrations FOR ALL USING (true) WITH CHECK (true);
