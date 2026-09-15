-- =========================================================================
-- 【全社勤怠マスタ】勤怠締日（賃金締切日）および給与支払日ルールの追加
-- =========================================================================

-- 1. 会社設定テーブルに勤怠締日（0:末日、20:20日、15:15日等）を追加
ALTER TABLE company_settings 
ADD COLUMN IF NOT EXISTS attendance_closing_day INTEGER DEFAULT 0;

-- 2. 給与支払日ルール（例: "翌月25日払い"、"当月末払い"など）を追加
ALTER TABLE company_settings 
ADD COLUMN IF NOT EXISTS payment_day_rule TEXT DEFAULT '翌月25日払い';

-- 3. 既存レコードの初期値セット（デフォルトは末日締め・翌月25日払い）
UPDATE company_settings 
SET attendance_closing_day = 0 
WHERE attendance_closing_day IS NULL;

UPDATE company_settings 
SET payment_day_rule = '翌月25日払い' 
WHERE payment_day_rule IS NULL;
