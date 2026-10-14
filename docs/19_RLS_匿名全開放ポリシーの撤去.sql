-- =====================================================================
-- 19_RLS_匿名全開放ポリシーの撤去.sql
-- 背景（2026-10-14 pg_policies で確認した事実）:
--   cultivation_plans_v2 / nursery_schedules_v2 / crop_standards に
--   「Allow anonymous ... access」（roles = public, qual = true）が残っている。
--   RLS のポリシーは「どれか1つでも許可すれば通る（OR）」ため、
--   自社限定ポリシー（auth.uid() = user_id）があっても、実質だれでも全社分を読み書き・削除できる状態。
--
-- 実行の順番:
--   STEP 1（診断・読むだけ）→ 結果を確認 → STEP 2（修正）→ アプリで動作確認
--   万一画面が動かなくなった場合のみ STEP 3（元に戻す）
-- 既存データ：一切変更しません（ルールの入れ替えだけ）
-- =====================================================================


-- ---------------------------------------------------------------------
-- STEP 1【診断・読むだけ】修正しても今のログイン方法で使えるかを事前確認
-- ---------------------------------------------------------------------
-- 1-a) 作付け・育苗のデータの持ち主(user_id)が、ログインできるアカウントと一致しているか
--      not_login_account が 0 なら、自社限定ルールだけにしても今のデータは見え続けます
SELECT 'cultivation_plans_v2' AS table_name,
       COUNT(*) AS total_rows,
       COUNT(*) FILTER (WHERE user_id IS NULL) AS user_id_empty,
       COUNT(*) FILTER (WHERE user_id IS NOT NULL AND user_id NOT IN (SELECT id FROM auth.users)) AS not_login_account
FROM cultivation_plans_v2
UNION ALL
SELECT 'nursery_schedules_v2',
       COUNT(*),
       COUNT(*) FILTER (WHERE user_id IS NULL),
       COUNT(*) FILTER (WHERE user_id IS NOT NULL AND user_id NOT IN (SELECT id FROM auth.users))
FROM nursery_schedules_v2
UNION ALL
SELECT 'crop_standards（作目の持ち主で判定）',
       COUNT(*),
       COUNT(*) FILTER (WHERE c.user_id IS NULL),
       COUNT(*) FILTER (WHERE c.user_id IS NOT NULL AND c.user_id NOT IN (SELECT id FROM auth.users))
FROM crop_standards cs LEFT JOIN crops c ON c.id = cs.crop_id;


-- ---------------------------------------------------------------------
-- STEP 2【修正】匿名の全開放ルールを撤去し、自社限定ルールだけにする
-- ---------------------------------------------------------------------
BEGIN;

-- 2-a) 作付け（cultivation_plans_v2）：自社限定ルール（Tenant Isolation / Authenticated users manage own）は残す
DROP POLICY IF EXISTS "Allow anonymous read access on cultivation_plans_v2"   ON cultivation_plans_v2;
DROP POLICY IF EXISTS "Allow anonymous insert access on cultivation_plans_v2" ON cultivation_plans_v2;
DROP POLICY IF EXISTS "Allow anonymous update access on cultivation_plans_v2" ON cultivation_plans_v2;
DROP POLICY IF EXISTS "Allow anonymous delete access on cultivation_plans_v2" ON cultivation_plans_v2;

-- 2-b) 育苗（nursery_schedules_v2）：作付けの持ち主で判定するルール（Authenticated users manage own）は残す
DROP POLICY IF EXISTS "Allow anonymous read access on nursery_schedules_v2"   ON nursery_schedules_v2;
DROP POLICY IF EXISTS "Allow anonymous insert access on nursery_schedules_v2" ON nursery_schedules_v2;
DROP POLICY IF EXISTS "Allow anonymous update access on nursery_schedules_v2" ON nursery_schedules_v2;
DROP POLICY IF EXISTS "Allow anonymous delete access on nursery_schedules_v2" ON nursery_schedules_v2;

-- 2-c) 作目の基準（crop_standards）：会社の列が無いため「作目(crops)の持ち主＝ログイン中の人」で判定する
DROP POLICY IF EXISTS "Allow anonymous read access on crop_standards"   ON crop_standards;
DROP POLICY IF EXISTS "Allow anonymous insert access on crop_standards" ON crop_standards;
DROP POLICY IF EXISTS "Allow anonymous update access on crop_standards" ON crop_standards;
DROP POLICY IF EXISTS "Allow anonymous delete access on crop_standards" ON crop_standards;

DROP POLICY IF EXISTS "Tenant isolation crop_standards via crops" ON crop_standards;
CREATE POLICY "Tenant isolation crop_standards via crops" ON crop_standards
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM crops c WHERE c.id = crop_standards.crop_id AND c.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM crops c WHERE c.id = crop_standards.crop_id AND c.user_id = auth.uid()));

ALTER TABLE crop_standards       ENABLE ROW LEVEL SECURITY;
ALTER TABLE cultivation_plans_v2 ENABLE ROW LEVEL SECURITY;
ALTER TABLE nursery_schedules_v2 ENABLE ROW LEVEL SECURITY;

COMMIT;

-- 2-d) 修正後の確認（Allow anonymous が1行も無く、qual が true だけの行が無ければ成功）
SELECT tablename, policyname, cmd, roles, qual
FROM pg_policies
WHERE tablename IN ('crop_standards', 'cultivation_plans_v2', 'nursery_schedules_v2')
ORDER BY tablename, policyname;


-- ---------------------------------------------------------------------
-- STEP 3【非常用・元に戻す】STEP 2 の後に画面でデータが出なくなった場合だけ実行
--  ※ 安全ではない元の状態に戻すだけです。実行した場合は必ず状況を共有してください
-- ---------------------------------------------------------------------
-- CREATE POLICY "Allow anonymous read access on cultivation_plans_v2"   ON cultivation_plans_v2 FOR SELECT USING (true);
-- CREATE POLICY "Allow anonymous insert access on cultivation_plans_v2" ON cultivation_plans_v2 FOR INSERT WITH CHECK (true);
-- CREATE POLICY "Allow anonymous update access on cultivation_plans_v2" ON cultivation_plans_v2 FOR UPDATE USING (true);
-- CREATE POLICY "Allow anonymous delete access on cultivation_plans_v2" ON cultivation_plans_v2 FOR DELETE USING (true);
-- CREATE POLICY "Allow anonymous read access on nursery_schedules_v2"   ON nursery_schedules_v2 FOR SELECT USING (true);
-- CREATE POLICY "Allow anonymous insert access on nursery_schedules_v2" ON nursery_schedules_v2 FOR INSERT WITH CHECK (true);
-- CREATE POLICY "Allow anonymous update access on nursery_schedules_v2" ON nursery_schedules_v2 FOR UPDATE USING (true);
-- CREATE POLICY "Allow anonymous delete access on nursery_schedules_v2" ON nursery_schedules_v2 FOR DELETE USING (true);
-- CREATE POLICY "Allow anonymous read access on crop_standards"   ON crop_standards FOR SELECT USING (true);
-- CREATE POLICY "Allow anonymous insert access on crop_standards" ON crop_standards FOR INSERT WITH CHECK (true);
-- CREATE POLICY "Allow anonymous update access on crop_standards" ON crop_standards FOR UPDATE USING (true);
-- CREATE POLICY "Allow anonymous delete access on crop_standards" ON crop_standards FOR DELETE USING (true);
