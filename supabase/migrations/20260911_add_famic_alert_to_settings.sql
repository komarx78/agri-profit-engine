-- 🚨 農薬マスター月初更新リマインド送信履歴カラムの追加（完全冪等性保証）
ALTER TABLE IF EXISTS public.system_notification_settings 
ADD COLUMN IF NOT EXISTS last_famic_alert_month TEXT DEFAULT '';
