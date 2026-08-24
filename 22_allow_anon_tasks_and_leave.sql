-- 現場ポータル（現場スタッフ/未認証端末）からタスク(work_logs)および有給申請(leave_requests)を安全に操作可能にするRLSポリシー
-- Supabase の SQL Editor で実行してください。

-- 1. work_logs テーブル (タスク・作業予定・実績)
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

-- 2. leave_requests テーブル (有給休暇申請)
ALTER TABLE IF EXISTS public.leave_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow anon read leave_requests" ON public.leave_requests;
CREATE POLICY "Allow anon read leave_requests" ON public.leave_requests
  FOR SELECT
  TO anon, authenticated
  USING (true);

DROP POLICY IF EXISTS "Allow anon insert leave_requests" ON public.leave_requests;
CREATE POLICY "Allow anon insert leave_requests" ON public.leave_requests
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

DROP POLICY IF EXISTS "Allow anon update leave_requests" ON public.leave_requests;
CREATE POLICY "Allow anon update leave_requests" ON public.leave_requests
  FOR UPDATE
  TO anon, authenticated
  USING (true);

-- 3. board_posts および board_comments (掲示板)
ALTER TABLE IF EXISTS public.board_posts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow anon read board_posts" ON public.board_posts;
CREATE POLICY "Allow anon read board_posts" ON public.board_posts
  FOR SELECT
  TO anon, authenticated
  USING (true);

DROP POLICY IF EXISTS "Allow anon insert board_posts" ON public.board_posts;
CREATE POLICY "Allow anon insert board_posts" ON public.board_posts
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

ALTER TABLE IF EXISTS public.board_comments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow anon read board_comments" ON public.board_comments;
CREATE POLICY "Allow anon read board_comments" ON public.board_comments
  FOR SELECT
  TO anon, authenticated
  USING (true);

DROP POLICY IF EXISTS "Allow anon insert board_comments" ON public.board_comments;
CREATE POLICY "Allow anon insert board_comments" ON public.board_comments
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);
