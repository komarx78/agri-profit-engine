-- work_logs テーブルにタスクタイトルの多言語翻訳カラムを追加
ALTER TABLE work_logs ADD COLUMN IF NOT EXISTS task_title_en TEXT;
ALTER TABLE work_logs ADD COLUMN IF NOT EXISTS task_title_vi TEXT;
ALTER TABLE work_logs ADD COLUMN IF NOT EXISTS task_title_id TEXT;
ALTER TABLE work_logs ADD COLUMN IF NOT EXISTS task_title_zh TEXT;
ALTER TABLE work_logs ADD COLUMN IF NOT EXISTS task_title_si TEXT;
ALTER TABLE work_logs ADD COLUMN IF NOT EXISTS task_title_km TEXT;
