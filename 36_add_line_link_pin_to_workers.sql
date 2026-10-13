-- ==============================================================================
-- 🚨 workers テーブルに「LINE連携専用コード（line_link_pin）」カラムを追加
-- （現場打刻用の暗証番号 pin_code とは完全に分離し、セキュリティと独立性を担保）
-- ==============================================================================

ALTER TABLE workers 
ADD COLUMN IF NOT EXISTS line_link_pin VARCHAR(10) DEFAULT NULL,
ADD COLUMN IF NOT EXISTS line_link_pin_expires_at TIMESTAMPTZ DEFAULT NULL;

COMMENT ON COLUMN workers.line_link_pin IS 'LINE公式アカウント連携専用のワンタイムコード（打刻暗証番号とは別物）';
COMMENT ON COLUMN workers.line_link_pin_expires_at IS 'LINE連携コードの有効期限';

-- インデックス作成（LINE Webhook受信時の高速照合用）
CREATE INDEX IF NOT EXISTS idx_workers_line_link_pin ON workers(line_link_pin);
