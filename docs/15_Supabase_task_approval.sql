-- ==============================================================================
-- 農業システム (SaaS) : タスク管理＆承認フロー拡張 SQL
-- ==============================================================================

-- 1. 部署（部門）テーブルの作成
CREATE TABLE IF NOT EXISTS public.departments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL, -- マルチテナント対応
  name TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- RLS (Row Level Security) の設定
ALTER TABLE public.departments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "テナントは自分の部署のみ参照可能" 
ON public.departments FOR SELECT 
USING (auth.uid() = tenant_id);

CREATE POLICY "テナントは自分の部署のみ作成可能" 
ON public.departments FOR INSERT 
WITH CHECK (auth.uid() = tenant_id);

CREATE POLICY "テナントは自分の部署のみ更新可能" 
ON public.departments FOR UPDATE 
USING (auth.uid() = tenant_id);

CREATE POLICY "テナントは自分の部署のみ削除可能" 
ON public.departments FOR DELETE 
USING (auth.uid() = tenant_id);

-- ==============================================================================
-- 2. 作業者 (workers) テーブルの拡張
-- ==============================================================================
ALTER TABLE public.workers
ADD COLUMN department_id UUID REFERENCES public.departments(id) ON DELETE SET NULL;

-- ==============================================================================
-- 3. 作業記録 (work_logs) テーブルの拡張 (タスク＆承認対応)
-- ==============================================================================
-- 承認ステータス (pending: 承認待ち, approved: 承認済, rejected: 差し戻し)
-- 過去の記録はすべて「承認済(approved)」として扱います
ALTER TABLE public.work_logs
ADD COLUMN approval_status TEXT DEFAULT 'approved';

-- 指示内容やタスク名を入れるためのカラム
ALTER TABLE public.work_logs
ADD COLUMN task_title TEXT;

-- 部署宛のタスク割り当て用カラム
ALTER TABLE public.work_logs
ADD COLUMN department_id UUID REFERENCES public.departments(id) ON DELETE SET NULL;
