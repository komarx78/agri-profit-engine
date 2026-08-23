-- 1. 動画マニュアル本体テーブル
CREATE TABLE public.video_manuals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    description TEXT,
    video_url TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. 動画のナレーション（台本）テーブル
CREATE TABLE public.video_narrations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    video_id UUID NOT NULL REFERENCES public.video_manuals(id) ON DELETE CASCADE,
    start_time NUMERIC NOT NULL, -- 開始秒数
    end_time NUMERIC NOT NULL,   -- 終了秒数
    script_ja TEXT NOT NULL,     -- 日本語
    script_en TEXT,              -- 英語
    script_vi TEXT,              -- ベトナム語
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- RLS (Row Level Security) の設定
ALTER TABLE public.video_manuals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.video_narrations ENABLE ROW LEVEL SECURITY;

-- プロトタイプ用として、すべてのユーザーに全権限を付与 (※本番運用時は適切に絞る)
CREATE POLICY "Enable all actions for all users" ON public.video_manuals FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Enable all actions for all users" ON public.video_narrations FOR ALL USING (true) WITH CHECK (true);
