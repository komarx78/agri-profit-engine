-- 🚨 システムエラー監視ログテーブル（販売管理者・スーパー管理者用）
CREATE TABLE IF NOT EXISTS public.system_error_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMPTZ DEFAULT now(),
    tenant_id TEXT,
    company_name TEXT,
    worker_id TEXT,
    worker_name TEXT,
    error_level TEXT DEFAULT 'error', -- 'error' | 'warning' | 'info'
    error_category TEXT DEFAULT 'general', -- 'attendance' | 'login' | 'sync' | 'api' | 'general'
    error_message TEXT NOT NULL,
    error_stack TEXT,
    device_info TEXT,
    page_url TEXT,
    is_resolved BOOLEAN DEFAULT false,
    resolved_at TIMESTAMPTZ,
    resolved_by TEXT
);

-- インデックス作成
CREATE INDEX IF NOT EXISTS idx_system_error_logs_created_at ON public.system_error_logs (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_system_error_logs_tenant_id ON public.system_error_logs (tenant_id);
CREATE INDEX IF NOT EXISTS idx_system_error_logs_is_resolved ON public.system_error_logs (is_resolved);

-- RLS（Row Level Security）有効化
ALTER TABLE public.system_error_logs ENABLE ROW LEVEL SECURITY;

-- ① 現場端末・クライアントからのエラーログ書き込みを許可（エラー報告を絶対に落とさないため全開放）
CREATE POLICY "Allow public insert to system_error_logs"
    ON public.system_error_logs
    FOR INSERT
    TO public
    WITH CHECK (true);

-- ② スーパー管理者および認証ユーザーのみ閲覧・更新可能
CREATE POLICY "Allow read system_error_logs for authenticated"
    ON public.system_error_logs
    FOR SELECT
    TO authenticated
    USING (true);

CREATE POLICY "Allow update system_error_logs for authenticated"
    ON public.system_error_logs
    FOR UPDATE
    TO authenticated
    USING (true);
