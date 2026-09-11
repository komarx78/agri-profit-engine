-- 🚨 システムエラー通知先設定マスタテーブル（スーパー管理者用）
CREATE TABLE IF NOT EXISTS public.system_notification_settings (
    id TEXT PRIMARY KEY DEFAULT 'default_setting',
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    alert_emails TEXT NOT NULL DEFAULT 'koma@ggmc.secret.jp',
    webhook_url TEXT DEFAULT '',
    is_email_enabled BOOLEAN DEFAULT true,
    is_line_enabled BOOLEAN DEFAULT true
);

-- RLS（Row Level Security）有効化
ALTER TABLE public.system_notification_settings ENABLE ROW LEVEL SECURITY;

-- 既存ポリシーのリセット（二重実行耐性・完全冪等性）
DROP POLICY IF EXISTS "Allow public read notification_settings" ON public.system_notification_settings;
DROP POLICY IF EXISTS "Allow public write notification_settings" ON public.system_notification_settings;

-- ① 読み取りを許可
CREATE POLICY "Allow public read notification_settings"
    ON public.system_notification_settings
    FOR SELECT
    TO public
    USING (true);

-- ② 書き込み・更新を許可
CREATE POLICY "Allow public write notification_settings"
    ON public.system_notification_settings
    FOR ALL
    TO public
    USING (true)
    WITH CHECK (true);

-- 初期デフォルト設定レコードの投入
INSERT INTO public.system_notification_settings (id, alert_emails, is_email_enabled, is_line_enabled)
VALUES ('default_setting', 'koma@ggmc.secret.jp', true, true)
ON CONFLICT (id) DO NOTHING;
