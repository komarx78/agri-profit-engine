-- 12_Supabase_資材規格追加.sql
-- 経営指標記入用紙の詳細内訳出力用に、資材マスタ (materials) に「規格」を追加する

ALTER TABLE materials ADD COLUMN IF NOT EXISTS specification VARCHAR(255);

-- 既存データのspecificationはNULLになります。必要に応じてマスタ画面から編集してください。
