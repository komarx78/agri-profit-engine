-- 1. work_videos および videos ストレージバケットの作成
INSERT INTO storage.buckets (id, name, public)
VALUES 
  ('work_videos', 'work_videos', true),
  ('videos', 'videos', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- 2. 既存ポリシーの重複エラー防止用削除
DROP POLICY IF EXISTS "Public Access work_videos" ON storage.objects;
DROP POLICY IF EXISTS "Public Access videos" ON storage.objects;
DROP POLICY IF EXISTS "Allow Upload work_videos" ON storage.objects;
DROP POLICY IF EXISTS "Allow Upload videos" ON storage.objects;
DROP POLICY IF EXISTS "Allow Update work_videos" ON storage.objects;
DROP POLICY IF EXISTS "Allow Update videos" ON storage.objects;
DROP POLICY IF EXISTS "Allow Delete work_videos" ON storage.objects;
DROP POLICY IF EXISTS "Allow Delete videos" ON storage.objects;

-- 3. 誰でも閲覧（再生・ダウンロード）できるポリシー
CREATE POLICY "Public Access work_videos" ON storage.objects
  FOR SELECT USING (bucket_id = 'work_videos');

CREATE POLICY "Public Access videos" ON storage.objects
  FOR SELECT USING (bucket_id = 'videos');

-- 4. 動画のアップロードを許可するポリシー
CREATE POLICY "Allow Upload work_videos" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'work_videos');

CREATE POLICY "Allow Upload videos" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'videos');

-- 5. 動画の更新・削除を許可するポリシー
CREATE POLICY "Allow Update work_videos" ON storage.objects
  FOR UPDATE USING (bucket_id = 'work_videos');

CREATE POLICY "Allow Update videos" ON storage.objects
  FOR UPDATE USING (bucket_id = 'videos');

CREATE POLICY "Allow Delete work_videos" ON storage.objects
  FOR DELETE USING (bucket_id = 'work_videos');

CREATE POLICY "Allow Delete videos" ON storage.objects
  FOR DELETE USING (bucket_id = 'videos');
