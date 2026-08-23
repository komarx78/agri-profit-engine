-- ==============================================================================
-- 【農薬・肥料・資材の3大マスタ分離＆農薬検索連動用カラム追加SQL】
-- ==============================================================================

-- materials テーブルに農薬・肥料専用カラムを追加
ALTER TABLE IF EXISTS public.materials ADD COLUMN IF NOT EXISTS material_type TEXT DEFAULT 'general';

-- 農薬専用カラム
ALTER TABLE IF EXISTS public.materials ADD COLUMN IF NOT EXISTS pesticide_type TEXT; -- 殺虫剤, 殺菌剤, 除草剤, その他
ALTER TABLE IF EXISTS public.materials ADD COLUMN IF NOT EXISTS rac_code TEXT; -- RACコード (例: 1A, 3, FR M5)
ALTER TABLE IF EXISTS public.materials ADD COLUMN IF NOT EXISTS dilution TEXT; -- 標準希釈倍数 (例: 1000〜2000倍)
ALTER TABLE IF EXISTS public.materials ADD COLUMN IF NOT EXISTS target_pests TEXT; -- 対象病害虫・雑草
ALTER TABLE IF EXISTS public.materials ADD COLUMN IF NOT EXISTS usage_time TEXT; -- 使用時期 (例: 収穫前日まで)
ALTER TABLE IF EXISTS public.materials ADD COLUMN IF NOT EXISTS max_count INTEGER DEFAULT 0; -- 総使用回数上限

-- 肥料専用カラム
ALTER TABLE IF EXISTS public.materials ADD COLUMN IF NOT EXISTS fertilizer_type TEXT; -- 化成肥料, 有機肥料, 液肥, 土壌改良材, その他
ALTER TABLE IF EXISTS public.materials ADD COLUMN IF NOT EXISTS fertilizer_usage TEXT DEFAULT '共通'; -- 元肥, 追肥, 葉面散布, 共通
ALTER TABLE IF EXISTS public.materials ADD COLUMN IF NOT EXISTS n_percent NUMERIC DEFAULT 0; -- N（窒素 %）
ALTER TABLE IF EXISTS public.materials ADD COLUMN IF NOT EXISTS p_percent NUMERIC DEFAULT 0; -- P（リン酸 %）
ALTER TABLE IF EXISTS public.materials ADD COLUMN IF NOT EXISTS k_percent NUMERIC DEFAULT 0; -- K（カリ %）
ALTER TABLE IF EXISTS public.materials ADD COLUMN IF NOT EXISTS bag_weight_kg NUMERIC DEFAULT 20; -- 1袋の重量 (kg)

-- 既存データの自動分類移行（農薬費・肥料費を自動マッピング）
UPDATE public.materials 
SET material_type = 'pesticide' 
WHERE category = '農薬費' AND (material_type IS NULL OR material_type = 'general');

UPDATE public.materials 
SET material_type = 'fertilizer' 
WHERE category = '肥料費' AND (material_type IS NULL OR material_type = 'general');
