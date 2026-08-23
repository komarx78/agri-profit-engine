-- 現場ポータル（未認証端末/anon）から作業者およびマスタ情報を取得可能にするRLSポリシー

-- 1. workers テーブル (作業者マスタ)
ALTER TABLE IF EXISTS public.workers ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow anon read workers" ON public.workers;
CREATE POLICY "Allow anon read workers" ON public.workers
  FOR SELECT
  TO anon, authenticated
  USING (true);

DROP POLICY IF EXISTS "Allow anon update workers" ON public.workers;
CREATE POLICY "Allow anon update workers" ON public.workers
  FOR UPDATE
  TO anon, authenticated
  USING (true);

-- 2. company_settings テーブル (農園設定)
ALTER TABLE IF EXISTS public.company_settings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow anon read company_settings" ON public.company_settings;
CREATE POLICY "Allow anon read company_settings" ON public.company_settings
  FOR SELECT
  TO anon, authenticated
  USING (true);

-- 3. crops, fields, materials テーブル (作目・圃場・資材マスタ)
ALTER TABLE IF EXISTS public.crops ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow anon read crops" ON public.crops;
CREATE POLICY "Allow anon read crops" ON public.crops
  FOR SELECT
  TO anon, authenticated
  USING (true);

ALTER TABLE IF EXISTS public.fields ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow anon read fields" ON public.fields;
CREATE POLICY "Allow anon read fields" ON public.fields
  FOR SELECT
  TO anon, authenticated
  USING (true);

ALTER TABLE IF EXISTS public.materials ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow anon read materials" ON public.materials;
CREATE POLICY "Allow anon read materials" ON public.materials
  FOR SELECT
  TO anon, authenticated
  USING (true);

-- 4. attendance_logs テーブル (出退勤打刻)
ALTER TABLE IF EXISTS public.attendance_logs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow anon read attendance_logs" ON public.attendance_logs;
CREATE POLICY "Allow anon read attendance_logs" ON public.attendance_logs
  FOR SELECT
  TO anon, authenticated
  USING (true);

DROP POLICY IF EXISTS "Allow anon insert attendance_logs" ON public.attendance_logs;
CREATE POLICY "Allow anon insert attendance_logs" ON public.attendance_logs
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

DROP POLICY IF EXISTS "Allow anon update attendance_logs" ON public.attendance_logs;
CREATE POLICY "Allow anon update attendance_logs" ON public.attendance_logs
  FOR UPDATE
  TO anon, authenticated
  USING (true);
