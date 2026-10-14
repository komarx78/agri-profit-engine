-- =====================================================================
-- 18_育苗基準カラム追加.sql
-- 目的：作目ごとの「育苗の基準」を crop_standards に追加する
--       （育苗スケジュールの「まく日」「トレイ枚数」「種の粒数」の自動計算に使う）
-- 実行場所：Supabase の SQL Editor（何度実行しても安全です）
-- 既存データ：一切変更しません（列を追加するだけ。値は空＝未設定のまま）
-- =====================================================================

ALTER TABLE crop_standards ADD COLUMN IF NOT EXISTS nursery_days     NUMERIC; -- 育苗日数（種まき→植え付け）日
ALTER TABLE crop_standards ADD COLUMN IF NOT EXISTS nursery_days_spring NUMERIC; -- 春植え（3〜5月）の育苗日数
ALTER TABLE crop_standards ADD COLUMN IF NOT EXISTS nursery_days_summer NUMERIC; -- 夏植え（6〜8月）の育苗日数
ALTER TABLE crop_standards ADD COLUMN IF NOT EXISTS nursery_days_autumn NUMERIC; -- 秋植え（9〜11月）の育苗日数
ALTER TABLE crop_standards ADD COLUMN IF NOT EXISTS nursery_days_winter NUMERIC; -- 冬植え（12〜2月）の育苗日数
ALTER TABLE crop_standards ADD COLUMN IF NOT EXISTS potting_days     NUMERIC; -- 鉢上げまでの日数（種まき→鉢上げ）日。鉢上げしない作目は空
ALTER TABLE crop_standards ADD COLUMN IF NOT EXISTS germination_days NUMERIC; -- 発芽までの日数（種まき→発芽）日
ALTER TABLE crop_standards ADD COLUMN IF NOT EXISTS germination_rate NUMERIC; -- 発芽率 %（種袋の表示）
ALTER TABLE crop_standards ADD COLUMN IF NOT EXISTS tray_cells       NUMERIC; -- セルトレイ1枚の穴の数
ALTER TABLE crop_standards ADD COLUMN IF NOT EXISTS seeds_per_cell   NUMERIC; -- 1つの穴にまく種の数

-- 値の範囲チェック（おかしな値の保存を防ぐ）
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'crop_standards_germination_rate_range') THEN
    ALTER TABLE crop_standards ADD CONSTRAINT crop_standards_germination_rate_range
      CHECK (germination_rate IS NULL OR (germination_rate > 0 AND germination_rate <= 100));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'crop_standards_nursery_nonneg') THEN
    ALTER TABLE crop_standards ADD CONSTRAINT crop_standards_nursery_nonneg
      CHECK (
        (nursery_days IS NULL OR nursery_days >= 0) AND
        (potting_days IS NULL OR potting_days >= 0) AND
        (germination_days IS NULL OR germination_days >= 0) AND
        (tray_cells IS NULL OR tray_cells > 0) AND
        (seeds_per_cell IS NULL OR seeds_per_cell > 0)
      );
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'crop_standards_seasonal_nursery_nonneg') THEN
    ALTER TABLE crop_standards ADD CONSTRAINT crop_standards_seasonal_nursery_nonneg
      CHECK (
        (nursery_days_spring IS NULL OR nursery_days_spring >= 0) AND
        (nursery_days_summer IS NULL OR nursery_days_summer >= 0) AND
        (nursery_days_autumn IS NULL OR nursery_days_autumn >= 0) AND
        (nursery_days_winter IS NULL OR nursery_days_winter >= 0)
      );
  END IF;
END $$;

-- 画面側のキャッシュに新しい列を反映
NOTIFY pgrst, 'reload schema';

-- =====================================================================
-- 【確認用】3テーブルのアクセス制限（RLS）が今どうなっているか
-- ※ 下の SELECT を実行して結果を共有してください（読むだけで何も変更しません）
-- =====================================================================
SELECT tablename, policyname, cmd, roles, qual, with_check
FROM pg_policies
WHERE tablename IN ('crop_standards', 'cultivation_plans_v2', 'nursery_schedules_v2')
ORDER BY tablename, policyname;

SELECT relname AS table_name, relrowsecurity AS rls_enabled
FROM pg_class
WHERE relname IN ('crop_standards', 'cultivation_plans_v2', 'nursery_schedules_v2');
