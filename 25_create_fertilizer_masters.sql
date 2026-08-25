-- ==============================================================================
-- 25_create_fertilizer_masters.sql
-- 全国の肥料公的マスター（登録銘柄・N-P-K成分量）管理テーブルの作成
-- ==============================================================================

-- 1. 肥料マスターテーブル作成
CREATE TABLE IF NOT EXISTS public.m_fertilizers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    registration_no TEXT,                         -- 登録番号 / 届出番号 (例: 生第12345号)
    fertilizer_name TEXT NOT NULL,                -- 肥料の名称 / 銘柄名
    fertilizer_type TEXT,                         -- 肥料の種類 (化成肥料, 単肥, 有機質肥料, 液肥, 指定配合肥料など)
    applicant_name TEXT,                          -- 製造業者・輸入業者・メーカー名
    n_percent NUMERIC(5,2) DEFAULT 0,             -- 窒素全量 (N %)
    p_percent NUMERIC(5,2) DEFAULT 0,             -- りん酸全量 (P %)
    k_percent NUMERIC(5,2) DEFAULT 0,             -- 加里全量 (K %)
    mg_percent NUMERIC(5,2) DEFAULT 0,            -- 苦土 (Mg %, 任意)
    ca_percent NUMERIC(5,2) DEFAULT 0,            -- 石灰 (Ca %, 任意)
    other_ingredients TEXT,                       -- その他含有成分・微量要素・備考
    raw_data JSONB,                               -- CSV元データ全列（予備）
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- 2. 検索高速化インデックス作成
CREATE INDEX IF NOT EXISTS idx_m_fertilizers_name ON public.m_fertilizers (fertilizer_name);
CREATE INDEX IF NOT EXISTS idx_m_fertilizers_reg_no ON public.m_fertilizers (registration_no);
CREATE INDEX IF NOT EXISTS idx_m_fertilizers_type ON public.m_fertilizers (fertilizer_type);
CREATE INDEX IF NOT EXISTS idx_m_fertilizers_npk ON public.m_fertilizers (n_percent, p_percent, k_percent);

-- 3. 重複登録防止のためのユニーク制約（登録番号または名称+メーカー）
-- 登録番号がある場合は登録番号でUpsert可能にする
CREATE UNIQUE INDEX IF NOT EXISTS idx_m_fertilizers_unique_reg ON public.m_fertilizers (registration_no) WHERE registration_no IS NOT NULL AND registration_no <> '';

-- 4. RLS（Row Level Security）の有効化
ALTER TABLE public.m_fertilizers ENABLE ROW LEVEL SECURITY;

-- 誰でも（匿名・現場・一般テナント）検索・参照可能
CREATE POLICY "Allow public read on m_fertilizers"
    ON public.m_fertilizers
    FOR SELECT
    USING (true);

-- 誰でも（スーパー管理者等）登録・更新・削除可能（Super Admin管理用）
CREATE POLICY "Allow public insert on m_fertilizers"
    ON public.m_fertilizers
    FOR INSERT
    WITH CHECK (true);

CREATE POLICY "Allow public update on m_fertilizers"
    ON public.m_fertilizers
    FOR UPDATE
    USING (true);

CREATE POLICY "Allow public delete on m_fertilizers"
    ON public.m_fertilizers
    FOR DELETE
    USING (true);
