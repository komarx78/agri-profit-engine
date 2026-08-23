-- 11_Supabase_資材カテゴリ追加.sql
-- 資材マスタ (materials) に経営分析用のカテゴリを追加する

ALTER TABLE materials ADD COLUMN IF NOT EXISTS category VARCHAR(255);

-- 既存のデータがあれば、とりあえず「諸材料費」等を入れておくか、NULLのままにしておく（今回はNULL許容として、フロントエンドで「未分類」または「諸材料費」として扱う）
