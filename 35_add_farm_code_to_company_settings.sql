-- ==============================================================================
-- 35_add_farm_code_to_company_settings.sql
-- 目的: company_settings テーブルに農園コード (farm_code) カラムを追加
-- 憲法4条・司馬懿SQL一撃無痛掟: 完全冪等性保証（何度実行してもエラー0）
-- ==============================================================================

-- 1. farm_code カラムの安全追加（存在しない場合のみ追加）
ALTER TABLE IF EXISTS company_settings 
ADD COLUMN IF NOT EXISTS farm_code TEXT;

-- 2. 大文字小文字を問わない高速検索用インデックスの配備
CREATE INDEX IF NOT EXISTS idx_company_settings_farm_code 
ON company_settings (LOWER(farm_code));

-- 3. 既存の既知テナントへの初期コード配備（未設定の場合のみ安全注入）
UPDATE company_settings 
SET farm_code = 'kap-101' 
WHERE (user_id = '83b1d7ad-6240-4fbf-8174-3dd4e2ff0c04' OR id = '83b1d7ad-6240-4fbf-8174-3dd4e2ff0c04') 
  AND (farm_code IS NULL OR farm_code = '');

UPDATE company_settings 
SET farm_code = 'sahara-789' 
WHERE (user_id = '62163024-2c8e-4057-a872-2455dbc58d32' OR id = '62163024-2c8e-4057-a872-2455dbc58d32') 
  AND (farm_code IS NULL OR farm_code = '');

-- 4. 匿名ユーザー（現場作業者）からの農園コード照合・読み取り許可のRLSポリシー
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'company_settings' AND policyname = 'Allow public read farm_code on company_settings'
  ) THEN
    CREATE POLICY "Allow public read farm_code on company_settings" 
    ON company_settings FOR SELECT 
    TO anon, authenticated 
    USING (true);
  END IF;
END $$;
