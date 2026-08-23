-- 10_Supabase_栽培計画中心_予実統合.sql
-- 栽培計画表（cultivation_plans_v2）を中心に、作業記録と出荷記録を紐付けるためのスキーマ変更

-- 1. 古い予定テストデータの削除（リセット）
-- 予定(planned)として入力されていた不要なデータをクリアします
DELETE FROM work_logs WHERE status = 'planned';
DELETE FROM sales_logs WHERE status = 'planned';

-- 2. 作業記録（work_logs）への plan_id の追加
ALTER TABLE work_logs ADD COLUMN IF NOT EXISTS plan_id UUID REFERENCES cultivation_plans_v2(id) ON DELETE CASCADE;

-- 3. 出荷記録（sales_logs）への plan_id の追加
ALTER TABLE sales_logs ADD COLUMN IF NOT EXISTS plan_id UUID REFERENCES cultivation_plans_v2(id) ON DELETE CASCADE;

-- 4. インデックスの追加（検索パフォーマンス向上のため）
CREATE INDEX IF NOT EXISTS idx_work_logs_plan_id ON work_logs(plan_id);
CREATE INDEX IF NOT EXISTS idx_sales_logs_plan_id ON sales_logs(plan_id);
