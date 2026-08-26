-- ==============================================================================
-- 29_add_memo_and_status_to_attendance_logs.sql
-- attendance_logs テーブルに memo (管理者修正理由) および status (勤務区分) カラムを追加
-- ==============================================================================

DO $$
BEGIN
    -- 1. status (勤務区分: completed, paid_leave, half_paid_am, half_paid_pm, absence, holiday 等)
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'attendance_logs' AND column_name = 'status'
    ) THEN
        ALTER TABLE public.attendance_logs ADD COLUMN status TEXT DEFAULT 'completed';
    END IF;

    -- 2. memo (管理者メモ / 修正理由)
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'attendance_logs' AND column_name = 'memo'
    ) THEN
        ALTER TABLE public.attendance_logs ADD COLUMN memo TEXT;
    END IF;
END $$;
