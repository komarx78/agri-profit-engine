-- 現場スタッフ（PINログイン/未認証状態）でも会社名およびタスクを閲覧できるようにするRLSポリシー設定

-- 1. company_settings (会社設定・会社名)
ALTER TABLE IF EXISTS public.company_settings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow anon read company_settings" ON public.company_settings;
CREATE POLICY "Allow anon read company_settings" ON public.company_settings
  FOR SELECT
  TO anon, authenticated
  USING (true);

-- 2. work_logs (タスク・作業記録)
ALTER TABLE IF EXISTS public.work_logs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow anon read work_logs" ON public.work_logs;
CREATE POLICY "Allow anon read work_logs" ON public.work_logs
  FOR SELECT
  TO anon, authenticated
  USING (true);

DROP POLICY IF EXISTS "Allow anon insert work_logs" ON public.work_logs;
CREATE POLICY "Allow anon insert work_logs" ON public.work_logs
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

DROP POLICY IF EXISTS "Allow anon update work_logs" ON public.work_logs;
CREATE POLICY "Allow anon update work_logs" ON public.work_logs
  FOR UPDATE
  TO anon, authenticated
  USING (true);
