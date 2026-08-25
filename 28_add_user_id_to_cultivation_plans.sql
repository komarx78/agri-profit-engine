-- ==============================================================================
-- 28_add_user_id_to_cultivation_plans.sql
-- 栽培計画・予実管理表および育苗スケジュール用スキーマ修正・データ修復
-- ==============================================================================

-- 1. cultivation_plans_v2 テーブルへの user_id カラム追加
ALTER TABLE IF EXISTS public.cultivation_plans_v2 
ADD COLUMN IF NOT EXISTS user_id UUID;

-- 2. 既存の user_id が NULL の作付計画データを圃場(fields)の所属テナントIDから自動修復
UPDATE public.cultivation_plans_v2 cp
SET user_id = f.user_id
FROM public.fields f
WHERE cp.field_id = f.id AND cp.user_id IS NULL;

-- 3. nursery_schedules_v2 テーブルへの user_id / loss_rate カラム追加
ALTER TABLE IF EXISTS public.nursery_schedules_v2
ADD COLUMN IF NOT EXISTS user_id UUID,
ADD COLUMN IF NOT EXISTS loss_rate NUMERIC DEFAULT 10;

-- 4. RLSポリシーの更新
ALTER TABLE IF EXISTS public.cultivation_plans_v2 ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow anon read cultivation_plans_v2" ON public.cultivation_plans_v2;
CREATE POLICY "Allow anon read cultivation_plans_v2" ON public.cultivation_plans_v2 FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "Allow anon insert cultivation_plans_v2" ON public.cultivation_plans_v2;
CREATE POLICY "Allow anon insert cultivation_plans_v2" ON public.cultivation_plans_v2 FOR INSERT TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "Allow anon update cultivation_plans_v2" ON public.cultivation_plans_v2;
CREATE POLICY "Allow anon update cultivation_plans_v2" ON public.cultivation_plans_v2 FOR UPDATE TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "Allow anon delete cultivation_plans_v2" ON public.cultivation_plans_v2;
CREATE POLICY "Allow anon delete cultivation_plans_v2" ON public.cultivation_plans_v2 FOR DELETE TO anon, authenticated USING (true);
