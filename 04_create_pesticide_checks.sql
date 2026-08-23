-- ==============================================================================
-- 農薬チェック履歴テーブル (pesticide_checks) の作成
-- ==============================================================================

-- もし以前失敗したテーブルが残っていれば削除
DROP TABLE IF EXISTS public.pesticide_checks;

CREATE TABLE public.pesticide_checks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
    farm_id UUID REFERENCES public.farms(id) ON DELETE CASCADE, -- farmsテーブル(テナント)に紐付け
    user_id UUID,                    -- auth.users のIDを入れる用
    crop_name TEXT NOT NULL,         -- 作物名
    pesticide_name TEXT NOT NULL,    -- 農薬名（商品名）
    target_pest TEXT,                -- 対象病害虫・雑草
    usage_amount TEXT,               -- 使用量・希釈倍率など
    ai_judgment TEXT,                -- AIによる判定結果（例: 適合, 不適合, 要確認）
    ai_response TEXT,                -- AIの回答詳細（テキスト）
    is_confirmed BOOLEAN DEFAULT false
);

-- ※ 02_Supabase_初期構築.sql に準拠し、当面の間はRLSをかけずに動作させます。
