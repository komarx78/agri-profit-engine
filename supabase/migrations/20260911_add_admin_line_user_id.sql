-- 司馬懿【完全冪等性保証】system_notification_settings に admin_line_user_id カラムを安全に追加
ALTER TABLE IF EXISTS system_notification_settings 
ADD COLUMN IF NOT EXISTS admin_line_user_id TEXT DEFAULT 'U89851b2fdeef65c8082a921727a56314';

-- 既存レコードの admin_line_user_id が NULL の場合、判明している管理者LINE IDを初期設定
UPDATE system_notification_settings
SET admin_line_user_id = 'U89851b2fdeef65c8082a921727a56314'
WHERE id = 'default_setting' AND (admin_line_user_id IS NULL OR admin_line_user_id = '');
