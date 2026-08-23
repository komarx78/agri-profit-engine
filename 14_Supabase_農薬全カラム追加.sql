-- ==============================================================================
-- FAMICデータ 全項目対応 カラム追加SQL
-- ==============================================================================

-- 1. 基本部マスター (m_pesticides) への追加カラム
ALTER TABLE public.m_pesticides
  ADD COLUMN IF NOT EXISTS purpose TEXT;               -- 用途

-- 2. 適用部マスター (m_pesticide_usages) への追加カラム
ALTER TABLE public.m_pesticide_usages
  ADD COLUMN IF NOT EXISTS application_place TEXT,     -- 適用場所
  ADD COLUMN IF NOT EXISTS usage_purpose TEXT,         -- 使用目的
  ADD COLUMN IF NOT EXISTS spray_amount TEXT,          -- 散布液量
  ADD COLUMN IF NOT EXISTS fumigation_time TEXT,       -- くん蒸時間
  ADD COLUMN IF NOT EXISTS fumigation_temp TEXT,       -- くん蒸温度
  ADD COLUMN IF NOT EXISTS applicable_soil TEXT,       -- 適用土壌
  ADD COLUMN IF NOT EXISTS applicable_region TEXT,     -- 適用地帯名
  ADD COLUMN IF NOT EXISTS applicable_pesticide TEXT,  -- 適用農薬名
  ADD COLUMN IF NOT EXISTS mix_count TEXT,             -- 混合数
  ADD COLUMN IF NOT EXISTS active_ingredient_count_1 TEXT, -- 有効成分①を含む農薬の総使用回数
  ADD COLUMN IF NOT EXISTS active_ingredient_count_2 TEXT, -- 有効成分②を含む農薬の総使用回数
  ADD COLUMN IF NOT EXISTS active_ingredient_count_3 TEXT, -- 有効成分③を含む農薬の総使用回数
  ADD COLUMN IF NOT EXISTS active_ingredient_count_4 TEXT, -- 有効成分④を含む農薬の総使用回数
  ADD COLUMN IF NOT EXISTS active_ingredient_count_5 TEXT; -- 有効成分⑤を含む農薬の総使用回数

-- 確認用
-- 実行後、SupabaseのTable Editorでカラムが追加されたことを確認してください。
