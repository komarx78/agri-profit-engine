-- ==============================================================================
-- 32_fix_attendance_logs_user_id_and_rls.sql
-- 勤怠ログ (attendance_logs) の user_id 修復 ＆ 打刻RLSポリシー適正化
-- ==============================================================================

-- 1. 既存の user_id が NULL の勤怠ログを、workers テーブルの user_id から一括自動修復
UPDATE public.attendance_logs a
SET user_id = w.user_id
FROM public.workers w
WHERE a.worker_id = w.id
  AND a.user_id IS NULL;

-- 2. attendance_logs に actual_rest_minutes カラムが存在しない場合は追加
ALTER TABLE public.attendance_logs 
ADD COLUMN IF NOT EXISTS actual_rest_minutes INTEGER;

-- 3. RLS ポリシーの再構築（現場打刻の保護と管理者の完全閲覧を両立）
ALTER TABLE public.attendance_logs ENABLE ROW LEVEL SECURITY;

-- 既存の競合ポリシーを削除
DROP POLICY IF EXISTS "Allow anon read attendance_logs" ON public.attendance_logs;
DROP POLICY IF EXISTS "Allow anon insert attendance_logs" ON public.attendance_logs;
DROP POLICY IF EXISTS "Allow anon update attendance_logs" ON public.attendance_logs;
DROP POLICY IF EXISTS "Authenticated users manage own attendance_logs" ON public.attendance_logs;
DROP POLICY IF EXISTS "Anon portal attendance_logs" ON public.attendance_logs;

-- 管理者（認証ユーザー）：自社テナント (user_id = auth.uid()) の勤怠データを全操作可能
CREATE POLICY "Authenticated users manage own attendance_logs" ON public.attendance_logs
  FOR ALL TO authenticated
  USING (
    auth.uid() = user_id 
    OR EXISTS (
      SELECT 1 FROM public.workers w 
      WHERE w.id = attendance_logs.worker_id AND w.user_id = auth.uid()
    )
  )
  WITH CHECK (
    auth.uid() = user_id 
    OR EXISTS (
      SELECT 1 FROM public.workers w 
      WHERE w.id = attendance_logs.worker_id AND w.user_id = auth.uid()
    )
  );

-- 現場ポータル（anon）：出退勤の打刻・更新を許可
CREATE POLICY "Anon portal attendance_logs" ON public.attendance_logs
  FOR ALL TO anon
  USING (true)
  WITH CHECK (true);
