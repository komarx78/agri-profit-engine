-- 1. workers (作業員マスタ) テーブルに、ログイン用の4桁暗証番号 (PIN) を追加します。
ALTER TABLE workers 
ADD COLUMN pin_code VARCHAR(10) DEFAULT '0000'; -- 初期パスワードは 0000 とします

-- 2. role カラムを追加して、管理者と現場スタッフを分けられるようにします（今回はとりあえず全員現場想定ですが、拡張性のため）。
ALTER TABLE workers 
ADD COLUMN role VARCHAR(20) DEFAULT 'staff'; -- 'admin' または 'staff'
