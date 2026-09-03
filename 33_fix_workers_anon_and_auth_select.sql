-- ==============================================================================
-- 33_fix_workers_anon_and_auth_select.sql
-- 現場ワーカーログイン（WorkerGate）における名前一覧取得の完全保証
-- ==============================================================================

-- 1. workers テーブルの RLS ポリシー調整
-- 現場端末で認証セッション（authenticated）が残っている場合でも、
-- 現場ログインの名前選択（SELECT）を確実に許可する
DROP POLICY IF EXISTS "Anon read and pin check workers" ON public.workers;
DROP POLICY IF EXISTS "Allow anon read workers" ON public.workers;
DROP POLICY IF EXISTS "Authenticated users read workers" ON public.workers;

-- anon（未ログイン現場端末）用：名前一覧の取得を許可
CREATE POLICY "Anon read and pin check workers" ON public.workers
  FOR SELECT TO anon
  USING (true);

-- authenticated（ログイン済み現場端末・管理者）用：名前一覧の取得を許可
CREATE POLICY "Authenticated users read workers" ON public.workers
  FOR SELECT TO authenticated
  USING (true);
