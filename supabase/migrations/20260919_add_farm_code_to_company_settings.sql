-- 🚨 company_settings テーブルに現場アプリ用「農園コード（farm_code）」カラムを追加
-- （SQL一撃無痛掟：何度実行しても安全な完全冪等性保証）

ALTER TABLE public.company_settings 
ADD COLUMN IF NOT EXISTS farm_code TEXT;

-- 大文字小文字を区別しない重複防止ユニークインデックス
CREATE UNIQUE INDEX IF NOT EXISTS idx_company_settings_farm_code 
ON public.company_settings (LOWER(farm_code)) 
WHERE farm_code IS NOT NULL;

-- 既存の農園にわかりやすい初期農園コードを安全に配備
UPDATE public.company_settings 
SET farm_code = 'sahara' 
WHERE user_id = '62163024-2c8e-4057-a872-2455dbc58d32' 
  AND (farm_code IS NULL OR farm_code = '');

UPDATE public.company_settings 
SET farm_code = 'kap' 
WHERE user_id = '83b1d7ad-6240-4fbf-8174-3dd4e2ff0c04' 
  AND (farm_code IS NULL OR farm_code = '');
