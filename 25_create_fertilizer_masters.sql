-- ==============================================================================
-- 25_create_fertilizer_masters.sql
-- 全国の肥料公的マスター（登録銘柄・N-P-K成分量）管理テーブルの作成
-- FAMIC（農林水産省）登録データ完全対応
-- ==============================================================================

-- 1. 肥料マスターテーブル作成
CREATE TABLE IF NOT EXISTS public.m_fertilizers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    registration_no TEXT,                         -- 登録番号 / 届出番号 (例: 生第6号, 生第60号)
    registration_date TEXT,                       -- 登録年月日 (例: 1950/7/20)
    fertilizer_name TEXT NOT NULL,                -- 肥料の名称 / 銘柄名 (例: ２１．０硫酸アンモニア)
    fertilizer_type TEXT,                         -- 肥料種類名称 (例: 硫酸アンモニア, 高度化成肥料, 指定配合肥料)
    applicant_name TEXT,                          -- 肥料業者・製造メーカー名 (例: 日本化成株式会社, UBE株式会社)
    applicant_address TEXT,                       -- 住所
    expiry_status TEXT,                           -- 失効区分 (例: 満期失効, 有効)
    n_percent NUMERIC(5,2) DEFAULT 0,             -- 窒素全量 (N %)
    p_percent NUMERIC(5,2) DEFAULT 0,             -- りん酸全量 (P %)
    k_percent NUMERIC(5,2) DEFAULT 0,             -- 加里全量 (K %)
    mg_percent NUMERIC(5,2) DEFAULT 0,            -- 苦土 (Mg %, 任意)
    ca_percent NUMERIC(5,2) DEFAULT 0,            -- 石灰 (Ca %, 任意)
    other_ingredients TEXT,                       -- その他含有成分詳細 (例: ほう素:0.5%, アンモニア性窒素:21%)
    raw_data JSONB,                               -- CSV元データ（成分コード1〜16等の全列データ）
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- 既存テーブルがある場合の安全なカラム追加
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='m_fertilizers' AND column_name='registration_date') THEN
        ALTER TABLE public.m_fertilizers ADD COLUMN registration_date TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='m_fertilizers' AND column_name='applicant_address') THEN
        ALTER TABLE public.m_fertilizers ADD COLUMN applicant_address TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='m_fertilizers' AND column_name='expiry_status') THEN
        ALTER TABLE public.m_fertilizers ADD COLUMN expiry_status TEXT;
    END IF;
END $$;

-- 2. 検索高速化インデックス作成
CREATE INDEX IF NOT EXISTS idx_m_fertilizers_name ON public.m_fertilizers (fertilizer_name);
CREATE INDEX IF NOT EXISTS idx_m_fertilizers_reg_no ON public.m_fertilizers (registration_no);
CREATE INDEX IF NOT EXISTS idx_m_fertilizers_type ON public.m_fertilizers (fertilizer_type);
CREATE INDEX IF NOT EXISTS idx_m_fertilizers_applicant ON public.m_fertilizers (applicant_name);
CREATE INDEX IF NOT EXISTS idx_m_fertilizers_npk ON public.m_fertilizers (n_percent, p_percent, k_percent);

-- 3. 重複登録防止のためのユニーク制約
CREATE UNIQUE INDEX IF NOT EXISTS idx_m_fertilizers_unique_reg ON public.m_fertilizers (registration_no) WHERE registration_no IS NOT NULL AND registration_no <> '';

-- 4. RLS（Row Level Security）の有効化
ALTER TABLE public.m_fertilizers ENABLE ROW LEVEL SECURITY;

-- ポリシー設定（既存がある場合は一旦削除して再作成）
DROP POLICY IF EXISTS "Allow public read on m_fertilizers" ON public.m_fertilizers;
DROP POLICY IF EXISTS "Allow public insert on m_fertilizers" ON public.m_fertilizers;
DROP POLICY IF EXISTS "Allow public update on m_fertilizers" ON public.m_fertilizers;
DROP POLICY IF EXISTS "Allow public delete on m_fertilizers" ON public.m_fertilizers;

CREATE POLICY "Allow public read on m_fertilizers" ON public.m_fertilizers FOR SELECT USING (true);
CREATE POLICY "Allow public insert on m_fertilizers" ON public.m_fertilizers FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update on m_fertilizers" ON public.m_fertilizers FOR UPDATE USING (true);
CREATE POLICY "Allow public delete on m_fertilizers" ON public.m_fertilizers FOR DELETE USING (true);
