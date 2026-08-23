-- ==============================================================================
-- FAMICデータ文字数制限エラー対策 (VARCHAR 255 -> TEXT への変更)
-- ==============================================================================

-- 1. 農薬基本情報マスター (m_pesticides) の文字数制限を解除
ALTER TABLE public.m_pesticides
  ALTER COLUMN pesticide_type TYPE TEXT,
  ALTER COLUMN pesticide_name TYPE TEXT,
  ALTER COLUMN applicant_name TYPE TEXT;

-- 2. 農薬適用情報マスター (m_pesticide_usages) の文字数制限を解除
ALTER TABLE public.m_pesticide_usages
  ALTER COLUMN crop_name TYPE TEXT,
  ALTER COLUMN target_pest TYPE TEXT,
  ALTER COLUMN usage_time TYPE TEXT,
  ALTER COLUMN usage_method TYPE TEXT,
  ALTER COLUMN usage_amount TYPE TEXT,
  ALTER COLUMN usage_count TYPE TEXT;
