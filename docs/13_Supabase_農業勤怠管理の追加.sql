-- ==========================================
-- 農業特化型 勤怠・有給管理システムの追加
-- ==========================================

-- 1. 勤怠ログテーブルの作成
CREATE TABLE IF NOT EXISTS attendance_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    worker_id UUID NOT NULL, -- 従業員(現場作業者)
    date DATE NOT NULL, -- 勤務日 (YYYY-MM-DD)
    clock_in TIMESTAMPTZ, -- 出勤時間
    clock_out TIMESTAMPTZ, -- 退勤時間
    break_start_time TIMESTAMPTZ, -- (直近の)休憩開始時間
    break_end_time TIMESTAMPTZ, -- (直近の)休憩終了時間
    total_break_minutes INTEGER DEFAULT 0, -- 累計休憩時間（分）。管理者が一括編集可能
    weather TEXT, -- 出勤時の天候
    temperature NUMERIC, -- 出勤時の気温
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- RLS（Row Level Security）の有効化
ALTER TABLE attendance_logs ENABLE ROW LEVEL SECURITY;

-- フルアクセスポリシーの作成 (認証・未認証問わずCRUD可能とする)
CREATE POLICY "Enable all actions for attendance_logs" ON attendance_logs FOR ALL USING (true);


-- 2. 既存の作業記録テーブル (work_logs) の拡張
-- 作付作業管理にも天候・気温を活かせるようカラムを追加
ALTER TABLE work_logs 
ADD COLUMN IF NOT EXISTS weather TEXT,
ADD COLUMN IF NOT EXISTS temperature NUMERIC;

