-- 会社設定テーブルにLINE通知オフセット分数（退勤予定時刻の◯分後に通知）カラムを追加
ALTER TABLE company_settings 
ADD COLUMN IF NOT EXISTS line_notification_offset_minutes INTEGER DEFAULT 30;

-- 既存レコードの初期値セット
UPDATE company_settings 
SET line_notification_offset_minutes = 30 
WHERE line_notification_offset_minutes IS NULL;
