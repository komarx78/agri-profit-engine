import { createClient } from '@supabase/supabase-js';

// Server Actions などのバックエンドでのみ使用する、権限チェックをバイパスする強力なクライアント
// 🚨 クライアントコンポーネント（ブラウザ側）では絶対に使用しないでください
export const createAdminClient = () => {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

  if (!url || !key) {
    throw new Error('Missing Supabase environment variables');
  }

  return createClient(
    url,
    key,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    }
  );
};
