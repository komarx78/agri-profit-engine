-- ==============================================================================
-- FAMICデータ連動 農薬マスターテーブルの作成 (権限修正版)
-- ==============================================================================

-- 既存のテーブルがあれば削除（再実行用）
DROP TABLE IF EXISTS public.m_pesticide_usages CASCADE;
DROP TABLE IF EXISTS public.m_pesticides CASCADE;

-- 1. 農薬基本情報マスター (m_pesticides)
CREATE TABLE public.m_pesticides (
    registration_no VARCHAR(50) PRIMARY KEY, -- 登録番号（CSV連携のため文字列型）
    pesticide_type VARCHAR(255),             -- 農薬の種類名
    pesticide_name VARCHAR(255) NOT NULL,    -- 農薬の名称
    applicant_name VARCHAR(255),             -- 登録を有する者の名称
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

-- 2. 農薬適用情報マスター (m_pesticide_usages)
CREATE TABLE public.m_pesticide_usages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    registration_no VARCHAR(50) REFERENCES public.m_pesticides(registration_no) ON DELETE CASCADE,
    crop_name VARCHAR(255) NOT NULL,         -- 作物名
    target_pest VARCHAR(255),                -- 適用病害虫雑草名
    usage_time VARCHAR(255),                 -- 使用時期（例: 収穫前日まで）
    usage_method VARCHAR(255),               -- 使用方法（例: 散布）
    usage_amount VARCHAR(255),               -- 使用量・希釈倍率（例: 1000倍, 100~150L/10a）
    usage_count VARCHAR(255),                -- 使用回数（例: 3回以内）
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

-- 検索を高速化するためのインデックス作成
CREATE INDEX idx_m_pesticides_name ON public.m_pesticides(pesticide_name);
CREATE INDEX idx_m_pesticide_usages_crop ON public.m_pesticide_usages(crop_name);
CREATE INDEX idx_m_pesticide_usages_pest ON public.m_pesticide_usages(target_pest);

-- ==============================================================================
-- 権限（RLS）の設定
-- ブラウザからのインポート時に弾かれないよう、明示的に書き込み権限を付与します。
-- ==============================================================================
ALTER TABLE public.m_pesticides ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Enable all for m_pesticides" ON public.m_pesticides FOR ALL USING (true) WITH CHECK (true);

ALTER TABLE public.m_pesticide_usages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Enable all for m_pesticide_usages" ON public.m_pesticide_usages FOR ALL USING (true) WITH CHECK (true);
