-- 1. work_logs (作業記録テーブル) にタイムレコーダー用のカラムと、資材記録用のカラムを追加します。
ALTER TABLE work_logs 
ADD COLUMN start_time TIMESTAMP WITH TIME ZONE,
ADD COLUMN end_time TIMESTAMP WITH TIME ZONE,
ADD COLUMN status VARCHAR(50) DEFAULT 'completed', -- 'running' (作業中) または 'completed' (完了)
ADD COLUMN material_id UUID,
ADD COLUMN material_quantity NUMERIC;

-- 既存のデータを壊さないための設定です。
-- これまで記録したデータはすべて「完了済み (completed)」として扱われます。
