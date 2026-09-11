-- 🚨 company_settings テーブルに LINE通知用カラムを追加
ALTER TABLE public.company_settings 
ADD COLUMN IF NOT EXISTS line_notification_offset_minutes INTEGER DEFAULT 30;

ALTER TABLE public.company_settings 
ADD COLUMN IF NOT EXISTS line_notification_time TEXT DEFAULT '17:30';

ALTER TABLE public.company_settings 
ADD COLUMN IF NOT EXISTS default_end_time TEXT DEFAULT '18:00';
